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
            - A brief title without punctuation, around 40 characters
            - A vertical bar
            - The date of the image (if provided, or 'Undated')
            - Another vertical bar
            - Remaining details, particularly on the location, and without offensive language
            ${title} ${imageDate} ${summary} ${altSummary}
            Next, extract and append two inoffensive social media friendly hashtags relevant
            to the content at the end, such as a city or what is visible (e.g., #ColoradoSprings, #railroad).
            These tags do not count towards the 295 characters.
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
