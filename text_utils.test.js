import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { composePostText } from "./dist/text_utils.js";

describe("Utility functions", () => {
  describe("Text utils", () => {
    it("should make post text properly", () => {
      const title = "A very, super, ultra long title text for the test photo";
      const imageDate = "1900 - 1910";
      const summary =
        "A summary of the photo to be used in the post description. It is very long and contains three sentences. This is the third sentence and it contains quite a few extra characters so it requires truncation and goes beyond the character limit of 300 characters.";
      const altSummary = "An alt summary";
      const result = composePostText({ title, imageDate, summary, altSummary });
      const expected =
        "A very, super, ultra long title text for the test ...  | 1900 - 1910 | A summary of the photo to be used in the post description. It is very long and contains three sentences. This is the third sentence and it contains quite a few extra characters so it requires truncation and goes beyond the ... ";
      assert.equal(result, expected);
      assert.equal(result.length, 298);
    });

    it("should make post text properly without a date", () => {
      const title = "A very, super, ultra long title text for the test photo";
      const imageDate = "";
      const summary =
        "A summary of the photo to be used in the post description. It is very long and contains three sentences. This is the third sentence and it contains quite a few extra characters so it requires truncation and goes beyond the character limit of 300 characters.";
      const altSummary = "An alt summary";
      const result = composePostText({
        title,
        imageDate,
        summary,
        altSummary,
      });
      const expected =
        "A very, super, ultra long title text for the test ...  | A summary of the photo to be used in the post description. It is very long and contains three sentences. This is the third sentence and it contains quite a few extra characters so it requires truncation and goes beyond the character limi... ";
      assert.strictEqual(result, expected);
      assert.equal(result.length, 298);
    });
  });
});
