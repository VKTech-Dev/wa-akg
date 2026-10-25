import { prisma } from "./prisma";
import { usableName } from "@/modules/whatsapp/store/contact-names";
import { avatarUrlFor } from "@/modules/whatsapp/store/avatars";

/**
 * The same person can be saved twice: as an @lid row and as a phone row, linked
 * through remoteJidAlt. Ids of the @lid rows that have a phone twin, to keep
 * them out of the contact list (the phone row stays and shows the person).
 */
export async function hiddenTwinIds(dbSessionId: string): Promise<string[]> {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT l.id
        FROM \`Contact\` l
        JOIN \`Contact\` p ON p.sessionId = l.sessionId AND p.jid = l.remoteJidAlt
        WHERE l.sessionId = ${dbSessionId} AND l.jid LIKE '%@lid'
    `;
    return rows.map(r => r.id);
}

/**
 * Phone jids whose @lid twin matches the search text, so a name saved only on
 * the hidden @lid row still finds the phone row.
 */
export async function twinPhonesMatching(dbSessionId: string, search: string): Promise<string[]> {
    const rows = await prisma.contact.findMany({
        where: {
            sessionId: dbSessionId,
            jid: { endsWith: "@lid" },
            remoteJidAlt: { not: null },
            OR: [
                { name: { contains: search } },
                { notify: { contains: search } },
                { verifiedName: { contains: search } }
            ]
        },
        select: { remoteJidAlt: true }
    });
    return rows.map(r => r.remoteJidAlt!).filter(Boolean);
}

interface PersonRow {
    jid: string;
    lid?: string | null;
    remoteJidAlt?: string | null;
}

/**
 * Every id the same person is known by, phone first: the phone is the identity,
 * the @lid is only a way to reach it.
 */
export function personJids(c: PersonRow): string[] {
    const all = [c.remoteJidAlt, c.jid, c.lid].filter((j): j is string => !!j);
    const phone = all.filter(j => j.endsWith("@s.whatsapp.net"));
    const rest = all.filter(j => !j.endsWith("@s.whatsapp.net"));
    return [...new Set([...phone, ...rest])];
}

/** Photo of the person, whichever of their ids the picture was saved under. */
export function avatarUrlForPerson(sessionId: string, c: PersonRow): string | null {
    for (const jid of personJids(c)) {
        const url = avatarUrlFor(sessionId, jid);
        if (url) return url;
    }
    return null;
}

interface NameRow {
    jid: string;
    name?: string | null;
    notify?: string | null;
}

/**
 * Name to show for one person given all their rows: a saved name on the phone
 * row first, then on the others, then pushnames. A masked name only wins when
 * nothing else exists.
 */
export function pickPersonName(rows: NameRow[]): { name: string | null; notify: string | null } {
    const phoneFirst = [...rows].sort((a, b) => Number(b.jid.endsWith("@s.whatsapp.net")) - Number(a.jid.endsWith("@s.whatsapp.net")));
    const name =
        phoneFirst.map(r => usableName(r.name)).find(Boolean) ||
        phoneFirst.map(r => usableName(r.notify)).find(Boolean) ||
        phoneFirst.map(r => r.name).find(Boolean) ||
        null;
    const notify = phoneFirst.map(r => r.notify).find(Boolean) || null;
    return { name, notify };
}

/** Rows (phone and @lid) that belong to the same person as `jid`. */
export async function personRows(dbSessionId: string, jid: string) {
    return prisma.contact.findMany({
        where: {
            sessionId: dbSessionId,
            OR: [{ jid }, { lid: jid }, { remoteJidAlt: jid }]
        },
        select: { jid: true, lid: true, remoteJidAlt: true, name: true, notify: true, verifiedName: true }
    });
}
