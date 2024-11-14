export function truncate(text, maxChars) {
    return text.length > maxChars ? text.slice(0, maxChars) + "... " : text;
}
export function composePostText({ title, imageDate, summary, altSummary, }) {
    var _a;
    const dateSeparator = ` | ${imageDate} | `;
    const text = truncate(title, 50) +
        dateSeparator +
        ((_a = truncate(summary, 245 - dateSeparator.length)) !== null && _a !== void 0 ? _a : truncate(altSummary, 245 - dateSeparator.length));
    console.log("Composed post text: ", text);
    return text;
}
