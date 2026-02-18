import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  trimVideo,
  getTmpPath,
  cleanupTmp,
  DownloadError,
} from "@/lib/processor";
import { downloadVideoWithFallback } from "@/lib/yt-dlp-fallback";
import fs from "fs";

export const dynamic = "force-dynamic";

// Error response helper with proper typing
function createErrorResponse(error: unknown): {
  message: string;
  code: string;
  details?: string;
  guidance?: string;
  retryDelay?: number;
} {
  if (error instanceof DownloadError) {
    return {
      message: error.message,
      code: error.code,
      details: error.details,
      guidance: error.guidance, // NEW
      retryDelay: error.retryDelay, // NEW
    };
  }
  if (error instanceof Error) {
    return {
      message: error.message,
      code: "unknown_error",
    };
  }
  return {
    message: "An unexpected error occurred",
    code: "unknown_error",
  };
}

export async function POST(request: NextRequest) {
  console.log("[clip] POST received");
  cleanupTmp();

  let body: { url: string; start: number; end: number };
  try {
    body = await request.json();
  } catch {
    console.log("[clip] Invalid JSON body");
    return new Response(
      JSON.stringify({ type: "error", error: "Invalid JSON body", code: "invalid_json" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { url, start, end } = body;
  console.log("[clip] Parsed body:", { url: url?.substring(0, 60), start, end });

  if (!url || typeof start !== "number" || typeof end !== "number") {
    console.log("[clip] Missing fields");
    return new Response(
      JSON.stringify({ type: "error", error: "Missing required fields", code: "missing_fields" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (end <= start) {
    return new Response(
      JSON.stringify({ type: "error", error: "End time must be greater than start time", code: "invalid_range" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (end - start > 600) {
    return new Response(
      JSON.stringify({ type: "error", error: "Max clip length is 10 minutes", code: "clip_too_long" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const id = uuidv4();
  const rawPath = getTmpPath(`${id}-raw.mp4`);
  const clipPath = getTmpPath(`${id}.mp4`);
  console.log("[clip] Paths:", { rawPath, clipPath });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Phase 1: Download (0-60%)
        console.log("[clip] Phase 1: Starting download...");
        send({ type: "progress", phase: "download", pct: 0 });

        await downloadVideoWithFallback(url, rawPath, (dlPct) => {
          const pct = Math.round(dlPct * 0.6);
          send({ type: "progress", phase: "download", pct });
        });

        // Validate download succeeded before proceeding
        const rawExists = fs.existsSync(rawPath);
        const rawSize = rawExists ? fs.statSync(rawPath).size : 0;
        console.log("[clip] Download complete:", { rawExists, rawSize });

        if (!rawExists || rawSize < 1024) {
          throw new DownloadError(
            "Download failed: video file is missing or too small",
            "download_validation_failed",
            `Exists: ${rawExists}, Size: ${rawSize}`
          );
        }

        // Phase 2: Trim (60-100%)
        console.log("[clip] Phase 2: Starting trim:", { start, end, duration: end - start });
        send({ type: "progress", phase: "trim", pct: 60 });

        await trimVideo(rawPath, clipPath, start, end, (trimPct) => {
          const pct = 60 + Math.round(trimPct * 0.4);
          send({ type: "progress", phase: "trim", pct: Math.min(pct, 100) });
        });

        // Validate trim output
        const clipExists = fs.existsSync(clipPath);
        const clipSize = clipExists ? fs.statSync(clipPath).size : 0;
        console.log("[clip] Trim complete:", { clipExists, clipSize });

        if (!clipExists || clipSize < 1024) {
          throw new DownloadError(
            "Trimming failed: output file is missing or too small",
            "trim_validation_failed",
            `Exists: ${clipExists}, Size: ${clipSize}`
          );
        }

        send({ type: "done", downloadId: id });
        console.log("[clip] Success! downloadId:", id);
      } catch (err) {
        const errorResponse = createErrorResponse(err);
        console.error("[clip] ERROR:", errorResponse);
        send({ type: "error", ...errorResponse });
      } finally {
        // Clean up raw file but keep the clip for download
        try {
          if (fs.existsSync(rawPath)) {
            fs.unlinkSync(rawPath);
            console.log("[clip] Cleaned up raw file");
          }
        } catch (cleanupErr) {
          console.warn("[clip] Failed to cleanup raw file:", cleanupErr);
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
