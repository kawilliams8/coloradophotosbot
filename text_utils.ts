import { ScrapedData } from "./types";
import * as dotenv from "dotenv";
import * as process from "process";
import OpenAI from "openai";

export async function composePostText({
  title,
  imageDate,
  summary,
  altSummary,
}: ScrapedData): Promise<{ text: string; tags: string[] } | null> {
  // Node title | Node date | Node summary
  // Max 300 chars
  // "Last bivouac at Camp Hale | 1940-1945 | 10th Mountain Division soldiers rest"
  dotenv.config();

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.log("No OpenAI API Key");
      return null;
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
          content: `
            Compress the following info to no more than 295 characters, structured as:
            - A title, roughly 15 to 20 characters. Do not include a date or punctuation.
            - A vertical bar
            - The date, if known. If a date is included, follow it by a vertical bar.
            - Any remaining details, with no repetition and no offensive language.
            - No third or further vertical bar characters.
            ${title} ${imageDate} ${summary} ${altSummary}
            Next, remove any line or paragraph breaks. We want the information to flow without breaking to the next line.
            Next, extract and append two short and inoffensive social media friendly hashtags to the end. They must be relevant
            to the content, such as a city (no state), decade, or what is visible (e.g., #ColoradoSprings, #1890s, #mountains).
            These tags do not count towards the 295 characters and must not include "#Colorado".
            `,
        },
      ],
    });
    console.log("OpenAI result: ", completion.choices[0].message.content);
    const fullText = completion.choices[0]?.message?.content || "";

    const hashtagRegex = /#\w+/g;
    const tags = fullText.match(hashtagRegex) || [];
    const text = fullText.replace(hashtagRegex, "").trim();

    return { text, tags };
  } catch (error) {
    console.error("Error from OpenAI or composePostText:", error);
    return null;
  }
}
