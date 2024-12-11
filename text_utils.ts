import { ScrapedData } from "./types";
import { decode } from "html-entities";

export function truncate(text: string, maxChars: number) {
  return text.length > maxChars ? text.slice(0, maxChars) + "... " : text;
}

export function composePostText({
  title,
  imageDate,
  summary,
  altSummary,
}: ScrapedData) {
  // Node title | Node date | Node summary
  // Max 300 chars
  // "Last bivouac at Camp Hale... | 1940-1945 | 10th Mountain Division soldiers rest..."
  const dateSeparator = ` | ${imageDate && imageDate + " | "}`; // image date is a varied string, might be long
  const text =
    truncate(decode(title), 50) +
    dateSeparator +
    (truncate(decode(summary), 240 - dateSeparator.length) ??
      truncate(decode(altSummary), 240 - dateSeparator.length));
  // console.log("Composed post text: ", text);
  return text;
}
