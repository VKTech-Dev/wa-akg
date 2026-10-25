import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { newsletterPictureUrls, readNewsletterInfo } from "../store/newsletters";

describe("newsletterPictureUrls", () => {
    it("builds trusted urls from the directPath", () => {
        assert.deepEqual(newsletterPictureUrls({ directPath: "/v/t61/abc.jpg" }), [
            "https://pps.whatsapp.net/v/t61/abc.jpg",
            "https://mmg.whatsapp.net/v/t61/abc.jpg"
        ]);
    });

    it("drops untrusted hosts", () => {
        assert.deepEqual(newsletterPictureUrls({ url: "https://evil.example/x.jpg" }), []);
    });

    it("returns nothing without a picture", () => {
        assert.deepEqual(newsletterPictureUrls(undefined), []);
    });
});

describe("readNewsletterInfo", () => {
    it("reads the raw WhatsApp shape", () => {
        const info = readNewsletterInfo({
            id: "1@newsletter",
            thread_metadata: { name: { text: " Ofertas " }, picture: { direct_path: "/v/t61/a.jpg" }, verification: "VERIFIED" }
        });
        assert.equal(info.name, "Ofertas");
        assert.equal(info.picture.directPath, "/v/t61/a.jpg");
        assert.equal(info.verified, true);
    });

    it("reads the parsed shape", () => {
        const info = readNewsletterInfo({ id: "1@newsletter", name: "Canal", picture: { directPath: "/v/b.jpg" } });
        assert.equal(info.name, "Canal");
        assert.equal(info.picture.directPath, "/v/b.jpg");
        assert.equal(info.verified, false);
    });

    it("returns nothing for empty metadata", () => {
        assert.deepEqual(readNewsletterInfo(null), { name: undefined, verified: false, picture: { url: undefined, directPath: undefined } });
    });
});
