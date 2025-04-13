import { ScrapedData } from "./types";
import * as dotenv from "dotenv";
import * as process from "process";
import { Anthropic } from "@anthropic-ai/sdk";

export async function composePostText({
  title,
  imageDate,
  summary,
  altSummary,
}: ScrapedData): Promise<{ text: string; tags: string[] } | null> {
  // Node title | Node date | Node summary
  // Max 300 chars
  // "Camp Hale | 1940-1945 | 10th Mountain Division soldiers rest.."
  dotenv.config();

  try {
    if (!process.env.CLAUDE_API_KEY) {
      console.log("No Claude API Key");
      return null;
    }
    const anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `
            Here is some unstructured historical information:
            ${title} ${imageDate} ${summary} ${altSummary}

            Structure this information for a photo description with no more than 290 total characters.
            The description must be one of two formats: title | date | details OR title | details.
            Please follow these rules and create the description:
            1. A title of roughly 15 characters. Do not include a date or any punctuation in this part.
            2. The photo creation date goes in second part. If you can't find that date, use the second format with no date.
            3. The third part will be any remaining details, with no repetition and no offensive language.

            Next, clean up the text and remove any line breaks or paragraph breaking characters. Remove extraneous 
            punctuation such as a double vertical bar without a date between.
            Finally, extract and append two short social media friendly hashtags to the end. They must be relevant
            to the content, such as a city (no state), county, year, decade, or what is being described in the text (e.g., #ColoradoSprings, #1890s).
            These tags do not count towards the 290 characters and must not include "#Colorado".
            `,
        },
      ],
    });
    console.log("Claude result: ", message);
    const fullText = message || "";

    const hashtagRegex = /#\w+/g;
    const tags = fullText.toString().match(hashtagRegex) || [];
    const text = fullText.toString().replace(hashtagRegex, "").trim();

    return { text, tags };
  } catch (error) {
    console.error("Error from Claude or composePostText:", error);
    return null;
  }
}
