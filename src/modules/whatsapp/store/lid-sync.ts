import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { WASocket } from "@whiskeysockets/baileys";
import { logger } from "@/lib/logger";
import { usableName } from "./contact-names";

const BATCH_SIZE = 200;
const BULK = { skipConsolidate: true };

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

/**
 * Group participants carry both ids: [{ id: "123@lid", phoneNumber: "5511...@s.whatsapp.net" }].
 * Returns the usable pairs; ignores entries missing either side.
 */
export function pairsFromParticipants(participants: unknown): Array<{ lid: string; pn: string }> {
    if (!Array.isArray(participants)) return [];
    const out: Array<{ lid: string; pn: string }> = [];
    for (const p of participants) {
        const id = typeof p?.id === "string" ? p.id : "";
        const pn = typeof p?.phoneNumber === "string" ? p.phoneNumber : "";
        if (id.endsWith("@lid") && pn.endsWith("@s.whatsapp.net")) out.push({ lid: id, pn });
    }
    return out;
}

const IS_PHONE = "l.remoteJidAlt LIKE '%@s.whatsapp.net' AND l.remoteJidAlt NOT LIKE '%:%'";

/**
 * One chat per person: everything saved under an @lid whose phone is known
 * moves to the phone jid (messages, senders, labels, scheduled messages). The
 * @lid Contact row stays, as the translation from @lid to phone. Safe to run
 * again: once moved there is nothing left to match.
 */
export async function consolidateByPhone(dbSessionId: string, only?: { lid: string; pn: string }): Promise<number> {
    const filter = only
        ? Prisma.sql`AND l.jid = ${only.lid} AND l.remoteJidAlt = ${only.pn}`
        : Prisma.empty;

    const chats = await prisma.$executeRaw`
        UPDATE \`Message\` m JOIN \`Contact\` l ON l.sessionId = m.sessionId AND l.jid = m.remoteJid
        SET m.remoteJid = l.remoteJidAlt
        WHERE m.sessionId = ${dbSessionId} AND l.jid LIKE '%@lid' AND ${Prisma.raw(IS_PHONE)} ${filter}`;

    const senders = await prisma.$executeRaw`
        UPDATE \`Message\` m JOIN \`Contact\` l ON l.sessionId = m.sessionId AND l.jid = m.senderJid
        SET m.senderJid = l.remoteJidAlt
        WHERE m.sessionId = ${dbSessionId} AND l.jid LIKE '%@lid' AND ${Prisma.raw(IS_PHONE)} ${filter}`;

    // labels: UPDATE IGNORE skips the ones the phone already has, then the leftovers go
    await prisma.$executeRaw`
        UPDATE IGNORE \`ChatLabel\` cl
        JOIN \`Label\` lb ON lb.id = cl.labelId
        JOIN \`Contact\` l ON l.sessionId = lb.sessionId AND l.jid = cl.chatJid
        SET cl.chatJid = l.remoteJidAlt
        WHERE lb.sessionId = ${dbSessionId} AND l.jid LIKE '%@lid' AND ${Prisma.raw(IS_PHONE)} ${filter}`;
    await prisma.$executeRaw`
        DELETE cl FROM \`ChatLabel\` cl
        JOIN \`Label\` lb ON lb.id = cl.labelId
        JOIN \`Contact\` l ON l.sessionId = lb.sessionId AND l.jid = cl.chatJid
        WHERE lb.sessionId = ${dbSessionId} AND l.jid LIKE '%@lid' AND ${Prisma.raw(IS_PHONE)} ${filter}`;

    await prisma.$executeRaw`
        UPDATE \`ScheduledMessage\` sm JOIN \`Contact\` l ON l.sessionId = sm.sessionId AND l.jid = sm.jid
        SET sm.jid = l.remoteJidAlt
        WHERE sm.sessionId = ${dbSessionId} AND l.jid LIKE '%@lid' AND ${Prisma.raw(IS_PHONE)} ${filter}`;

    return Number(chats) + Number(senders);
}

function isEmpty(obj: object): boolean {
    return Object.keys(obj).length === 0;
}

async function applyPair(dbSessionId: string, lidJid: string, pnJidRaw: string, live: { skipConsolidate?: boolean } = {}): Promise<boolean> {
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
    if (lidRow && !live.skipConsolidate) {
        await consolidateByPhone(dbSessionId, { lid: lidJid, pn: pnJid });
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
        if (c.lid && await applyPair(dbSessionId, c.lid, c.jid, BULK)) linked++;
    }

    // phones that group participants already told us about
    const missing = new Set(
        (await prisma.contact.findMany({
            where: { sessionId: dbSessionId, jid: { endsWith: "@lid" }, remoteJidAlt: null },
            select: { jid: true }
        })).map(c => c.jid)
    );
    if (missing.size > 0) {
        const groups = await prisma.group.findMany({ where: { sessionId: dbSessionId }, select: { participants: true } });
        for (const g of groups) {
            for (const pair of pairsFromParticipants(g.participants)) {
                if (!missing.has(pair.lid)) continue;
                missing.delete(pair.lid);
                if (await applyPair(dbSessionId, pair.lid, pair.pn, BULK)) linked++;
            }
        }
    }

    const store = sock.signalRepository?.lidMapping;
    if (!store) {
        const movedEarly = await consolidateByPhone(dbSessionId);
        logger.info("Store", `LID backfill for ${sessionId}: ${known.length} known pairs, ${linked} updated, ${movedEarly} message ids moved (no mapping store)`);
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
            if (await applyPair(dbSessionId, pair.lid, pair.pn, BULK)) linked++;
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
            if (await applyPair(dbSessionId, pair.lid, pair.pn, BULK)) linked++;
        }
    }

    const moved = await consolidateByPhone(dbSessionId);
    logger.info("Store", `LID backfill for ${sessionId}: ${known.length} known pairs, ${lids.length} @lid and ${pns.length} phone contacts checked, ${linked} updated, ${moved} message ids moved to the phone`);
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

    // Names can arrive after the backfill (contacts.update / contacts.upsert):
    // wait for the other listeners to save the row, then share it with its twin.
    const touched = new Set<string>();
    let timer: NodeJS.Timeout | null = null;
    const flush = async () => {
        timer = null;
        const jids = [...touched];
        touched.clear();
        try {
            const id = await ensureSession();
            if (!id) return;
            const rows = await prisma.contact.findMany({
                where: { sessionId: id, jid: { in: jids } },
                select: { jid: true, lid: true, remoteJidAlt: true }
            });
            for (const r of rows) {
                if (r.jid.endsWith("@lid") && r.remoteJidAlt) await applyPair(id, r.jid, r.remoteJidAlt);
                else if (r.jid.endsWith("@s.whatsapp.net") && r.lid) await applyPair(id, r.lid, r.jid);
            }
        } catch (e) {
            logger.error("Store", `LID twin merge failed for ${sessionId}`, e);
        }
    };
    const touch = (items: Array<{ id?: string | null }>) => {
        for (const c of items) if (c.id) touched.add(c.id);
        if (!timer && touched.size > 0) timer = setTimeout(() => void flush(), 3000);
    };
    sock.ev.on("contacts.update", touch);
    sock.ev.on("contacts.upsert", touch);

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
