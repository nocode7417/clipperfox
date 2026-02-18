import { NextRequest, NextResponse } from "next/server";
import { DownloadError } from "@/lib/processor";
import { fetchMetadataWithFallback } from "@/lib/yt-dlp-fallback";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "missing_url", message: "URL parameter is required" },
      { status: 400 }
    );
  }

  // Basic URL validation
  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch {
    return NextResponse.json(
      { error: "invalid_url", message: "The provided URL is not valid" },
      { status: 400 }
    );
  }

  // Check for supported platforms
  const hostname = urlObj.hostname.toLowerCase();
  const isYouTube =
    hostname === "youtube.com" ||
    hostname === "www.youtube.com" ||
    hostname === "youtu.be" ||
    hostname === "m.youtube.com";

  if (!isYouTube) {
    return NextResponse.json(
      {
        error: "unsupported_source",
        message: "Only YouTube URLs are currently supported",
      },
      { status: 400 }
    );
  }

  console.log("[metadata] Fetching metadata for:", url.substring(0, 60));

  try {
    const metadata = await fetchMetadataWithFallback(url); // Changed to use fallback wrapper

    // Warn if no progressive URL found
    if (!metadata.videoUrl) {
      console.warn("[metadata] No progressive MP4 URL found for:", url);
      // Still return metadata but flag it
      return NextResponse.json({
        ...metadata,
        warning: "no_progressive_format",
        message:
          "Metadata fetched but no direct video URL available. Clip export may still work via download.",
      });
    }

    console.log("[metadata] Success:", {
      duration: metadata.duration,
      isLive: metadata.isLive,
      hasVideoUrl: !!metadata.videoUrl,
    });

    return NextResponse.json(metadata);
  } catch (err) {
    console.error("[metadata] Error fetching metadata:", err);

    if (err instanceof DownloadError) {
      return NextResponse.json(
        {
          error: err.code,
          message: err.message,
          details: err.details,
          guidance: err.guidance, // NEW: Actionable guidance
          retryDelay: err.retryDelay, // NEW: Suggested wait time
        },
        { status: err.retryable ? 503 : 400 } // 503 Service Unavailable for retryable errors
      );
    }

    if (err instanceof Error) {
      return NextResponse.json(
        {
          error: "fetch_failed",
          message: err.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "unknown_error",
        message: "An unexpected error occurred while fetching metadata",
      },
      { status: 500 }
    );
  }
}
