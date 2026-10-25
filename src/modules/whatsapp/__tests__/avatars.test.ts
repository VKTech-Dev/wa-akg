import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
    avatarFileName,
    avatarNoneFileName,
    isAllowedAvatarHost,
    isAvatarFresh,
    isFetchableJid,
    prioritizeJids,
    avatarUrlFor,
    resolveAvatarFile,
    registerSessionAlias,
    AVATARS_DIR
} from "../store/avatars";

describe("avatarFileName & avatarNoneFileName", () => {
    it("generates deterministic 16-hex sha1 filename with session prefix", () => {
        const jid = "5511999999999@s.whatsapp.net";
        const expectedHash = crypto.createHash("sha1").update(jid).digest("hex").slice(0, 16);

        const name = avatarFileName("session1", jid);
        assert.equal(name, `session1-${expectedHash}.jpg`);

        const noneName = avatarNoneFileName("session1", jid);
        assert.equal(noneName, `session1-${expectedHash}.none`);
    });

    it("handles groups and lid JIDs properly", () => {
        const groupJid = "120363025123456789@g.us";
        const lidJid = "98765432109876@lid";

        const groupHash = crypto.createHash("sha1").update(groupJid).digest("hex").slice(0, 16);
        const lidHash = crypto.createHash("sha1").update(lidJid).digest("hex").slice(0, 16);

        assert.equal(avatarFileName("s2", groupJid), `s2-${groupHash}.jpg`);
        assert.equal(avatarFileName("s2", lidJid), `s2-${lidHash}.jpg`);
    });
});

describe("isAllowedAvatarHost", () => {
    it("accepts valid https URLs from whatsapp.net and whatsapp.com", () => {
        assert.equal(isAllowedAvatarHost("https://pps.whatsapp.net/v/t61.24694-24/test.jpg"), true);
        assert.equal(isAllowedAvatarHost("https://mmg.whatsapp.net/mms/image/test.jpg"), true);
        assert.equal(isAllowedAvatarHost("https://media.whatsapp.com/test.jpg"), true);
        assert.equal(isAllowedAvatarHost("https://whatsapp.net/avatar.jpg"), true);
        assert.equal(isAllowedAvatarHost("https://whatsapp.com/avatar.jpg"), true);
    });

    it("rejects non-https protocols", () => {
        assert.equal(isAllowedAvatarHost("http://pps.whatsapp.net/test.jpg"), false);
        assert.equal(isAllowedAvatarHost("ftp://pps.whatsapp.net/test.jpg"), false);
    });

    it("rejects untrusted domains and spoofed hostnames", () => {
        assert.equal(isAllowedAvatarHost("https://evil.com/test.jpg"), false);
        assert.equal(isAllowedAvatarHost("https://attacker.net/whatsapp.net/test.jpg"), false);
        assert.equal(isAllowedAvatarHost("https://evil-whatsapp.net/test.jpg"), false);
        assert.equal(isAllowedAvatarHost("https://pps.whatsapp.net.evil.com/test.jpg"), false);
        assert.equal(isAllowedAvatarHost("https://notwhatsapp.com/test.jpg"), false);
    });

    it("rejects malformed or empty inputs", () => {
        assert.equal(isAllowedAvatarHost(""), false);
        assert.equal(isAllowedAvatarHost("not a url"), false);
        assert.equal(isAllowedAvatarHost("://invalid"), false);
    });
});

describe("prioritizeJids", () => {
    it("places recent message JIDs first and deduplicates", () => {
        const recent = ["jid1@s.whatsapp.net", "jid2@s.whatsapp.net", "jid1@s.whatsapp.net"];
        const others = ["jid2@s.whatsapp.net", "jid3@s.whatsapp.net", "jid4@g.us"];

        const result = prioritizeJids(recent, others);
        assert.deepEqual(result, [
            "jid1@s.whatsapp.net",
            "jid2@s.whatsapp.net",
            "jid3@s.whatsapp.net",
            "jid4@g.us"
        ]);
    });

    it("handles empty arrays", () => {
        assert.deepEqual(prioritizeJids([], []), []);
        assert.deepEqual(prioritizeJids(["a@s.whatsapp.net"], []), ["a@s.whatsapp.net"]);
        assert.deepEqual(prioritizeJids([], ["b@g.us"]), ["b@g.us"]);
    });
});

