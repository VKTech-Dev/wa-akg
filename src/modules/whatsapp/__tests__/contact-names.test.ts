import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isMaskedName, usableName } from "../store/contact-names";

describe("isMaskedName", () => {
    it("detects the hidden phone placeholder", () => {
        assert.equal(isMaskedName("+55 ∙∙∙∙∙∙∙∙ 46"), true);
        assert.equal(isMaskedName("+55 ········ 92"), true);
        assert.equal(isMaskedName("+55 •••••••• 49"), true);
    });

    it("keeps real names and plain numbers", () => {
        assert.equal(isMaskedName("Maria Silva"), false);
        assert.equal(isMaskedName("+55 62 98163 4065"), false);
        assert.equal(isMaskedName("João ∙∙∙"), false);
        assert.equal(isMaskedName(""), false);
        assert.equal(isMaskedName(null), false);
    });
});

describe("usableName", () => {
    it("returns undefined for empty or masked names", () => {
        assert.equal(usableName(undefined), undefined);
        assert.equal(usableName(""), undefined);
        assert.equal(usableName("+55 ∙∙∙∙∙∙∙∙ 46"), undefined);
    });

    it("returns real names untouched", () => {
        assert.equal(usableName("Maria Silva"), "Maria Silva");
    });
});
