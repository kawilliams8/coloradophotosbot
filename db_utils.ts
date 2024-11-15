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

  // Add tables, if needed. Close DB Browser first.

  await db.exec(`
    CREATE TABLE IF NOT EXISTS posted_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT UNIQUE,
      post_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    ALTER TABLE posted_nodes
    ADD COLUMN node_description TEXT
    `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT UNIQUE,
      node_description TEXT UNIQUE
    )
  `);

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
  const result = await db.get(
    "SELECT node_id, node_description FROM scheduled_nodes ORDER BY id ASC LIMIT 1;"
  );
  return result
    ? {
        id: result.node_id, // Reformatting to camel case
        description: result.node_description,
      }
    : null;
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
