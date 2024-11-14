var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import axios from "axios";
import fs from "fs";
import path from "path";
import sharp from "sharp";
const MAX_FILE_SIZE = 500 * 1024;
const TARGET_WIDTH = 600;
const TARGET_HEIGHT = 600;
export function downloadImage(url, outputPath) {
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
export function checkAndResizeImage(imagePath, __dirname) {
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
export function processImage(url, __dirname) {
    return __awaiter(this, void 0, void 0, function* () {
        const fullsizeImagePath = path.resolve(__dirname, "downloaded_image.jpg");
        try {
            yield downloadImage(url, fullsizeImagePath);
            const resizedImagePath = yield checkAndResizeImage(fullsizeImagePath, __dirname);
            console.log(`Final image available at: ${resizedImagePath}`);
            return resizedImagePath;
        }
        catch (error) {
            console.error("Error downloading or resizing the image:", error);
        }
    });
}
