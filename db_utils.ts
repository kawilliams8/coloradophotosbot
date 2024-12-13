import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import { ScheduledNode } from "./types";

// Open or create an SQLite database file to track used archive nodes
export async function setupDatabase() {
  const db = await open({
    filename: "./nodes.db",
    driver: sqlite3.Database,
  });
  db.configure("busyTimeout", 5000);
  // await removeDatesFromScheduledPostsTable(db);
  // await addDatesToScheduledPostsTable(db);

  // Add tables, if needed. Close db tools if locked error.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS posted_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT UNIQUE,
      post_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT UNIQUE,
      node_description TEXT UNIQUE
    )
  `);

  // "Migration 1" Store the photo description once it's been posted, for readability.
  const descExists = await db.get(`
    SELECT 1
    FROM pragma_table_info('posted_nodes')
    WHERE name = 'node_description'
  `);

  if (!descExists) {
    await db.exec(`
      ALTER TABLE posted_nodes
      ADD COLUMN node_description TEXT
      `);
  }

  // "Migration 2" Add a date to the scheduled posts to help plan for holidays.
  const postDateExists = await db.get(`
    SELECT 1
    FROM pragma_table_info('scheduled_nodes')
    WHERE name = 'post_date'
  `);

  if (!postDateExists) {
    await db.exec(`
      ALTER TABLE scheduled_nodes
      ADD COLUMN post_date TEXT
      `);
  }

  return db;
}

export async function savePostedNode(
  db: Database<sqlite3.Database, sqlite3.Statement>,
  nodeId: number,
  nodeDescription: string
) {
  try {
    await db.run(
      "INSERT INTO posted_nodes (node_id, node_description) VALUES (?, ?)",
      nodeId,
      nodeDescription
    );
    console.log(`Node id ${nodeId} saved to the posted nodes table.`);
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT") {
      console.log(
        `Node id ${nodeId} is already in the database (after posting?).`
      );
    } else {
      console.error("Error saving node id:", error);
    }
  }
}

export async function getNextScheduledNode(
  db: Database<sqlite3.Database, sqlite3.Statement>
): Promise<ScheduledNode | null> {
  let result;

  while (true) {
    result = await db.get(
      "SELECT node_id, node_description FROM scheduled_nodes ORDER BY id ASC LIMIT 1;"
    );

    if (!result) {
      console.log("Scheduled posts table is empty");
      return null;
    }

    const alreadyPosted = await isNodePosted(db, result.node_id);

    if (!alreadyPosted) {
      console.log("Picked a node from scheduled table: ", result.node_id);
      return {
        id: result.node_id, // Reformatting to camel case
        description: result.node_description,
      };
    } else {
      // Remove the already posted node and continue the loop
      console.log(
        `Node ${result.node_id} is already posted. Removing from table.`
      );
      await deleteScheduledNodeId(db, result.node_id);
    }
  }
}

export async function deleteScheduledNodeId(
  db: Database<sqlite3.Database, sqlite3.Statement>,
  nodeId: number
) {
  try {
    await db.run("DELETE FROM scheduled_nodes WHERE node_id = ?", [nodeId]);
    console.log(`Node id ${nodeId} deleted from the scheduled nodes table.`);
  } catch (error) {
    console.error("Error deleting scheduled node id: ", error);
  }
}

export async function isNodePosted(
  db: Database<sqlite3.Database, sqlite3.Statement>,
  nodeId: number
) {
  const result = await db.get(
    "SELECT * FROM posted_nodes WHERE node_id = ?",
    nodeId
  );
  return !!result; // true if found
}

export async function removeDatesFromScheduledPostsTable(
  db: Database<sqlite3.Database, sqlite3.Statement>
) {
  try {
    await db.run("UPDATE scheduled_nodes SET post_date = NULL");
    console.log("Dates removed successfully.");
  } catch (error) {
    console.error("Error removing dates:", error);
  }
}

export async function addDatesToScheduledPostsTable(
  db: Database<sqlite3.Database, sqlite3.Statement>
) {
  try {
    const rows = await db.all(
      "SELECT id FROM scheduled_nodes WHERE post_date IS NULL ORDER BY id ASC"
    );

    let date = new Date("2024-12-8"); // Start with the next needed date
    for (let i = 0; i < rows.length; i += 2) {
      // Updating in pairs only, good enough!
      const dateString = date.toISOString().split("T")[0]; // YYYY-MM-DD
      const rowsPair = rows.slice(i, i + 2).map((row) => row.id); // Get next pair of IDs
      rowsPair.forEach((rowId, i) => {
        db.run("UPDATE scheduled_nodes SET post_date = ? WHERE id = ?", [
          dateString + `-${i + 1}`,
          rowId,
        ]);
      });

      // Increment date by one day for the next pair
      date.setDate(date.getDate() + 1);
    }

    console.log("Dates updated successfully.");
  } catch (error) {
    console.error("Error updating dates:", error);
  }
}
