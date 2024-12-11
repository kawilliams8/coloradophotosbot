import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { truncate, composePostText } from "./dist/text_utils.js";

describe("Utility functions", () => {
  describe("Text utils", () => {
    it("should properly truncate a long string", () => {
      const result = truncate("My very long string here", 10);
      const expected = "My very lo... ";
      assert.strictEqual(result, expected);
    });

    it("should not truncate a short string", () => {
      const result = truncate("My short string", 50);
      const expected = "My short string";
      assert.strictEqual(result, expected);
    });

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
