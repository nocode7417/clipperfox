import { NextRequest } from "next/server";
import { getTmpPath } from "@/lib/processor";
import fs from "fs";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id || !/^[a-f0-9-]+$/.test(id)) {
    console.error("[download] Invalid ID format:", id);
    return new Response(
      JSON.stringify({ error: "Invalid ID format" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const filePath = getTmpPath(`${id}.mp4`);
  console.log("[download] Requested file:", filePath);

  if (!fs.existsSync(filePath)) {
    console.error("[download] File not found:", filePath);
    return new Response(
      JSON.stringify({ error: "Clip not found or expired" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const stat = fs.statSync(filePath);
  
  if (stat.size < 1024) {
    console.error("[download] File too small:", stat.size, "bytes");
    return new Response(
      JSON.stringify({ error: "Clip file is corrupted or incomplete" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log("[download] Streaming file:", stat.size, "bytes");

  const fileStream = fs.createReadStream(filePath);
  let streamClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      fileStream.on("data", (chunk: Buffer) => {
        try {
          controller.enqueue(new Uint8Array(chunk));
        } catch (err) {
          console.error("[download] Error enqueueing chunk:", err);
          if (!streamClosed) {
            streamClosed = true;
            controller.error(err);
          }
        }
      });
      
      fileStream.on("end", () => {
        if (!streamClosed) {
          streamClosed = true;
          controller.close();
          // Delete after successful serving
          try {
            fs.unlinkSync(filePath);
            console.log("[download] File served and cleaned up:", id);
          } catch (err) {
            console.error("[download] Failed to cleanup file:", err);
          }
        }
      });
      
      fileStream.on("error", (err) => {
        console.error("[download] Stream error:", err);
        if (!streamClosed) {
          streamClosed = true;
          controller.error(err);
        }
      });
    },
    cancel() {
      // Handle client disconnect
      console.log("[download] Client disconnected, cleaning up");
      fileStream.destroy();
      streamClosed = true;
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // ignore cleanup errors on cancel
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": "attachment",
      "Content-Length": String(stat.size),
    },
  });
}
