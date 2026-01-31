import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, basename, extname } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { verifyApiAuth, unauthorizedResponse } from "@/lib/auth";

/**
 * Allowed file extensions per source type
 */
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  whatsapp: [".txt", ".zip"],
  facebook: [".json", ".zip"],
  instagram: [".json", ".zip"],
};

/**
 * Maximum file sizes per source type (in bytes)
 */
const MAX_FILE_SIZES: Record<string, number> = {
  whatsapp: 100 * 1024 * 1024, // 100MB
  facebook: 500 * 1024 * 1024, // 500MB
  instagram: 500 * 1024 * 1024, // 500MB
};

/**
 * Secure upload directory
 */
const UPLOAD_DIR = join(tmpdir(), "personal-crm-imports");

/**
 * Generate a secure filename
 */
function generateSecureFilename(originalName: string, source: string): string {
  const ext = extname(originalName).toLowerCase();
  const allowedExts = ALLOWED_EXTENSIONS[source];

  if (!allowedExts?.includes(ext)) {
    throw new Error(`Invalid file extension: ${ext}. Allowed: ${allowedExts?.join(", ")}`);
  }

  return `${randomUUID()}${ext}`;
}

/**
 * POST /api/import
 *
 * Upload a file for import
 *
 * Body: FormData with:
 * - file: The export file
 * - source: "whatsapp" | "facebook" | "instagram"
 * - userName: (optional) User's name/identifier for direction detection
 * - chatName: (optional) Name of the chat (for WhatsApp)
 */
export async function POST(request: NextRequest) {
  // Verify authentication before processing any data
  const auth = await verifyApiAuth(request);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const formData = await request.formData();

    // Validate required fields
    const file = formData.get("file");
    const source = formData.get("source");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing or invalid file" },
        { status: 400 }
      );
    }

    if (typeof source !== "string" || !ALLOWED_EXTENSIONS[source]) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${Object.keys(ALLOWED_EXTENSIONS).join(", ")}` },
        { status: 400 }
      );
    }

    // Validate file size
    const maxSize = MAX_FILE_SIZES[source];
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size for ${source}: ${maxSize / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    // Validate file extension
    let secureFilename: string;
    try {
      secureFilename = generateSecureFilename(file.name, source);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid file type" },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Write file securely
    const filePath = join(UPLOAD_DIR, secureFilename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer, { mode: 0o600 });

    // Extract optional parameters
    const userName = formData.get("userName");
    const chatName = formData.get("chatName");

    // Create import job ID
    const jobId = randomUUID();

    return NextResponse.json({
      success: true,
      jobId,
      filePath,
      source,
      originalFilename: basename(file.name),
      size: file.size,
      userName: typeof userName === "string" ? userName : undefined,
      chatName: typeof chatName === "string" ? chatName : undefined,
    });
  } catch (error) {
    console.error("[import-upload]", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/import
 *
 * Get supported import sources and their requirements
 */
export async function GET() {
  return NextResponse.json({
    sources: {
      whatsapp: {
        name: "WhatsApp",
        description: "Import WhatsApp chat exports",
        allowedExtensions: ALLOWED_EXTENSIONS.whatsapp,
        maxSizeMB: MAX_FILE_SIZES.whatsapp / 1024 / 1024,
        instructions: "Settings > Chats > Export Chat > Without Media",
      },
      facebook: {
        name: "Facebook Messenger",
        description: "Import Facebook Messenger exports",
        allowedExtensions: ALLOWED_EXTENSIONS.facebook,
        maxSizeMB: MAX_FILE_SIZES.facebook / 1024 / 1024,
        instructions:
          "Settings > Your Facebook Information > Download Your Information > Messages (JSON)",
      },
      instagram: {
        name: "Instagram DMs",
        description: "Import Instagram direct message exports",
        allowedExtensions: ALLOWED_EXTENSIONS.instagram,
        maxSizeMB: MAX_FILE_SIZES.instagram / 1024 / 1024,
        instructions:
          "Settings > Privacy and Security > Data Download > Request Download (JSON)",
      },
    },
  });
}