describe("isAvatarFresh", () => {
    const testFile = path.join(AVATARS_DIR, "test-freshness.jpg");

    before(() => {
        if (!fs.existsSync(AVATARS_DIR)) {
            fs.mkdirSync(AVATARS_DIR, { recursive: true });
        }
        fs.writeFileSync(testFile, "test-data");
    });

    after(() => {
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
    });

    it("returns false for non-existent file", () => {
        assert.equal(isAvatarFresh(path.join(AVATARS_DIR, "non-existent.jpg")), false);
    });

    it("returns true for freshly created file", () => {
        assert.equal(isAvatarFresh(testFile), true);
    });

    it("returns false when file is older than maxAge", () => {
        // Set maxAgeMs to -1ms so file is immediately considered stale
        assert.equal(isAvatarFresh(testFile, -1), false);
    });
});

describe("avatarUrlFor", () => {
    const testSession = "test-session-unit";
    const testAlias = "test-alias-unit";
    const testJid = "111222333@s.whatsapp.net";
    const nonExistentJid = "444555666@s.whatsapp.net";

    const fileName = avatarFileName(testSession, testJid);
    const filePath = path.join(AVATARS_DIR, fileName);

    before(() => {
        if (!fs.existsSync(AVATARS_DIR)) {
            fs.mkdirSync(AVATARS_DIR, { recursive: true });
        }
        fs.writeFileSync(filePath, "jpeg-bytes");
    });

    after(() => {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    });

    it("returns null when avatar file does not exist", () => {
        const url = avatarUrlFor(testSession, nonExistentJid);
        assert.equal(url, null);
    });

    it("returns avatar URL when file exists", () => {
        const url = avatarUrlFor(testSession, testJid);
        assert.equal(url, `/api/avatars/${fileName}`);
    });

    it("resolves avatar via session alias if queried by alias ID", () => {
        registerSessionAlias(testSession, testAlias);
        const url = avatarUrlFor(testAlias, testJid);
        assert.equal(url, `/api/avatars/${fileName}`);
    });
});


describe("isFetchableJid", () => {
    it("accepts users, groups and lids", () => {
        assert.equal(isFetchableJid("5511999999999@s.whatsapp.net"), true);
        assert.equal(isFetchableJid("120363000000000000@g.us"), true);
        assert.equal(isFetchableJid("100429287395370@lid"), true);
    });

    it("rejects status, broadcast lists, channels and empty values", () => {
        assert.equal(isFetchableJid("status@broadcast"), false);
        assert.equal(isFetchableJid("1234567890@broadcast"), false);
        assert.equal(isFetchableJid("120363000000000000@newsletter"), false);
        assert.equal(isFetchableJid(""), false);
    });
});

describe("resolveAvatarFile", () => {
    it("returns null when no avatar file exists", () => {
        assert.equal(resolveAvatarFile("no-such-session", "0@s.whatsapp.net"), null);
    });

    it("returns the file name when the file exists", () => {
        const jid = "5511888888888@s.whatsapp.net";
        const fileName = avatarFileName("session-resolve", jid);
        const filePath = path.join(AVATARS_DIR, fileName);
        fs.mkdirSync(AVATARS_DIR, { recursive: true });
        fs.writeFileSync(filePath, "x");
        try {
            assert.equal(resolveAvatarFile("session-resolve", jid), fileName);
        } finally {
            fs.unlinkSync(filePath);
        }
    });
});
