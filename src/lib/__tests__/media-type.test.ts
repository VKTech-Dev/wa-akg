import test from "node:test";
import assert from "node:assert/strict";
import { findMediaMessageType } from "../media-type";

test("finds the media key when it is first", () => {
    assert.equal(findMediaMessageType({ imageMessage: {} }), "imageMessage");
});

test("finds the media key after messageContextInfo", () => {
    assert.equal(findMediaMessageType({ messageContextInfo: {}, imageMessage: {} }), "imageMessage");
});

test("returns null for text and empty content", () => {
    assert.equal(findMediaMessageType({ messageContextInfo: {}, conversation: "oi" }), null);
    assert.equal(findMediaMessageType(null), null);
});
