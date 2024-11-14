var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { BskyAgent } from "@atproto/api";
import * as dotenv from "dotenv";
import * as process from "process";
import fs from "fs";
import path from "path";
import { setupDatabase, savePostedNode, isNodePosted, getNextScheduledNodeId, deleteScheduledNodeId, } from "./db_utils.js";
import { scrapeNodePage } from "./archive_utils.js";
import { processImage } from "./image_utils.js";
import { composePostText } from "./text_utils.js";
import { fileURLToPath } from "url";
export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);
dotenv.config();
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
        console.log("image upload response data: ", imageUpload.data);
        if (imageUpload.success) {
            console.log("image uploaded successfully, posting with image next.");
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
            console.log("Posted successfully, posting reply with Node url next.");
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
        }
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const db = yield setupDatabase();
        const nodeId = yield getNextScheduledNodeId(db);
        if (!nodeId) {
            yield db.close();
            console.log("Scheduled node ids table is empty, db closed, exiting main");
            return;
        }
        console.log("Picked a node id from table: ", nodeId);
        const alreadyPosted = yield isNodePosted(db, nodeId);
        if (!alreadyPosted) {
            try {
                const nodeUrl = `https://digital.denverlibrary.org/nodes/view/${nodeId}`;
                const scrapedData = yield scrapeNodePage(nodeUrl);
                if (!scrapedData) {
                    console.log("Scraping failed. Exiting main.");
                    return;
                }
                const imagePath = path.resolve(__dirname, "downloaded_image.jpg");
                const resizedPath = yield processImage(scrapedData.imageUrl, __dirname);
                if (process.env.BLUESKY_USERNAME &&
                    process.env.BLUESKY_PASSWORD &&
                    resizedPath &&
                    scrapedData) {
                    yield postToBluesky(resizedPath, scrapedData);
                    yield savePostedNode(db, nodeId);
                    yield deleteScheduledNodeId(db, nodeId);
                }
                else {
                    console.log("No BSKY credentials?", process.env.BLUESKY_USERNAME);
                }
                fs.unlinkSync(imagePath);
            }
            catch (error) {
                console.error("Failed to post image to Bluesky:", error);
            }
        }
        else {
            console.log(`Tried to post a duplicate node id ${nodeId}, exiting main.`);
        }
        yield db.close();
        console.log("db closed, exiting main");
        return;
    });
}
main();
