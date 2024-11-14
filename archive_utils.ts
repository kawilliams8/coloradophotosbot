import axios from "axios";
import * as cheerio from "cheerio";
import { ScrapedData } from "./types";

export async function scrapeNodePage(
  url: string
): Promise<ScrapedData | undefined> {
  try {
    // Fetch the HTML of the page
    const { data } = await axios.get(url);

    // Load HTML into cheerio to parse with JQuery-style methods
    const $ = cheerio.load(data);
    const title = $('meta[property="og:title"]').attr("content") ?? "";
    const imageUrl = $('meta[property="og:image"]').attr("content") ?? "";
    const nodeUrl = $('meta[property="og:url"]').attr("content") ?? "";

    const imageDate =
      $(".titlelabel")
        .filter(function () {
          return $(this).text().trim() === "Date";
        })
        .parent()
        .text()
        .slice(4) ?? ""; // Strip off "Date"

    const summary =
      $(".titlelabel")
        .filter(function () {
          return $(this).text().trim() === "Summary";
        })
        .parent()
        .text()
        .slice(7) ?? ""; // Strip off "Summary"

    const altSummary =
      $(".titlelabel")
        .filter(function () {
          return $(this).text().trim() === "Alternate Title";
        })
        .parent()
        .text() ?? "";

    return { title, imageUrl, imageDate, summary, altSummary, nodeUrl };
  } catch (error) {
    console.error("Error scraping the page:", error);
  }
}