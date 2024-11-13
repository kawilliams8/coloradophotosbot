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
import nodeIds from "./nodeIds";

dotenv.config();

// Get the current file path and directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Maximum file size in bytes (e.g., 500 KB)
const MAX_FILE_SIZE = 500 * 1024;

// Target dimensions if resizing is needed
const TARGET_WIDTH = 600;
const TARGET_HEIGHT = 600;

// Open or create an SQLite database file to track used archive nodes
async function setupDatabase() {
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

async function savePostedNode(db, nodeId) {
  try {
    await db.run("INSERT INTO posted_nodes (node_id) VALUES (?)", nodeId);
    console.log(`Node id ${nodeId} saved to the database.`);
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT") {
      console.log(`Node id ${nodeId} is already in the database.`);
    } else {
      console.error("Error saving node id:", error);
    }
  }
}

async function isNodePosted(db, nodeId) {
  const result = await db.get(
    "SELECT * FROM posted_nodes WHERE node_id = ?",
    nodeId
  );
  return !!result; // true if found
}

async function scrapePage(url) {
  try {
    // Fetch the HTML of the page
    const { data } = await axios.get(url);

    // Load HTML into cheerio to parse with JQuery-style methods
    const $ = cheerio.load(data);
    const title = $('meta[property="og:title"]').attr("content") ?? "";
    const imageUrl = $('meta[property="og:image"]').attr("content") ?? "";
    const nodeUrl = $('meta[property="og:url"]').attr("content") ?? "";

    const imageDate =
      $(".titlelabel")
        .filter(function () {
          return $(this).text().trim() === "Date";
        })
        .parent()
        .text()
        .slice(4) ?? "";

    const summary =
      $(".titlelabel")
        .filter(function () {
          return $(this).text().trim() === "Summary";
        })
        .parent()
        .text()
        .slice(7) ?? "";

    const altSummary =
      $(".titlelabel")
        .filter(function () {
          return $(this).text().trim() === "Alternate Title";
        })
        .parent()
        .text() ?? "";

    return { title, imageUrl, imageDate, summary, altSummary, nodeUrl };
  } catch (error) {
    console.error("Error scraping the page:", error);
  }
}

function truncate(text, maxChars) {
  return text.length > maxChars ? text.slice(0, maxChars) + "... " : text;
}

function composePostText({ title, imageDate, summary, altSummary }) {
  // Node title | Node summary
  // Max 300 chars
  // "Last bivouac at Camp Hale... | 1940-1945 | 10th Mountain Division soldiers rest near their tents, which are set up in rows..."
  const dateSeparator = ` | ${imageDate} | `;
  const text =
    truncate(title, 50) +
      dateSeparator +
      truncate(summary, 245 - dateSeparator.length) ??
    truncate(altSummary, 245 - dateSeparator.length);
  console.log("Composed post text: ", text);
  return text;
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

  // If downloaded image is greater than MAX_FILE_SIZE, resize it
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
  const fullsizeImagePath = path.resolve(__dirname, "downloaded_image.jpg");

  try {
    await downloadImage(url, fullsizeImagePath);
    const resizedImagePath = await checkAndResizeImage(fullsizeImagePath);

    console.log(`Final image available at: ${resizedImagePath}`);
    return resizedImagePath;
  } catch (error) {
    console.error("Error downloading or resizing the image:", error);
  }
}

async function postToBluesky(resizedPath, scrapedData) {
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

  const text = composePostText(scrapedData);

  // Post with the uploaded image
  const result = await agent.post({
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
  process.stdout.write("\u0007"); // meep meep meep! local only :(
  process.stdout.write("\u0007");
  process.stdout.write("\u0007");

  // Conditionally reply to the image with the node URL
  if (scrapedData.nodeUrl.length) {
    await agent.post({
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
}

async function main() {
  const db = await setupDatabase();

  // TODO improve this as list grows
  const nodeId = nodeIds.find(
    async (nodeId) => await !isNodePosted(db, nodeId)
  );

  // Check if the node has already been parsed and posted
  // const alreadyPosted = await isNodePosted(db, nodeId);

  // if (!alreadyPosted) {
  try {
    // Scrape data from node view
    const nodeUrl = `https://digital.denverlibrary.org/nodes/view/${nodeId}`;
    const scrapedData = await scrapePage(nodeUrl);

    // Temporary location for downloaded image
    const imagePath = path.resolve(__dirname, "downloaded_image.jpg");

    // Download and resize the fullsize photo from the node
    const resizedPath = await processImage(scrapedData.imageUrl);

    if (process.env.BLUESKY_USERNAME && process.env.BLUESKY_PASSWORD) {
      // Create the post and reply on Bluesky
      await postToBluesky(resizedPath, scrapedData);

      // Save the node id to db after posting
      await savePostedNode(db, nodeId);
    } else {
      console.log("No credentials?", process.env.BLUESKY_USERNAME);
    }

    // Clean up the downloaded image after posting
    fs.unlinkSync(imagePath);
  } catch (error) {
    console.error("Failed to post image to Bluesky:", error);
  }
  // } else {
  //   console.log(`Node id ${nodeId} has already been posted.`);
  // }

  // Close the database connection when done
  await db.close();
  console.log("db closed, exiting main");
}

main();

// Run this on a cron job
const scheduleExpressionMinute = "* * * * *"; // Run once every minute
const scheduleExpression = "0 */4 * * *"; // Run once every four hours

const job = new CronJob(scheduleExpressionMinute, main);

job.start();
