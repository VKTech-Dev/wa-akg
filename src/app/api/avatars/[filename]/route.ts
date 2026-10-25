import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

const AVATARS_DIR = path.join(process.cwd(), "data", "avatars");

/**
 * Extract sessionId from avatar filename.
 * Format: {sessionId}-{hash}.jpg
 * e.g. "marketing-1-0123456789abcdef.jpg" -> "marketing-1"
 */
function extractSessionId(filename: string): string | null {
    const base = filename.replace(/\.[^.]+$/, "");
    const lastDash = base.lastIndexOf("-");
    if (lastDash <= 0) return null;
    return base.substring(0, lastDash);
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        // 1. Authentication check — require authenticated session or API key
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
        }

        const { filename } = await params;

        // 2. Security: Directory traversal prevention
        if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
            return NextResponse.json({ status: false, message: "Invalid filename", error: "Invalid filename" }, { status: 400 });
        }

        // 3. Session ownership check — extract sessionId from filename
        const sessionId = extractSessionId(filename);
        if (!sessionId) {
            if (user.role !== "SUPERADMIN") {
                return NextResponse.json({ status: false, message: "Forbidden - Invalid avatar identifier", error: "Forbidden" }, { status: 403 });
            }
        } else {
            const canAccess = await canAccessSession(user.id, user.role, sessionId);
            if (!canAccess) {
                return NextResponse.json({ status: false, message: "Forbidden - Cannot access this session's avatars", error: "Forbidden - Cannot access this session's avatars" }, { status: 403 });
            }
        }

        const filePath = path.join(AVATARS_DIR, filename);

        // 4. Ensure resolved path is still strictly within AVATARS_DIR
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(path.resolve(AVATARS_DIR) + path.sep) && resolvedPath !== path.resolve(AVATARS_DIR)) {
            return NextResponse.json({ status: false, message: "Access denied", error: "Access denied" }, { status: 403 });
        }

        // 5. File existence and non-.none check: return 404 if file does not exist or is .none marker
        if (filename.endsWith(".none") || !existsSync(filePath)) {
            return NextResponse.json({ status: false, message: "File not found", error: "File not found" }, { status: 404 });
        }

        const fileBuffer = await readFile(filePath);

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": "image/jpeg",
                "Content-Disposition": `inline; filename="${filename}"`,
                "Cache-Control": "private, max-age=86400",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : "Failed to serve avatar";
        logger.error("Avatars", "Avatar serve error:", error);
        return NextResponse.json({ status: false, message: "Failed to serve avatar", error: errMsg }, { status: 500 });
    }
}

