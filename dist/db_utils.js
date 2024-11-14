var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import sqlite3 from "sqlite3";
import { open } from "sqlite";
export function setupDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        const db = yield open({
            filename: "./nodes.db",
            driver: sqlite3.Database,
        });
        db.configure("busyTimeout", 5000);
        yield db.exec(`
    CREATE TABLE IF NOT EXISTS posted_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT UNIQUE,
      post_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
        yield db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT UNIQUE,
      node_description TEXT UNIQUE
    )
  `);
        return db;
    });
}
export function savePostedNode(db, nodeId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield db.run("INSERT INTO posted_nodes (node_id) VALUES (?)", nodeId);
            console.log(`Node id ${nodeId} saved to the database.`);
        }
        catch (error) {
            if (error.code === "SQLITE_CONSTRAINT") {
                console.log(`Node id ${nodeId} is already in the database (after posting?).`);
            }
            else {
                console.error("Error saving node id:", error);
            }
        }
    });
}
export function getNextScheduledNodeId(db) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield db.get("SELECT node_id FROM scheduled_nodes ORDER BY id ASC LIMIT 1;");
        return result.node_id;
    });
}
export function deleteScheduledNodeId(db, id) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield db.run("DELETE FROM scheduled_nodes WHERE id = ?", [id]);
        return result;
    });
}
export function isNodePosted(db, nodeId) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield db.get("SELECT * FROM posted_nodes WHERE node_id = ?", nodeId);
        return !!result;
    });
}
