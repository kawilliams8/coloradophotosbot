import sqlite3 from "sqlite3";
import { open } from "sqlite";

async function addDatesToScheduledPostsTable() {
  const db = await open({
    filename: "./nodes.db",
    driver: sqlite3.Database,
  });
  try {
    const rows = await db.all(
      "SELECT id FROM scheduled_nodes WHERE post_date IS NULL ORDER BY id ASC"
    );

    let date = new Date("2024-12-20"); // Start with the next needed date
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

addDatesToScheduledPostsTable();
