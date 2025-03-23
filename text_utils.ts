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
            Structure this historical information for a photo description with two or three parts. The format will look like: title | date | details
            - 1. A title of roughly 15 to 20 characters. Do not include a date or any punctuation in this part.
            - 2. Optionally, the date, if given. If a date is known, precede and follow it by a vertical bar for separation. Otherwise only use one bar for separation.
            - 3. The third part is any remaining details, with no information or word repetition and no offensive language.
            Here is the information to use:
            ${title} ${imageDate} ${summary} ${altSummary}

            Now, remove any line or paragraph breaking characters, or extraneous punctuation
            Next, extract and append two short social media friendly hashtags to the end. They must be relevant
            to the content, such as a city (no state), year, decade, or what is being described in the text (e.g., #ColoradoSprings, #1890s, #mountains).
            These tags do not count towards the 290 characters and must not include "#Colorado".
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
