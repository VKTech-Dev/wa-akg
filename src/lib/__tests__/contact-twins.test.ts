import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { personJids, pickPersonName } from "../contact-twins";

describe("personJids", () => {
    it("lists the phone first, then the @lid, without repeats", () => {
        assert.deepEqual(
            personJids({ jid: "1@lid", remoteJidAlt: "5511@s.whatsapp.net", lid: "1@lid" }),
            ["5511@s.whatsapp.net", "1@lid"]
        );
        assert.deepEqual(
            personJids({ jid: "5511@s.whatsapp.net", lid: "1@lid" }),
            ["5511@s.whatsapp.net", "1@lid"]
        );
    });

    it("keeps a lone @lid", () => {
        assert.deepEqual(personJids({ jid: "1@lid" }), ["1@lid"]);
    });
});

describe("pickPersonName", () => {
    it("prefers the name saved on the phone row", () => {
        const out = pickPersonName([
            { jid: "1@lid", name: "Karol Oliveira", notify: "karol" },
            { jid: "5511@s.whatsapp.net", name: "AMOR", notify: null }
        ]);
        assert.deepEqual(out, { name: "AMOR", notify: "karol" });
    });

    it("falls back to the @lid name when the phone has none", () => {
        const out = pickPersonName([
            { jid: "5511@s.whatsapp.net", name: null, notify: null },
            { jid: "1@lid", name: "Maria", notify: null }
        ]);
        assert.equal(out.name, "Maria");
    });

    it("uses a masked name only when nothing else exists", () => {
        assert.equal(pickPersonName([{ jid: "1@lid", name: "+55 ∙∙∙∙∙∙∙∙ 46", notify: "Joana" }]).name, "Joana");
        assert.equal(pickPersonName([{ jid: "1@lid", name: "+55 ∙∙∙∙∙∙∙∙ 46", notify: null }]).name, "+55 ∙∙∙∙∙∙∙∙ 46");
    });
});
