import sqlite3 from "sqlite3";
import { open } from "sqlite";

async function switchRows(id1: number, id2: number) {
  const db = await open({
    filename: "./nodes.db",
    driver: sqlite3.Database,
  });

  try {
    await db.exec("BEGIN TRANSACTION");

    // Fetch the data for both rows
    const row1 = await db.get("SELECT * FROM scheduled_nodes WHERE id = ?", [
      id1,
    ]);
    const row2 = await db.get("SELECT * FROM scheduled_nodes WHERE id = ?", [
      id2,
    ]);

    if (!row1 || !row2) {
      throw new Error("One or both rows not found");
    }

    // Delete the existing rows to avoid UNIQUE constraint error
    await db.run("DELETE FROM scheduled_nodes WHERE id = ?", [id1]);
    await db.run("DELETE FROM scheduled_nodes WHERE id = ?", [id2]);

    // Insert the switched data
    await db.run(
      `INSERT INTO scheduled_nodes (id, node_id, node_description)
      VALUES (?, ?, ?)`,
      [id1, row2.node_id, row2.node_description]
    );

    await db.run(
      `INSERT INTO scheduled_nodes (id, node_id, node_description)
      VALUES (?, ?, ?)`,
      [id2, row1.node_id, row1.node_description]
    );

    // Commit the transaction
    await db.exec("COMMIT");
    console.log(`Successfully switched rows ${id1} and ${id2}`);
  } catch (error) {
    // Rollback the transaction in case of an error
    await db.exec("ROLLBACK");
    console.error("Error switching rows:", error.message);
  } finally {
    await db.close();
  }
}

// Get IDs from command-line arguments
const [, , id1, id2] = process.argv;

if (!id1 || !id2) {
  console.error("Two row ids needed. npm run switchrows -- 1 2");
  process.exit(1);
}

switchRows(parseInt(id1, 10), parseInt(id2, 10));

// npm run switchrows -- 1 2
