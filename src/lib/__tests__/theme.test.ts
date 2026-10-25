import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { THEME_INIT_SCRIPT, THEME_KEY, nextTheme, resolveTheme } from "../theme";

describe("resolveTheme", () => {
    it("is dark by default", () => {
        assert.equal(resolveTheme(null), "dark");
        assert.equal(resolveTheme(undefined), "dark");
        assert.equal(resolveTheme("anything"), "dark");
    });

    it("respects an explicit light choice", () => {
        assert.equal(resolveTheme("light"), "light");
        assert.equal(resolveTheme("dark"), "dark");
    });
});

describe("nextTheme", () => {
    it("flips between the two", () => {
        assert.equal(nextTheme("dark"), "light");
        assert.equal(nextTheme("light"), "dark");
    });
});

describe("THEME_INIT_SCRIPT", () => {
    it("reads the same storage key and only skips dark for light", () => {
        assert.ok(THEME_INIT_SCRIPT.includes(THEME_KEY));
        assert.ok(THEME_INIT_SCRIPT.includes('!=="light"'));
    });
});
