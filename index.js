import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { BskyAgent } from "@atproto/api";
import * as dotenv from "dotenv";
import { CronJob } from "cron";
import * as process from "process";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

dotenv.config();

// Get the current file path and directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Maximum file size in bytes (e.g., 500 KB)
const MAX_FILE_SIZE = 500 * 1024;

// Target dimensions if resizing is needed
const TARGET_WIDTH = 600;
const TARGET_HEIGHT = 600;

// Open or create an SQLite database file
async function setupDatabase() {
  const db = await open({
    filename: "./nodes.db",
    driver: sqlite3.Database,
  });

  // Create a table to store used node IDs (if it doesn't exist)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS posted_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT UNIQUE,
      post_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}

async function savePostedNode(db, nodeId) {
  try {
    await db.run("INSERT INTO posted_nodes (node_id) VALUES (?)", nodeId);
    console.log(`Node ID ${nodeId} saved to the database.`);
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT") {
      console.log(`Node ID ${nodeId} is already in the database.`);
    } else {
      console.error("Error saving node ID:", error);
    }
  }
}

async function isNodePosted(db, nodeId) {
  const result = await db.get(
    "SELECT * FROM posted_nodes WHERE node_id = ?",
    nodeId
  );
  return !!result; // Returns true if found, false if not
}

async function scrapePage(url) {
  try {
    // Fetch the HTML of the page
    const { data } = await axios.get(url);

    // Load HTML into cheerio
    const $ = cheerio.load(data);

    // Now you can use jQuery-style selectors to scrape information
    const title = $('meta[property="og:title"]').attr("content");
    const relatedImageUrl = $('meta[property="og:image"]').attr("content");
    const nodeUrl = $('meta[property="og:url"]').attr("content");

    const summary = $(".titlelabel")
      .filter(function () {
        return $(this).text().trim() === "Summary";
      })
      .parent()
      .text();

    const altSummary = $(".titlelabel")
      .filter(function () {
        return $(this).text().trim() === "Alternate Title";
      })
      .parent()
      .text();

    return { title, relatedImageUrl, summary, altSummary, nodeUrl };
  } catch (error) {
    console.error("Error fetching the page:", error);
  }
}

async function downloadImage(url, outputPath) {
  const response = await axios({
    url,
    responseType: "stream",
  });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function checkAndResizeImage(imagePath) {
  const stats = fs.statSync(imagePath);

  // If file size is greater than MAX_FILE_SIZE, resize it
  if (stats.size > MAX_FILE_SIZE) {
    const resizedImagePath = path.resolve(__dirname, "resized_image.jpg");
    await sharp(imagePath)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "inside" })
      .toFile(resizedImagePath);

    console.log(`Image resized to fit within ${TARGET_WIDTH}x${TARGET_HEIGHT}`);
    return resizedImagePath;
  }

  console.log("Image size is within the limit; no resizing needed.");
  return imagePath;
}

async function processImage(url) {
  const originalImagePath = path.resolve(__dirname, "downloaded_image.jpg");

  try {
    await downloadImage(url, originalImagePath);
    const finalImagePath = await checkAndResizeImage(originalImagePath);

    console.log(`Final image available at: ${finalImagePath}`);
    return finalImagePath;
  } catch (error) {
    console.error("Error downloading or resizing the image:", error);
  }
}

async function main() {
  // Set up the databas
  const db = await setupDatabase();

  const nodeId = 1075229; // TODO randomize

  // Check if the node has already been parsed and posted
  const alreadyPosted = await isNodePosted(db, nodeId);

  if (!alreadyPosted) {
    try {
      // Scrape data from node view
      const url = `https://digital.denverlibrary.org/nodes/view/${nodeId}`;
      const scrapedData = await scrapePage(url);

      // Where to save the image temporarily
      const imagePath = path.resolve(__dirname, "downloaded_image.jpg");

      // Download and resize the photo
      const resizedPath = await processImage(scrapedData.relatedImageUrl);

      // Create a Bluesky Agent
      const agent = new BskyAgent({
        service: "https://bsky.social",
      });

      // login
      await agent.login({
        identifier: process.env.BLUESKY_USERNAME,
        password: process.env.BLUESKY_PASSWORD,
      });

      // Upload the image
      const imageUpload = await agent.uploadBlob(fs.readFileSync(resizedPath), {
        encoding: "image/jpeg",
      });

      // Compose post text and alt tag
      const text =
        scrapedData.title.slice(0, 50) +
          " | " +
          scrapedData.summary.slice(7, 235) ??
        scrapedData.altSummary.slice(0, 235);
      // Post with the uploaded image
      const result = await agent.post({
        text: text,
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

      console.log("Image posted successfully!", result);

      // Conditionally reply to the image with the node URL
      if (scrapedData.nodeUrl.length) {
        await agent.post({
          text: "See original DPL Archive post at: " + scrapedData.nodeUrl,
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

      // Save the photo ID to db after posting
      await savePostedNode(db, nodeId);

      // Clean up the downloaded image after posting
      fs.unlinkSync(imagePath);
    } catch (error) {
      console.error("Failed to post image:", error);
    }
  } else {
    console.log(`Node ID ${nodeId} has already been posted.`);
  }

  // Close the database connection when done
  await db.close();
  console.log("db closed, exiting main");
}

main();

// Run this on a cron job
const scheduleExpressionMinute = "* * * * *"; // Run once every minute for testing
const scheduleExpression = "0 */3 * * *"; // Run once every three hours in prod

const job = new CronJob(scheduleExpression, main); // change to scheduleExpressionMinute for testing

job.start();
