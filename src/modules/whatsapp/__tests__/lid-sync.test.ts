import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeTwinNames, toPhoneJid } from "../store/lid-sync";

describe("toPhoneJid", () => {
    it("drops the device part", () => {
        assert.equal(toPhoneJid("5562981634065:12@s.whatsapp.net"), "5562981634065@s.whatsapp.net");
    });

    it("keeps a plain phone jid", () => {
        assert.equal(toPhoneJid("5562981634065@s.whatsapp.net"), "5562981634065@s.whatsapp.net");
    });
});

describe("mergeTwinNames", () => {
    it("gives the phone row the name known only on the @lid row", () => {
        const out = mergeTwinNames({ name: null, notify: "Bruno Rezende" }, { name: null, notify: null });
        assert.deepEqual(out.pn, { notify: "Bruno Rezende", name: "Bruno Rezende" });
        assert.deepEqual(out.lid, {});
    });

    it("gives the @lid row the saved name known only on the phone row", () => {
        const out = mergeTwinNames({ name: null, notify: null }, { name: "Carlos Eduardo", notify: null });
        assert.deepEqual(out.lid, { name: "Carlos Eduardo" });
        assert.deepEqual(out.pn, {});
    });

    it("never overwrites an existing name", () => {
        const out = mergeTwinNames({ name: "Ana", notify: "ana!" }, { name: "Ana Souza", notify: "Ana S" });
        assert.deepEqual(out, { lid: {}, pn: {} });
    });

    it("treats a masked name as empty", () => {
        const out = mergeTwinNames({ name: "+55 ∙∙∙∙∙∙∙∙ 46", notify: "Maria" }, { name: "Maria Silva", notify: null });
        assert.deepEqual(out.lid, { name: "Maria Silva" });
        assert.deepEqual(out.pn, { notify: "Maria" });
    });

    it("does nothing when neither side has a name", () => {
        assert.deepEqual(mergeTwinNames({}, {}), { lid: {}, pn: {} });
    });
});
