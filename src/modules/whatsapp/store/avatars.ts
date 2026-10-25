import crypto from "crypto";
import fs, { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import type { WASocket } from "@whiskeysockets/baileys";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const AVATARS_DIR = path.join(process.cwd(), "data", "avatars");
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RATE_LIMIT_PAUSE_MS = 10 * 60 * 1000; // 10 minutes

// In-memory alias mapping between session slug and database CUID
const sessionAliasMap = new Map<string, string>();

export function registerSessionAlias(id1: string, id2: string): void {
    if (id1 && id2) {
        sessionAliasMap.set(id1, id2);
        sessionAliasMap.set(id2, id1);
    }
}

/**
 * Generate avatar filename: <sessionId>-<sha1(jid) 16 hex>.jpg
 */
export function avatarFileName(sessionId: string, jid: string): string {
    const hash = crypto.createHash("sha1").update(jid).digest("hex").slice(0, 16);
    return `${sessionId}-${hash}.jpg`;
}

/**
 * Generate .none marker filename: <sessionId>-<sha1(jid) 16 hex>.none
 */
export function avatarNoneFileName(sessionId: string, jid: string): string {
    const hash = crypto.createHash("sha1").update(jid).digest("hex").slice(0, 16);
    return `${sessionId}-${hash}.none`;
}

/**
 * Validate that avatar URL is HTTPS and points to .whatsapp.net or .whatsapp.com
 */
export function isAllowedAvatarHost(urlStr: string): boolean {
    try {
        const parsed = new URL(urlStr);
        if (parsed.protocol !== "https:") return false;
        const host = parsed.hostname.toLowerCase();
        return (
            host === "whatsapp.net" ||
            host.endsWith(".whatsapp.net") ||
            host === "whatsapp.com" ||
            host.endsWith(".whatsapp.com")
        );
    } catch {
        return false;
    }
}

/**
 * Check if an avatar file or .none marker is fresh (< 7 days old)
 */
export function isAvatarFresh(filePath: string, maxAgeMs = MAX_CACHE_AGE_MS): boolean {
    try {
        if (!existsSync(filePath)) return false;
        const stat = statSync(filePath);
        return Date.now() - stat.mtimeMs < maxAgeMs;
    } catch {
        return false;
    }
}

/**
 * Prioritize JIDs: recent messages first, followed by others, deduplicated.
 */
export function prioritizeJids(recentJids: string[], otherJids: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const jid of recentJids) {
        if (!jid || seen.has(jid)) continue;
        seen.add(jid);
        result.push(jid);
    }
    for (const jid of otherJids) {
        if (!jid || seen.has(jid)) continue;
        seen.add(jid);
        result.push(jid);
    }
    return result;
}

/**
 * Get avatar URL if file exists, else null.
 */
export function avatarUrlFor(sessionId: string, jid: string): string | null {
    const fileName = avatarFileName(sessionId, jid);
    const filePath = path.join(AVATARS_DIR, fileName);
    if (existsSync(filePath)) {
        return `/api/avatars/${fileName}`;
    }
    const alias = sessionAliasMap.get(sessionId);
    if (alias) {
        const aliasFileName = avatarFileName(alias, jid);
        const aliasPath = path.join(AVATARS_DIR, aliasFileName);
        if (existsSync(aliasPath)) {
            return `/api/avatars/${aliasFileName}`;
        }
    }
    return null;
}

interface SessionAvatarState {
    sessionId: string;
    dbSessionId: string | null;
    sock: WASocket;
    queue: string[];
    isProcessing: boolean;
    isStopped: boolean;
    pausedUntil: number;
    timer: NodeJS.Timeout | null;
}

interface BaileysErrorLike {
    message?: string;
    data?: { status?: number } | unknown;
    status?: number;
    output?: { statusCode?: number };
}

const sessionQueues = new Map<string, SessionAvatarState>();

