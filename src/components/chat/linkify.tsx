import { Fragment, type ReactNode } from "react";

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const TRAILING = /[.,;:!?)\]}*_]+$/;

/**
 * Splits text into plain parts and http(s) links. Trailing punctuation that is
 * not part of the address ("see https://x.com.") stays outside the link.
 */
export function splitLinks(text: string): Array<{ text: string; href?: string }> {
    const parts: Array<{ text: string; href?: string }> = [];
    let last = 0;
    for (const m of text.matchAll(URL_RE)) {
        const start = m.index ?? 0;
        let url = m[1];
        const trail = url.match(TRAILING)?.[0] ?? "";
        if (trail) url = url.slice(0, url.length - trail.length);
        if (!url) continue;
        if (start > last) parts.push({ text: text.slice(last, start) });
        parts.push({ text: url, href: /^www\./i.test(url) ? `https://${url}` : url });
        last = start + url.length;
    }
    if (last < text.length) parts.push({ text: text.slice(last) });
    return parts;
}

export function Linkify({ text }: { text: string }): ReactNode {
    return (
        <>
            {splitLinks(text).map((p, i) =>
                p.href ? (
                    <a
                        key={i}
                        href={p.href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="underline underline-offset-2 hover:opacity-80"
                        onClick={e => e.stopPropagation()}
                    >
                        {p.text}
                    </a>
                ) : (
                    <Fragment key={i}>{p.text}</Fragment>
                )
            )}
        </>
    );
}
