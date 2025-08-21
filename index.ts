import { BskyAgent, RichText } from "@atproto/api";
import * as dotenv from "dotenv";
import * as process from "process";
import fs, { PathLike } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ScrapedData } from "./types";
import {
  setupDatabase,
  savePostedNode,
  getNextScheduledNode,
  deleteScheduledNodeId,
} from "./db_utils.js";
import { scrapeNodePage } from "./archive_utils.js";
import { processImage } from "./image_utils.js";
import { composePostText } from "./text_utils.js";

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
    throw new Error(
      "Missing credentials. Set BLUESKY_USERNAME and BLUESKY_PASSWORD."
    );
  }
  await agent.login({
    identifier: process.env.BLUESKY_USERNAME,
    password: process.env.BLUESKY_PASSWORD,
  });

  // Upload the image first
  const imageUpload = await agent.uploadBlob(fs.readFileSync(resizedPath), {
    encoding: "image/jpeg",
  });

  if (imageUpload.success) {
    console.log("image uploaded successfully, posting with image next.");
    const response = await composePostText(scrapedData);

    // Post with the uploaded image, text and alt text
    if (response) {
      const { text, tags, creatorName } = response;
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

      console.log("extracted tags: ", tags);
      console.log("extracted name: ", creatorName);

      console.log("Posted successfully, posting reply with Node url next.");
      process.stdout.write("\u0007"); // meep meep meep! local only :(
      process.stdout.write("\u0007");
      process.stdout.write("\u0007");

      // Conditionally reply to the image with the full node URL
      if (scrapedData.nodeUrl.length) {
        const rt = new RichText({
          text:
            "DPL Archive post: " +
            scrapedData.nodeUrl +
            " #Colorado " +
            tags[0] +
            " " +
            tags[1] +
            " Photographer: " +
            creatorName,
        });
        await rt.detectFacets(agent); // automatically detects mentions and links
        await agent.post({
          text: rt.text,
          facets: rt.facets,
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

      // Save the node id to db after posting, delete from scheduled table
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

  // Close the database connection when done with post
  await db.close();
  console.log("db closed, exiting main");
  return;
}

main();
