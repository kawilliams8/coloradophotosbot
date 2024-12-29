import { ScrapedData } from "./types";
import * as dotenv from "dotenv";
import * as process from "process";
import OpenAI from "openai";

export async function composePostText({
  title,
  imageDate,
  summary,
  altSummary,
}: ScrapedData) {
  // Node title | Node date | Node summary
  // Max 300 chars
  // "Last bivouac at Camp Hale | 1940-1945 | 10th Mountain Division soldiers rest"
  dotenv.config();

  try {
    if (!process.env.OPENAI_API_KEY) {
      return;
    }
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      store: false,
      messages: [
        {
          role: "user",
          content:
            "compress the following info to no more than 295 characters and structure it as a very brief title without punctuation, then a vertical bar, the date (if provided, or 'Undated'), then a vertical bar, then as much remaining detail as you can fit.: " +
            title +
            imageDate +
            summary +
            altSummary,
        },
      ],
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error from OpenAI or composePostText:", error);
    return "";
  }
}
