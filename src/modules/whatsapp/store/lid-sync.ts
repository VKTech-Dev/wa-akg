import { prisma } from "@/lib/prisma";
import type { WASocket } from "@whiskeysockets/baileys";
import { logger } from "@/lib/logger";
import { usableName } from "./contact-names";

const BATCH_SIZE = 200;

interface NameFields {
    name?: string | null;
    notify?: string | null;
}

export interface TwinNameUpdates {
    lid: { name?: string; notify?: string };
    pn: { name?: string; notify?: string };
}

/** "5562981634065:12@s.whatsapp.net" -> "5562981634065@s.whatsapp.net" */
export function toPhoneJid(pn: string): string {
    const user = pn.split("@")[0].split(":")[0];
    return `${user}@s.whatsapp.net`;
}

/**
 * The same person can exist as an @lid row and as a phone row, each knowing a
 * different piece (usually the pushname on the @lid and the saved name on the
 * phone). Fills only what is empty on each side; never overwrites.
 */
export function mergeTwinNames(lid: NameFields, pn: NameFields): TwinNameUpdates {
    const out: TwinNameUpdates = { lid: {}, pn: {} };

    const lidName = usableName(lid.name);
    const pnName = usableName(pn.name);
    const lidNotify = lid.notify || undefined;
    const pnNotify = pn.notify || undefined;

    if (!pnNotify && lidNotify) out.pn.notify = lidNotify;
    if (!lidNotify && pnNotify) out.lid.notify = pnNotify;

    if (!pnName) {
        const best = lidName || lidNotify;
        if (best) out.pn.name = best;
    }
    if (!lidName) {
        const best = pnName || pnNotify;
        if (best) out.lid.name = best;
    }

    return out;
}

function isEmpty(obj: object): boolean {
    return Object.keys(obj).length === 0;
}

async function applyPair(dbSessionId: string, lidJid: string, pnJidRaw: string): Promise<boolean> {
    const pnJid = toPhoneJid(pnJidRaw);

    const [lidRow, pnRow] = await Promise.all([
        prisma.contact.findUnique({ where: { sessionId_jid: { sessionId: dbSessionId, jid: lidJid } } }),
        prisma.contact.findUnique({ where: { sessionId_jid: { sessionId: dbSessionId, jid: pnJid } } })
    ]);

    let changed = false;

    const lidData: Record<string, string> = {};
    const pnData: Record<string, string> = {};

    if (lidRow && lidRow.remoteJidAlt !== pnJid) lidData.remoteJidAlt = pnJid;
    if (pnRow && pnRow.lid !== lidJid) pnData.lid = lidJid;

    if (lidRow && pnRow) {
        const merged = mergeTwinNames(lidRow, pnRow);
        Object.assign(lidData, merged.lid);
        Object.assign(pnData, merged.pn);
    }

    if (lidRow && !isEmpty(lidData)) {
        await prisma.contact.update({ where: { id: lidRow.id }, data: lidData });
        changed = true;
    }
    if (pnRow && !isEmpty(pnData)) {
        await prisma.contact.update({ where: { id: pnRow.id }, data: pnData });
        changed = true;
    }
    return changed;
}

async function backfill(sock: WASocket, dbSessionId: string, sessionId: string): Promise<void> {
    let linked = 0;

    // phone contacts that already carry their @lid (saved by contacts.upsert):
    // no socket needed, and it is what carries the agenda name to the @lid row
    const known = await prisma.contact.findMany({
        where: { sessionId: dbSessionId, jid: { endsWith: "@s.whatsapp.net" }, lid: { not: null } },
        select: { jid: true, lid: true }
    });
    for (const c of known) {
        if (c.lid && await applyPair(dbSessionId, c.lid, c.jid)) linked++;
    }

    const store = sock.signalRepository?.lidMapping;
    if (!store) {
        logger.info("Store", `LID backfill for ${sessionId}: ${known.length} known pairs, ${linked} updated (no mapping store)`);
        return;
    }

    // @lid contacts that do not know their phone yet
    const lids = await prisma.contact.findMany({
        where: { sessionId: dbSessionId, jid: { endsWith: "@lid" }, remoteJidAlt: null },
        select: { jid: true }
    });
    for (let i = 0; i < lids.length; i += BATCH_SIZE) {
        const batch = lids.slice(i, i + BATCH_SIZE).map(c => c.jid);
        const pairs = await store.getPNsForLIDs(batch);
        for (const pair of pairs || []) {
            if (await applyPair(dbSessionId, pair.lid, pair.pn)) linked++;
        }
    }

    // phone contacts that do not know their @lid yet
    const pns = await prisma.contact.findMany({
        where: { sessionId: dbSessionId, jid: { endsWith: "@s.whatsapp.net" }, lid: null },
        select: { jid: true }
    });
    for (let i = 0; i < pns.length; i += BATCH_SIZE) {
        const batch = pns.slice(i, i + BATCH_SIZE).map(c => c.jid);
        const pairs = await store.getLIDsForPNs(batch);
        for (const pair of pairs || []) {
            if (await applyPair(dbSessionId, pair.lid, pair.pn)) linked++;
        }
    }

    logger.info("Store", `LID backfill for ${sessionId}: ${known.length} known pairs, ${lids.length} @lid and ${pns.length} phone contacts checked, ${linked} updated`);
}

/**
 * Links each @lid contact to its phone number (remoteJidAlt) and the phone
 * contact to its @lid, using the mapping Baileys already keeps in the session
 * keys, and shares names between the two rows. Runs once per connection, then
 * follows 'lid-mapping.update'.
 */
export function bindLidSync(sock: WASocket, sessionId: string): void {
    let dbSessionId: string | null = null;

    const ensureSession = async (): Promise<string | null> => {
        if (dbSessionId) return dbSessionId;
        const session = await prisma.session.findUnique({ where: { sessionId }, select: { id: true } });
        dbSessionId = session?.id ?? null;
        return dbSessionId;
    };

    sock.ev.on("lid-mapping.update", async ({ lid, pn }) => {
        try {
            const id = await ensureSession();
            if (!id) return;
            await applyPair(id, lid, pn);
        } catch (e) {
            logger.error("Store", `LID update failed for ${lid}`, e);
        }
    });

    void (async () => {
        try {
            const id = await ensureSession();
            if (!id) return;
            await backfill(sock, id, sessionId);
        } catch (e) {
            logger.error("Store", `LID backfill failed for ${sessionId}`, e);
        }
    })();
}