function saveNoneMarker(sessionId: string, jid: string, dbSessionId?: string | null): void {
    try {
        const jpgPath = path.join(AVATARS_DIR, avatarFileName(sessionId, jid));
        const nonePath = path.join(AVATARS_DIR, avatarNoneFileName(sessionId, jid));
        if (existsSync(jpgPath)) {
            try { unlinkSync(jpgPath); } catch {}
        }
        writeFileSync(nonePath, "");

        if (dbSessionId && dbSessionId !== sessionId) {
            const dbJpgPath = path.join(AVATARS_DIR, avatarFileName(dbSessionId, jid));
            const dbNonePath = path.join(AVATARS_DIR, avatarNoneFileName(dbSessionId, jid));
            if (existsSync(dbJpgPath)) {
                try { unlinkSync(dbJpgPath); } catch {}
            }
            writeFileSync(dbNonePath, "");
        }
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.warn("Avatars", `Error saving .none marker for ${jid}: ${msg}`);
    }
}

function deleteAvatarFiles(sessionId: string, jid: string, dbSessionId?: string | null): void {
    const paths = [
        path.join(AVATARS_DIR, avatarFileName(sessionId, jid)),
        path.join(AVATARS_DIR, avatarNoneFileName(sessionId, jid)),
    ];
    if (dbSessionId && dbSessionId !== sessionId) {
        paths.push(
            path.join(AVATARS_DIR, avatarFileName(dbSessionId, jid)),
            path.join(AVATARS_DIR, avatarNoneFileName(dbSessionId, jid))
        );
    }
    for (const p of paths) {
        try {
            if (existsSync(p)) unlinkSync(p);
        } catch {}
    }
}

function requeueJidAtFront(sessionId: string, jid: string): void {
    const state = sessionQueues.get(sessionId);
    if (!state) return;
    state.queue = [jid, ...state.queue.filter(item => item !== jid)];
    if (!state.isProcessing && !state.isStopped) {
        void processQueue(sessionId);
    }
}

