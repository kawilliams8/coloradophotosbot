import axios from "axios";
import * as cheerio from "cheerio";
import { ScrapedData } from "./types";
import { browserAxios } from "./http_utils.js";

export async function scrapeNodePage(
  url: string,
): Promise<ScrapedData | undefined> {
  try {
    // Fetch the HTML of the page (browser-like headers to avoid 403)
    const { data } = await browserAxios.get(url);

    // Load HTML into cheerio to parse with JQuery-style methods
    const $ = cheerio.load(data);
    const title = $('meta[property="og:title"]').attr("content") ?? "";
    const imageUrl = $('meta[property="og:image"]').attr("content") ?? "";
    const nodeUrl = $('meta[property="og:url"]').attr("content") ?? "";
    const description =
      $('meta[property="og:description"]').attr("content") ?? "";

    const imageDate =
      $(".titlelabel")
        .filter(function () {
          return $(this).text().trim() === "Date";
        })
        .parent()
        .text()
        .replace(/^Date\s*/, "") ?? ""; // Strip off "Date"

    const summary =
      $(".titlelabel")
        .filter(function () {
          return $(this).text().trim() === "Summary";
        })
        .parent()
        .text()
        .replace(/^Summary\s*/, "") ?? ""; // Strip off "Summary"

    const altSummary =
      $(".titlelabel")
        .filter(function () {
          return $(this).text().trim() === "Alternate Title";
        })
        .parent()
        .text()
        .replace(/^Alternate Title\s*/, "") ?? ""; // Strip off "Alternate Title"

    return {
      title,
      imageUrl,
      imageDate,
      summary,
      altSummary,
      nodeUrl,
      description,
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      console.error(
        "Error scraping the page: 403 Forbidden. The site may be blocking " +
          "cloud/datacenter IPs (e.g. GitHub Actions). Try running the bot from " +
          "a local machine or residential network, or contact Denver Public Library " +
          "about programmatic access.",
        error,
      );
    } else {
      console.error("Error scraping the page:", error);
    }
    return undefined;
  }
}
