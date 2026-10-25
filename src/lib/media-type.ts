export const MEDIA_MESSAGE_TYPES = [
    "imageMessage",
    "videoMessage",
    "audioMessage",
    "documentMessage",
    "stickerMessage",
] as const;

/**
 * Returns the media key of a normalized message content.
 * WhatsApp may put `messageContextInfo` (or other metadata) before the media
 * key, so the first key of the object is not a reliable type.
 */
export function findMediaMessageType(content: object | null | undefined): string | null {
    if (!content) return null;
    return Object.keys(content).find((key) => (MEDIA_MESSAGE_TYPES as readonly string[]).includes(key)) ?? null;
}
