import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { splitLinks } from "../linkify";

describe("splitLinks", () => {
    it("finds links inside text, keeping the rest", () => {
        const out = splitLinks("Compre aqui: https://meli.la/2gDXxzX\nOutra linha");
        assert.deepEqual(out, [
            { text: "Compre aqui: " },
            { text: "https://meli.la/2gDXxzX", href: "https://meli.la/2gDXxzX" },
            { text: "\nOutra linha" }
        ]);
    });

    it("leaves trailing punctuation outside the link", () => {
        const out = splitLinks("veja https://x.com/a.");
        assert.deepEqual(out.at(-1), { text: "." });
        assert.equal(out[1].href, "https://x.com/a");
    });

    it("adds https to www links", () => {
        assert.equal(splitLinks("www.site.com")[0].href, "https://www.site.com");
    });

    it("keeps plain text untouched", () => {
        assert.deepEqual(splitLinks("sem link"), [{ text: "sem link" }]);
    });
});
