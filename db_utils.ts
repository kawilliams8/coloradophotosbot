import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import { ScheduledNode } from "./types";

const DB_PATH = "./nodes.db";

// Open or create an SQLite database file to track used archive nodes
export async function setupDatabase(): Promise<Database> {
  const db = await open({
    filename: DB_PATH,
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
