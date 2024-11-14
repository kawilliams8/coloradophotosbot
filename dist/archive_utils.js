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
import * as cheerio from "cheerio";
export function scrapeNodePage(url) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        try {
            const { data } = yield axios.get(url);
            const $ = cheerio.load(data);
            const title = (_a = $('meta[property="og:title"]').attr("content")) !== null && _a !== void 0 ? _a : "";
            const imageUrl = (_b = $('meta[property="og:image"]').attr("content")) !== null && _b !== void 0 ? _b : "";
            const nodeUrl = (_c = $('meta[property="og:url"]').attr("content")) !== null && _c !== void 0 ? _c : "";
            const imageDate = (_d = $(".titlelabel")
                .filter(function () {
                return $(this).text().trim() === "Date";
            })
                .parent()
                .text()
                .slice(4)) !== null && _d !== void 0 ? _d : "";
            const summary = (_e = $(".titlelabel")
                .filter(function () {
                return $(this).text().trim() === "Summary";
            })
                .parent()
                .text()
                .slice(7)) !== null && _e !== void 0 ? _e : "";
            const altSummary = (_f = $(".titlelabel")
                .filter(function () {
                return $(this).text().trim() === "Alternate Title";
            })
                .parent()
                .text()) !== null && _f !== void 0 ? _f : "";
            return { title, imageUrl, imageDate, summary, altSummary, nodeUrl };
        }
        catch (error) {
            console.error("Error scraping the page:", error);
        }
    });
}
