import { BskyAgent } from "@atproto/api";
import * as dotenv from "dotenv";
import { CronJob } from "cron";
import * as process from "process";
import axios from "axios";
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
  try {
    // Where to save the image temporarily
    const imagePath = path.resolve(__dirname, "downloaded_image.jpg");

    // Download and resize the photo
    const resizedPath = await processImage(
      "https://digital.denverlibrary.org/assets/display/2332473-max" //TODO
    );

    // Create a Bluesky Agent
    const agent = new BskyAgent({
      service: "https://bsky.social",
    });

    // login
    await agent.login({
      identifier: process.env.BLUESKY_USERNAME,
      password: process.env.BLUESKY_PASSWORD,
    });

    // Upload the image to Bluesky
    const imageUpload = await agent.uploadBlob(fs.readFileSync(resizedPath), {
      encoding: "image/jpeg",
    });

    // Post with the uploaded image, TODO
    await agent.post({
      text: "This is an automated test post with an image and caption. (It's a photo of the old St. Vincent's Hospital in Leadville.)",
      embed: {
        $type: "app.bsky.embed.images",
        images: [
          {
            image: imageUpload.data.blob,
            alt: "This is test alt text. (It's a photo of the old St. Vincent's Hospital in Leadville.)",
          },
        ],
      },
    });

    console.log("Image posted successfully!");

    // Clean up the image after posting
    fs.unlinkSync(imagePath);
  } catch (error) {
    console.error("Failed to post image:", error);
  }
}

main();

// Run this on a cron job
const scheduleExpressionMinute = "* * * * *"; // Run once every minute for testing
const scheduleExpression = "0 */3 * * *"; // Run once every three hours in prod

const job = new CronJob(scheduleExpression, main); // change to scheduleExpressionMinute for testing

job.start();
