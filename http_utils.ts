import axios, { type AxiosInstance } from "axios";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DPL_ORIGIN = "https://digital.denverlibrary.org";

/**
 * Axios instance with browser-like headers to avoid 403 from sites that block
 * non-browser User-Agents (e.g. digital.denverlibrary.org).
 */
export const browserAxios: AxiosInstance = axios.create({
  headers: {
    "User-Agent": BROWSER_USER_AGENT,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: `${DPL_ORIGIN}/`,
  },
});
