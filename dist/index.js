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
import { BskyAgent } from "@atproto/api";
import * as dotenv from "dotenv";
import * as process from "process";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { nodeIds } from "./nodeIds.js";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAX_FILE_SIZE = 500 * 1024;
const TARGET_WIDTH = 600;
const TARGET_HEIGHT = 600;
function setupDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        const db = yield open({
            filename: "./nodes.db",
            driver: sqlite3.Database,
        });
        yield db.exec(`
    CREATE TABLE IF NOT EXISTS posted_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT UNIQUE,
      post_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
        return db;
    });
}
function savePostedNode(db, nodeId) {
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
function isNodePosted(db, nodeId) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield db.get("SELECT * FROM posted_nodes WHERE node_id = ?", nodeId);
        return !!result;
    });
}
function scrapePage(url) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        try {
            const { data } = yield axios.get(url);
            const $ = cheerio.load(data);
            const title = (_a = $('meta[property="og:title"]').attr("content")) !== null && _a !== void 0 ? _a : "";
            const imageUrl = (_b = $('meta[property="og:image"]').attr("content")) !== null && _b !== void 0 ? _b : "";
            const nodeUrl = (_c = $('meta[property="og:url"]').attr("content")) !== null && _c !== void 0 ? _c : "";
            const imageDate = (_d = $(".titlelabel")
                .filter(function () {
                return $(this).text().trim() === "Date";
            })
                .parent()
                .text()
                .slice(4)) !== null && _d !== void 0 ? _d : "";
            const summary = (_e = $(".titlelabel")
                .filter(function () {
                return $(this).text().trim() === "Summary";
            })
                .parent()
                .text()
                .slice(7)) !== null && _e !== void 0 ? _e : "";
            const altSummary = (_f = $(".titlelabel")
                .filter(function () {
                return $(this).text().trim() === "Alternate Title";
            })
                .parent()
                .text()) !== null && _f !== void 0 ? _f : "";
            return { title, imageUrl, imageDate, summary, altSummary, nodeUrl };
        }
        catch (error) {
            console.error("Error scraping the page:", error);
        }
    });
}
function truncate(text, maxChars) {
    return text.length > maxChars ? text.slice(0, maxChars) + "... " : text;
}
function composePostText({ title, imageDate, summary, altSummary, }) {
    var _a;
    const dateSeparator = ` | ${imageDate} | `;
    const text = truncate(title, 50) +
        dateSeparator +
        ((_a = truncate(summary, 245 - dateSeparator.length)) !== null && _a !== void 0 ? _a : truncate(altSummary, 245 - dateSeparator.length));
    console.log("Composed post text: ", text);
    return text;
}
function downloadImage(url, outputPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield axios({
            url,
            responseType: "stream",
        });
        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);
            writer.on("finish", resolve);
            writer.on("error", reject);
        });
    });
}
function checkAndResizeImage(imagePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const stats = fs.statSync(imagePath);
        if (stats.size > MAX_FILE_SIZE) {
            const resizedImagePath = path.resolve(__dirname, "resized_image.jpg");
            yield sharp(imagePath)
                .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "inside" })
                .toFile(resizedImagePath);
            console.log(`Image resized to fit within ${TARGET_WIDTH}x${TARGET_HEIGHT}`);
            return resizedImagePath;
        }
        console.log("Image size is within the limit; no resizing needed.");
        return imagePath;
    });
}
function processImage(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const fullsizeImagePath = path.resolve(__dirname, "downloaded_image.jpg");
        try {
            yield downloadImage(url, fullsizeImagePath);
            const resizedImagePath = yield checkAndResizeImage(fullsizeImagePath);
            console.log(`Final image available at: ${resizedImagePath}`);
            return resizedImagePath;
        }
        catch (error) {
            console.error("Error downloading or resizing the image:", error);
        }
    });
}
function postToBluesky(resizedPath, scrapedData) {
    return __awaiter(this, void 0, void 0, function* () {
        const agent = new BskyAgent({
            service: "https://bsky.social",
        });
        if (!process.env.BLUESKY_USERNAME || !process.env.BLUESKY_PASSWORD) {
            return;
        }
        yield agent.login({
            identifier: process.env.BLUESKY_USERNAME,
            password: process.env.BLUESKY_PASSWORD,
        });
        const imageUpload = yield agent.uploadBlob(fs.readFileSync(resizedPath), {
            encoding: "image/jpeg",
        });
        const text = composePostText(scrapedData);
        const result = yield agent.post({
            text,
            embed: {
                $type: "app.bsky.embed.images",
                images: [
                    {
                        image: imageUpload.data.blob,
                        alt: text,
                    },
                ],
            },
        });
        console.log("Image posted successfully!");
        process.stdout.write("\u0007");
        process.stdout.write("\u0007");
        process.stdout.write("\u0007");
        if (scrapedData.nodeUrl.length) {
            yield agent.post({
                text: "DPL Archive post: " + scrapedData.nodeUrl,
                reply: {
                    root: {
                        uri: result.uri,
                        cid: result.cid,
                    },
                    parent: {
                        uri: result.uri,
                        cid: result.cid,
                    },
                },
                createdAt: new Date().toISOString(),
            });
        }
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const db = yield setupDatabase();
        const nodeId = nodeIds.shift();
        if (!nodeId) {
            yield db.close();
            console.log("node ids list empty, db closed, exiting main");
            return;
        }
        console.log("Picked a node id from array: ", nodeId);
        const alreadyPosted = yield isNodePosted(db, nodeId);
        if (!alreadyPosted) {
            try {
                const nodeUrl = `https://digital.denverlibrary.org/nodes/view/${nodeId}`;
                const scrapedData = yield scrapePage(nodeUrl);
                if (!scrapedData) {
                    console.log("Scraping failed. Exiting.");
                    return;
                }
                const imagePath = path.resolve(__dirname, "downloaded_image.jpg");
                const resizedPath = yield processImage(scrapedData.imageUrl);
                if (process.env.BLUESKY_USERNAME &&
                    process.env.BLUESKY_PASSWORD &&
                    resizedPath &&
                    scrapedData) {
                    yield postToBluesky(resizedPath, scrapedData);
                    yield savePostedNode(db, nodeId);
                }
                else {
                    console.log("No credentials?", process.env.BLUESKY_USERNAME);
                }
                fs.unlinkSync(imagePath);
            }
            catch (error) {
                console.error("Failed to post image to Bluesky:", error);
            }
        }
        else {
            console.log(`Tried to post with a used node id ${nodeId}.`);
        }
        yield db.close();
        console.log("db closed, exiting main");
        return;
    });
}
main();
