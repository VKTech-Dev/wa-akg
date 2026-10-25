import fs, { existsSync, mkdirSync } from "fs";
import path from "path";
import type { WASocket } from "@whiskeysockets/baileys";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { AVATARS_DIR, avatarFileName, isAllowedAvatarHost, isAvatarFresh } from "./avatars";

const MAX_PICTURE_SIZE = 2 * 1024 * 1024; // 2 MB
const PICTURE_HOSTS = ["https://pps.whatsapp.net", "https://mmg.whatsapp.net"];

export interface NewsletterInfo {
    name?: string;
    verified: boolean;
    picture: { url?: string; directPath?: string };
}

type Raw = Record<string, any> | null | undefined;

/**
 * The shape of newsletterMetadata depends on the Baileys version: the parsed
 * form ({ name, picture.directPath }) or the raw WhatsApp one
 * ({ thread_metadata.name.text, thread_metadata.picture.direct_path }).
 * Reads both.
 */
export function readNewsletterInfo(meta: Raw): NewsletterInfo {
    const thread: Raw = meta?.thread_metadata;
    const textOf = (v: any): string | undefined =>
        typeof v === "string" ? v : typeof v?.text === "string" ? v.text : undefined;

    const name = textOf(meta?.name) || textOf(thread?.name) || undefined;
    const pic: Raw = meta?.picture || thread?.picture;
    return {
        name: name?.trim() || undefined,
        verified: (meta?.verification || thread?.verification) === "VERIFIED",
        picture: {
            url: typeof pic?.url === "string" ? pic.url : undefined,
            directPath: pic?.directPath || pic?.direct_path || undefined
        }
    };
}

/**
 * Channel (@newsletter) picture URLs are built from the directPath in the
 * metadata. Returns the candidates, trusted host first; empty if there is none.
 */
export function newsletterPictureUrls(picture?: { url?: string; directPath?: string }): string[] {
    const urls: string[] = [];
    if (picture?.url) urls.push(picture.url);
    if (picture?.directPath?.startsWith("/")) {
        for (const host of PICTURE_HOSTS) urls.push(`${host}${picture.directPath}`);
    }
    return urls.filter(isAllowedAvatarHost);
}

async function savePicture(sessionIds: string[], jid: string, urls: string[]): Promise<boolean> {
    for (const url of urls) {
        try {
            const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10000) });
            if (!res.ok) continue;
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.byteLength === 0 || buf.byteLength > MAX_PICTURE_SIZE) continue;
            for (const id of sessionIds) {
                await fs.promises.writeFile(path.join(AVATARS_DIR, avatarFileName(id, jid)), buf);
            }
            return true;
        } catch {
            // try the next host
        }
    }
    return false;
}

/**
 * Channels never show up in groupFetchAllParticipating, so they had no name and
 * no picture. Fetches both from the channel metadata: the name goes to a Contact
 * row (the chat list already reads names from there) and the picture to the
 * same avatar store used by contacts and groups.
 */
export async function syncNewsletters(sock: WASocket, sessionId: string): Promise<void> {
    try {
        const session = await prisma.session.findUnique({ where: { sessionId }, select: { id: true } });
        if (!session) return;
        const dbSessionId = session.id;

        const rows = await prisma.message.findMany({
            where: { sessionId: dbSessionId, remoteJid: { endsWith: "@newsletter" } },
            distinct: ["remoteJid"],
            select: { remoteJid: true }
        });
        if (rows.length === 0) return;

        if (!existsSync(AVATARS_DIR)) mkdirSync(AVATARS_DIR, { recursive: true });

        let named = 0;
        let pictures = 0;
        for (const { remoteJid: jid } of rows) {
            try {
                const meta = await sock.newsletterMetadata("jid", jid);
                const info = readNewsletterInfo(meta as Raw);
                if (!info.name) {
                    logger.warn("Store", `Newsletter metadata for ${jid} has no name (keys: ${meta ? Object.keys(meta).join(",") : "null"})`);
                }

                if (info.name) {
                    await prisma.contact.upsert({
                        where: { sessionId_jid: { sessionId: dbSessionId, jid } },
                        create: { sessionId: dbSessionId, jid, name: info.name, verifiedName: info.verified ? info.name : undefined },
                        update: { name: info.name }
                    });
                    named++;
                }

                const ids = [sessionId, dbSessionId];
                const fresh = ids.every(id => isAvatarFresh(path.join(AVATARS_DIR, avatarFileName(id, jid))));
                if (!fresh && await savePicture(ids, jid, newsletterPictureUrls(info.picture))) pictures++;
            } catch (e) {
                logger.warn("Store", `Newsletter ${jid} sync failed: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        logger.info("Store", `Newsletters for ${sessionId}: ${rows.length} found, ${named} named, ${pictures} pictures saved`);
    } catch (e) {
        logger.error("Store", `Newsletter sync failed for ${sessionId}`, e);
    }
}