async function fetchAndSaveAvatar(state: SessionAvatarState, jid: string): Promise<void> {
    const { sessionId, dbSessionId, sock } = state;
    const jpgPath = path.join(AVATARS_DIR, avatarFileName(sessionId, jid));
    const nonePath = path.join(AVATARS_DIR, avatarNoneFileName(sessionId, jid));

    // Skip if cached recently (< 7 days)
    if (isAvatarFresh(jpgPath) || isAvatarFresh(nonePath)) {
        return;
    }

    let targetJid = jid;
    if (jid.endsWith("@lid") && dbSessionId) {
        try {
            const contact = await prisma.contact.findFirst({
                where: { sessionId: dbSessionId, jid },
                select: { remoteJidAlt: true }
            });
            if (contact?.remoteJidAlt && contact.remoteJidAlt.endsWith("@s.whatsapp.net")) {
                targetJid = contact.remoteJidAlt;
            }
        } catch {}
    }

    let ppUrl: string | undefined;
    try {
        ppUrl = await sock.profilePictureUrl(targetJid, "preview");
    } catch (err: unknown) {
        const errorObj = err as BaileysErrorLike;
        const errMsg = String(errorObj?.message || errorObj?.data || err || "").toLowerCase();
        const statusCode =
            errorObj?.status ||
            errorObj?.output?.statusCode ||
            (typeof errorObj?.data === "object" && errorObj?.data !== null && "status" in errorObj.data
                ? (errorObj.data as { status?: number }).status
                : undefined);

        // Rate limit: pause for 10 minutes and requeue
        if (statusCode === 429 || errMsg.includes("rate-overlimit") || errMsg.includes("429")) {
            logger.warn("Avatars", `Rate limit hit for session ${sessionId}. Pausing queue for 10 minutes.`);
            state.pausedUntil = Date.now() + RATE_LIMIT_PAUSE_MS;
            state.queue.unshift(jid);
            return;
        }

        // No photo: record .none marker
        if (
            statusCode === 401 ||
            statusCode === 404 ||
            errMsg.includes("item-not-found") ||
            errMsg.includes("not-authorized")
        ) {
            saveNoneMarker(sessionId, jid, dbSessionId);
            return;
        }

        // If targetJid was LID and failed, try remoteJidAlt if not already tried
        if (targetJid === jid && jid.endsWith("@lid") && dbSessionId) {
            try {
                const contact = await prisma.contact.findFirst({
                    where: { sessionId: dbSessionId, jid },
                    select: { remoteJidAlt: true }
                });
                if (contact?.remoteJidAlt && contact.remoteJidAlt !== jid) {
                    try {
                        ppUrl = await sock.profilePictureUrl(contact.remoteJidAlt, "preview");
                    } catch {}
                }
            } catch {}
        }

        if (!ppUrl) {
            const errStr = errorObj?.message || String(err);
            logger.warn("Avatars", `Failed to get profilePictureUrl for ${jid}: ${errStr}`);
            return;
        }
    }

    if (!ppUrl) {
        saveNoneMarker(sessionId, jid, dbSessionId);
        return;
    }

    if (!isAllowedAvatarHost(ppUrl)) {
        logger.warn("Avatars", `Untrusted host in avatar URL for ${jid}: ${ppUrl}`);
        return;
    }

    try {
        // redirect "error": a redirect could otherwise leave the allowed WhatsApp hosts
        const response = await fetch(ppUrl, { redirect: "error", signal: AbortSignal.timeout(10000) });
        if (!response.ok) {
            if (response.status === 404 || response.status === 401) {
                saveNoneMarker(sessionId, jid, dbSessionId);
            } else if (response.status === 429) {
                logger.warn("Avatars", `Rate limit hit fetching avatar image for ${jid}. Pausing queue.`);
                state.pausedUntil = Date.now() + RATE_LIMIT_PAUSE_MS;
                state.queue.unshift(jid);
            } else {
                logger.warn("Avatars", `HTTP error ${response.status} fetching avatar for ${jid}`);
            }
            return;
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_AVATAR_SIZE) {
            logger.warn("Avatars", `Avatar for ${jid} exceeds 2MB (${arrayBuffer.byteLength} bytes)`);
            return;
        }

        const buffer = Buffer.from(arrayBuffer);
        await fs.promises.writeFile(jpgPath, buffer);
        if (existsSync(nonePath)) {
            try { unlinkSync(nonePath); } catch {}
        }

        if (dbSessionId && dbSessionId !== sessionId) {
            const dbJpgPath = path.join(AVATARS_DIR, avatarFileName(dbSessionId, jid));
            const dbNonePath = path.join(AVATARS_DIR, avatarNoneFileName(dbSessionId, jid));
            try {
                await fs.promises.writeFile(dbJpgPath, buffer);
                if (existsSync(dbNonePath)) unlinkSync(dbNonePath);
            } catch {}
        }
    } catch (err: unknown) {
        const errStr = err instanceof Error ? err.message : String(err);
        logger.warn("Avatars", `Failed to download avatar image for ${jid}: ${errStr}`);
    }
}

async function processQueue(sessionId: string): Promise<void> {
    const state = sessionQueues.get(sessionId);
    if (!state || state.isProcessing || state.isStopped) return;
    state.isProcessing = true;

    try {
        while (state.queue.length > 0 && !state.isStopped) {
            if (Date.now() < state.pausedUntil) {
                const waitMs = state.pausedUntil - Date.now();
                await new Promise(r => setTimeout(r, waitMs));
                if (state.isStopped) break;
            }

            const jid = state.queue.shift();
            if (!jid) continue;

            await fetchAndSaveAvatar(state, jid);

            if (state.queue.length > 0 && !state.isStopped) {
                // Random delay between 2 and 4 seconds
                const delay = Math.floor(Math.random() * 2001) + 2000;
                await new Promise(r => setTimeout(r, delay));
            }
        }
    } finally {
        state.isProcessing = false;
    }
}

