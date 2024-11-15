import { BskyAgent } from "@atproto/api";
import * as dotenv from "dotenv";
import * as process from "process";
import fs, { PathLike } from "fs";
import path from "path";
import { ScrapedData } from "./types";
import {
  setupDatabase,
  savePostedNode,
  isNodePosted,
  getNextScheduledNode,
  deleteScheduledNodeId,
} from "./db_utils.js";
import { scrapeNodePage } from "./archive_utils.js";
import { processImage } from "./image_utils.js";
import { composePostText } from "./text_utils.js";
import { fileURLToPath } from "url";

// Get the current file path and directory path for temporary image storage
export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

dotenv.config();

async function postToBluesky(resizedPath: PathLike, scrapedData: ScrapedData) {
  // Create a Bluesky Agent
  const agent = new BskyAgent({
    service: "https://bsky.social",
  });

  // login
  if (!process.env.BLUESKY_USERNAME || !process.env.BLUESKY_PASSWORD) {
    return;
  }
  await agent.login({
    identifier: process.env.BLUESKY_USERNAME,
    password: process.env.BLUESKY_PASSWORD,
  });

  // Upload the image first
  const imageUpload = await agent.uploadBlob(fs.readFileSync(resizedPath), {
    encoding: "image/jpeg",
  });

  console.log("image upload response data: ", imageUpload.data);
  if (imageUpload.success) {
    console.log("image uploaded successfully, posting with image next.");
    const text = composePostText(scrapedData);

    // Post with the uploaded image, text and alt text
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

    console.log("Posted successfully, posting reply with Node url next.");
    process.stdout.write("\u0007"); // meep meep meep! local only :(
    process.stdout.write("\u0007");
    process.stdout.write("\u0007");

    // Conditionally reply to the image with the full node URL
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
}

async function main() {
  const db = await setupDatabase();

  // TODO auto populate the scheduled posts table
  const node = await getNextScheduledNode(db);
  if (!node) {
    // abort! the table is empty
    await db.close();
    console.log(
      "Scheduled node ids table is empty or broken, db closed, exiting main"
    );
    return;
  }

  // Check if the node has already been posted, no duplicates!
  console.log("Picked a node id from table: ", node.id);
  const alreadyPosted = await isNodePosted(db, node.id);

  if (!alreadyPosted) {
    try {
      // Scrape data from node view
      const nodeUrl = `https://digital.denverlibrary.org/nodes/view/${node.id}`;
      const scrapedData = await scrapeNodePage(nodeUrl);
      if (!scrapedData) {
        console.log("Scraping failed. Exiting main.");
        return;
      }

      // Temporary location for downloaded image
      const imagePath = path.resolve(__dirname, "downloaded_image.jpg");

      // Temporary location for resized image
      const resizedPath = await processImage(scrapedData.imageUrl, __dirname);

      if (
        process.env.BLUESKY_USERNAME &&
        process.env.BLUESKY_PASSWORD &&
        resizedPath &&
        scrapedData
      ) {
        // Create the post and reply on Bluesky
        await postToBluesky(resizedPath, scrapedData);

        // Save the node id to db after posting
        await savePostedNode(db, node.id, node.description);
        await deleteScheduledNodeId(db, node.id);
      } else {
        console.log("No BSKY credentials?", process.env.BLUESKY_USERNAME);
      }

      // Clean up the downloaded image after posting
      fs.unlinkSync(imagePath);
    } catch (error) {
      console.error("Failed to post image to Bluesky:", error);
    }
  } else {
    console.log(`Tried to post a duplicate node id ${node.id}, exiting main.`);
  }

  // Close the database connection when done with post
  await db.close();
  console.log("db closed, exiting main");
  return;
}

main();
