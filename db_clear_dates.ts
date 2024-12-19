import sqlite3 from "sqlite3";
import { open } from "sqlite";

export async function removeDatesFromScheduledPostsTable() {
  const db = await open({
    filename: "./nodes.db",
    driver: sqlite3.Database,
  });
  try {
    await db.run("UPDATE scheduled_nodes SET post_date = NULL");
    console.log("Dates removed successfully.");
  } catch (error) {
    console.error("Error removing dates:", error);
  }
}

removeDatesFromScheduledPostsTable();