async function initSessionQueue(sessionId: string): Promise<void> {
    const state = sessionQueues.get(sessionId);
    if (!state || state.isStopped) return;

    try {
        // Resolve database session ID (cuid)
        const session = await prisma.session.findFirst({
            where: { OR: [{ sessionId }, { id: sessionId }] },
            select: { id: true, sessionId: true }
        });

        if (session) {
            state.dbSessionId = session.id;
            registerSessionAlias(session.id, session.sessionId);
        }

        const dbSessionId = state.dbSessionId;
        let recentJids: string[] = [];
        let otherJids: string[] = [];

        if (dbSessionId) {
            try {
                const rows = await prisma.$queryRaw<Array<{ remoteJid: string }>>`
                    SELECT remoteJid, MAX(timestamp) as max_ts
                    FROM \`Message\`
                    WHERE sessionId = ${dbSessionId}
                    GROUP BY remoteJid
                    ORDER BY max_ts DESC
                `;
                recentJids = rows.map(r => r.remoteJid).filter(Boolean);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                logger.warn("Avatars", `Could not query recent messages for ${sessionId}: ${msg}`);
            }

            try {
                const [contacts, groups] = await Promise.all([
                    prisma.contact.findMany({
                        where: { sessionId: dbSessionId },
                        select: { jid: true }
                    }),
                    prisma.group.findMany({
                        where: { sessionId: dbSessionId },
                        select: { jid: true }
                    })
                ]);
                otherJids = [
                    ...contacts.map(c => c.jid),
                    ...groups.map(g => g.jid)
                ];
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                logger.warn("Avatars", `Could not query contacts/groups for ${sessionId}: ${msg}`);
            }
        }

        const prioritized = prioritizeJids(recentJids, otherJids);
        state.queue = prioritized;
        logger.info("Avatars", `Initialized avatar sync queue for session ${sessionId} (${prioritized.length} targets)`);

        void processQueue(sessionId);
    } catch (e: unknown) {
        logger.error("Avatars", `Failed to initialize avatar sync queue for session ${sessionId}:`, e);
    }
}

/**
 * Bind avatar synchronization to socket events for a WhatsApp session.
 */
export function bindAvatarSync(sock: WASocket, sessionId: string): void {
    if (!existsSync(AVATARS_DIR)) {
        mkdirSync(AVATARS_DIR, { recursive: true });
    }

    // Clean up existing state if re-binding
    const existing = sessionQueues.get(sessionId);
    if (existing) {
        existing.isStopped = true;
        if (existing.timer) clearTimeout(existing.timer);
    }

    const state: SessionAvatarState = {
        sessionId,
        dbSessionId: null,
        sock,
        queue: [],
        isProcessing: false,
        isStopped: false,
        pausedUntil: 0,
        timer: null
    };

    sessionQueues.set(sessionId, state);

    // Start sync 30 seconds after connection opens
    state.timer = setTimeout(() => {
        void initSessionQueue(sessionId);
    }, 30000);

    // Listen for contacts.update events
    sock.ev.on("contacts.update", (updates) => {
        for (const update of updates) {
            if (!update.id) continue;
            if (update.imgUrl === "changed") {
                deleteAvatarFiles(sessionId, update.id, state.dbSessionId);
                requeueJidAtFront(sessionId, update.id);
            } else if (update.imgUrl === "removed") {
                saveNoneMarker(sessionId, update.id, state.dbSessionId);
            }
        }
    });

    // Cleanup on connection close
    sock.ev.on("connection.update", (update) => {
        if (update.connection === "close") {
            const current = sessionQueues.get(sessionId);
            if (current) {
                current.isStopped = true;
                if (current.timer) clearTimeout(current.timer);
                sessionQueues.delete(sessionId);
            }
        }
    });
}

