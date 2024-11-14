import axios from "axios";
import fs, { PathLike } from "fs";
import path from "path";
import sharp from "sharp";

// Maximum file size in bytes (e.g., 500 KB)
const MAX_FILE_SIZE = 500 * 1024;

// Target dimensions if resizing is needed
const TARGET_WIDTH = 600;
const TARGET_HEIGHT = 600;

export async function downloadImage(
  url: string | undefined,
  outputPath: PathLike
) {
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

export async function checkAndResizeImage(
  imagePath: PathLike,
  __dirname: string
) {
  const stats = fs.statSync(imagePath);

  // If downloaded image is greater than MAX_FILE_SIZE, resize it
  if (stats.size > MAX_FILE_SIZE) {
    const resizedImagePath = path.resolve(__dirname, "resized_image.jpg");
    await sharp(imagePath as string)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "inside" })
      .toFile(resizedImagePath);

    console.log(`Image resized to fit within ${TARGET_WIDTH}x${TARGET_HEIGHT}`);
    return resizedImagePath;
  }

  console.log("Image size is within the limit; no resizing needed.");
  return imagePath;
}

export async function processImage(url: string, __dirname: string) {
  const fullsizeImagePath = path.resolve(__dirname, "downloaded_image.jpg");

  try {
    await downloadImage(url, fullsizeImagePath);
    const resizedImagePath = await checkAndResizeImage(
      fullsizeImagePath,
      __dirname
    );

    console.log(`Final image available at: ${resizedImagePath}`);
    return resizedImagePath;
  } catch (error) {
    console.error("Error downloading or resizing the image:", error);
  }
}
