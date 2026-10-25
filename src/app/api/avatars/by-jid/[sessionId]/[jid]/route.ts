import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { AVATARS_DIR, resolveAvatarFile } from "@/modules/whatsapp/store/avatars";

// GET: profile picture of a JID, looked up by session (used by the chat header)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string; jid: string }> }
) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId, jid } = await params;

        // The session id becomes part of a file name: refuse anything path-like
        if (sessionId.includes("..") || sessionId.includes("/") || sessionId.includes("\\")) {
            return NextResponse.json({ status: false, message: "Invalid session", error: "Invalid session" }, { status: 400 });
        }

        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden - Cannot access this session's avatars", error: "Forbidden - Cannot access this session's avatars" }, { status: 403 });
        }

        const fileName = resolveAvatarFile(sessionId, decodeURIComponent(jid));
        if (!fileName) {
            return NextResponse.json({ status: false, message: "File not found", error: "File not found" }, { status: 404 });
        }

        const fileBuffer = await readFile(path.join(AVATARS_DIR, fileName));

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "private, max-age=3600",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : "Failed to serve avatar";
        logger.error("Avatars", "Avatar by-jid serve error:", error);
        return NextResponse.json({ status: false, message: "Failed to serve avatar", error: errMsg }, { status: 500 });
    }
}
