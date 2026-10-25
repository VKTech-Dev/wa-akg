/**
 * WhatsApp shows a hidden phone number as "+55 ∙∙∙∙∙∙∙∙ 46". That text is a
 * placeholder, not a name, and must never replace a name we already have.
 */
const MASK_CHARS = /[∙·•●]/g;

export function isMaskedName(name?: string | null): boolean {
    if (!name) return false;
    const trimmed = name.trim();
    if (!/^[+0-9\s∙·•●-]+$/.test(trimmed)) return false;
    return (trimmed.match(MASK_CHARS) || []).length >= 3;
}

/**
 * Name to write on update: undefined (keep the stored one) when empty or masked.
 */
export function usableName(name?: string | null): string | undefined {
    if (!name || isMaskedName(name)) return undefined;
    return name;
}
