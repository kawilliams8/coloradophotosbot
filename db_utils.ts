import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";

// Open or create an SQLite database file to track used archive nodes
export async function setupDatabase() {
  const db = await open({
    filename: "./nodes.db",
    driver: sqlite3.Database,
  });

  // Add table, if needed
  await db.exec(`
    CREATE TABLE IF NOT EXISTS posted_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT UNIQUE,
      post_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}

export async function savePostedNode(
  db: Database<sqlite3.Database, sqlite3.Statement>,
  nodeId: number
) {
  try {
    await db.run("INSERT INTO posted_nodes (node_id) VALUES (?)", nodeId);
    console.log(`Node id ${nodeId} saved to the database.`);
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
