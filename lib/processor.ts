import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { getAuthenticationArgs, getProxyArgs } from "./yt-dlp-auth";
import { writeErrorLog } from "./logger";

const TMP_DIR = path.join(process.cwd(), "tmp");

// Ensure tmp dir exists
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

/**
 * Options for yt-dlp operations
 */
export interface YtDlpOptions {
  playerClient?: "web" | "tv" | "android" | "ios";
}

/**
 * Get yt-dlp base arguments with Chrome impersonation and authentication
 * Requires: pip install curl_cffi
 * Using --impersonate Chrome-136 for best bot evasion
 *
 * @param options - Optional configuration for player client
 */
function getYtDlpBaseArgs(options: YtDlpOptions = {}): string[] {
  const playerClient =
    options.playerClient ||
    (process.env.YT_DLP_PLAYER_CLIENT as YtDlpOptions["playerClient"]) ||
    "web";

  return [
    ...getAuthenticationArgs(), // NEW: Cookie/auth support
    ...getProxyArgs(), // NEW: Proxy support
    "--impersonate",
    "Chrome-136",
    "--extractor-args",
    `youtube:player_client=${playerClient},player_skip=webpage,configs,js`,
    "--no-check-certificates",
    "--retries",
    "10",
    "--fragment-retries",
    "10",
    "--buffer-size",
    "8192",
    "--socket-timeout",
    "30",
  ];
}

export interface VideoMetadata {
  thumbnail: string;
  title: string;
  duration: number;
  videoUrl: string;
  isLive: boolean;
  width: number;
  height: number;
}

/**
 * Probe video dimensions using ffprobe
 * Returns width, height, codec, and SAR/DAR for validation
 */
function probeVideoDimensions(
  filePath: string
): Promise<{ width: number; height: number; codec: string; sar: string; dar: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,codec_name,sample_aspect_ratio,display_aspect_ratio",
      "-of",
      "json",
      filePath,
    ]);

    const chunks: Buffer[] = [];
    proc.stdout.on("data", (data: Buffer) => chunks.push(data));

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe exited with code ${code}`));
      }
      try {
        const info = JSON.parse(Buffer.concat(chunks).toString());
        const stream = info.streams?.[0] || {};
        resolve({
          width: stream.width || 0,
          height: stream.height || 0,
          codec: stream.codec_name || "unknown",
          sar: stream.sample_aspect_ratio || "N/A",
          dar: stream.display_aspect_ratio || "N/A",
        });
      } catch {
        reject(new Error("Failed to parse ffprobe output"));
      }
    });

    proc.on("error", (err) => reject(err));
  });
}

/**
 * Custom error class for download operations with detailed context
 */
export class DownloadError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: string,
    public retryable: boolean = false,
    public guidance?: string, // NEW: User-facing next steps
    public retryDelay?: number, // NEW: Suggested wait time (ms)
    public logFile?: string // NEW: Path to error log file
  ) {
    super(message);
    this.name = "DownloadError";
  }
}

/**
 * Validates that a file exists and has content
 */
function validateDownload(outputPath: string): { valid: boolean; size: number } {
  try {
    if (!fs.existsSync(outputPath)) {
      return { valid: false, size: 0 };
    }
    const stats = fs.statSync(outputPath);
    return { valid: stats.size > 1024, size: stats.size };
  } catch {
    return { valid: false, size: 0 };
  }
}

/**
 * Parse yt-dlp error messages to extract meaningful error codes
 */
function parseYtDlpError(stderr: string): {
  code: string;
  details: string;
  retryable: boolean;
  guidance?: string;
  retryDelay?: number;
  logFile?: string;
} {
  const lowerStderr = stderr.toLowerCase();

  // Bot detection / Sign in required
  if (
    lowerStderr.includes("sign in") ||
    lowerStderr.includes("not a bot") ||
    lowerStderr.includes("confirm you're not")
  ) {
    const logFile = writeErrorLog(stderr, "youtube_bot_detection");

    return {
      code: "youtube_bot_detection",
      details: "YouTube requires sign-in verification",
      retryable: true,
      retryDelay: 5000,
      guidance: `YouTube detected automated access. Solutions:
  1. Set YT_DLP_COOKIES_BROWSER=chrome (or firefox/edge) to use browser cookies
  2. Wait 2-5 minutes before retrying
  3. Try different network or set YT_DLP_PROXY environment variable
  4. Check error log: ${logFile}`,
      logFile,
    };
  }

  // HTTP 403 Forbidden
  if (lowerStderr.includes("403") || lowerStderr.includes("forbidden")) {
    return {
      code: "youtube_access_denied",
      details:
        "YouTube is blocking access (HTTP 403). This may be due to IP rate limiting or the video requires authentication.",
      retryable: true,
    };
  }

  // HTTP 404 - video not found/private
  if (lowerStderr.includes("404") || lowerStderr.includes("not found")) {
    return {
      code: "video_not_found",
      details:
        "The video could not be found. It may be private, deleted, or the URL is incorrect.",
      retryable: false,
    };
  }

  // Network errors
  if (
    lowerStderr.includes("network") ||
    lowerStderr.includes("connection") ||
    lowerStderr.includes("timeout") ||
    lowerStderr.includes("unreachable")
  ) {
    return {
      code: "network_error",
      details:
        "Network error occurred while downloading. Please check your internet connection.",
      retryable: true,
    };
  }

  // Unsupported URL
  if (lowerStderr.includes("unsupported") || lowerStderr.includes("url")) {
    return {
      code: "unsupported_source",
      details:
        "This URL is not supported. Currently only YouTube URLs are supported.",
      retryable: false,
    };
  }

  // Generic error with truncated stderr for debugging
  return {
    code: "download_failed",
    details: stderr.substring(0, 500),
    retryable: true,
  };
}

export async function fetchMetadata(
  url: string,
  options: YtDlpOptions = {}
): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const args = [
      "--dump-json",
      "--no-playlist",
      "--no-download",
      "--js-runtimes",
      "node",
      ...getYtDlpBaseArgs(options), // Pass options through
      url,
    ];

    console.log("[metadata] yt-dlp args:", args.join(" "));

    const proc = spawn("yt-dlp", args);

    proc.stdout.on("data", (data) => chunks.push(data));

    let stderrBuf = "";
    proc.stderr.on("data", (data) => {
      stderrBuf += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        const error = parseYtDlpError(stderrBuf);
        console.error("[metadata] yt-dlp failed:", error);
        return reject(
          new DownloadError(
            error.details,
            error.code,
            stderrBuf.substring(0, 1000),
            error.retryable,
            error.guidance,
            error.retryDelay,
            error.logFile
          )
        );
      }
      try {
        const info = JSON.parse(Buffer.concat(chunks).toString());

        // Find truly progressive mp4 (protocol=https, not HLS m3u8 playlists)
        // YouTube HLS manifests are CORS-blocked in browsers, so we must use
        // direct progressive URLs that work with <video src>
        const progressiveFormats = (info.formats || [])
          .filter(
            (f: Record<string, unknown>) =>
              f.ext === "mp4" &&
              f.acodec &&
              f.acodec !== "none" &&
              f.vcodec &&
              f.vcodec !== "none" &&
              f.protocol === "https" &&
              f.url &&
              !(f.url as string).includes("manifest.googlevideo.com")
          )
          .sort(
            (a: Record<string, unknown>, b: Record<string, unknown>) =>
              ((b.height as number) || 0) - ((a.height as number) || 0)
          );

        const videoUrl: string = (progressiveFormats[0]?.url as string) || "";

        const isLive: boolean = !!info.is_live;

        console.log("[metadata] Success:", {
          title: info.title?.substring(0, 50),
          duration: info.duration,
          isLive,
          hasVideoUrl: !!videoUrl,
          formatsFound: progressiveFormats.length,
          sourceWidth: info.width || 0,
          sourceHeight: info.height || 0,
        });

        resolve({
          thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || "",
          title: info.title || "",
          duration: info.duration || 0,
          videoUrl,
          isLive,
          width: info.width || 0,
          height: info.height || 0,
        });
      } catch (err) {
        console.error("[metadata] Parse error:", err);
        reject(
          new DownloadError(
            "Failed to parse video metadata",
            "parse_error",
            String(err),
            false
          )
        );
      }
    });

    proc.on("error", (err) => {
      console.error("[metadata] Spawn error:", err.message);
      reject(
        new DownloadError(
          "Failed to start metadata fetch. Is yt-dlp installed?",
          "spawn_error",
          err.message,
          false
        )
      );
    });
  });
}

export interface ProgressCallback {
  (phase: "download" | "trim", pct: number): void;
}

export async function downloadVideo(
  url: string,
  outputPath: string,
  onProgress: (pct: number) => void,
  options: YtDlpOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("[dl] Starting download for:", url.substring(0, 60));
    console.log("[dl] Output path:", outputPath);

    // Clean up any existing partial file
    try {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
        console.log("[dl] Cleaned up existing file");
      }
    } catch (err) {
      console.warn("[dl] Could not clean up existing file:", err);
    }

    const args = [
      "-f",
      "bv*[ext=mp4][height=720]+ba[ext=m4a]/bv*[ext=mp4][height<=720]+ba[ext=m4a]/bv*+ba/b[ext=mp4]/b",
      "--merge-output-format",
      "mp4",
      "--no-playlist",
      "--js-runtimes",
      "node",
      "--newline",
      "--progress-template",
      "download:%(progress._percent_str)s",
      "-o",
      outputPath,
      ...getYtDlpBaseArgs(options), // Pass options through
      url,
    ];

    console.log("[dl] yt-dlp args:", args.filter((a) => !a.includes(" ")).join(" "));

    const proc = spawn("yt-dlp", args);

    let lastProgress = 0;

    proc.stdout.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        const match = line.match(/(\d+\.?\d*)%/);
        if (match) {
          const pct = parseFloat(match[1]);
          if (pct > lastProgress) {
            lastProgress = pct;
            onProgress(pct);
          }
        }
      }
    });

    let stderrBuf = "";
    proc.stderr.on("data", (data: Buffer) => {
      stderrBuf += data.toString();
    });

    proc.on("close", (code) => {
      console.log("[dl] yt-dlp exited code:", code);

      if (stderrBuf.trim()) {
        console.log("[dl] stderr:", stderrBuf.trim().substring(0, 2000));
      }

      // Validate the download even if exit code is 0
      const validation = validateDownload(outputPath);
      console.log("[dl] File validation:", validation);

      if (code !== 0) {
        const error = parseYtDlpError(stderrBuf);
        console.error("[dl] Download failed:", error);
        return reject(
          new DownloadError(
            error.details,
            error.code,
            stderrBuf.substring(0, 1000),
            error.retryable,
            error.guidance,
            error.retryDelay,
            error.logFile
          )
        );
      }

      if (!validation.valid) {
        console.error("[dl] Download validation failed:", validation);
        return reject(
          new DownloadError(
            "Download completed but file is missing or too small. The video may be restricted or unavailable.",
            "download_validation_failed",
            `File size: ${validation.size} bytes`,
            true
          )
        );
      }

      console.log("[dl] Download successful:", validation.size, "bytes");

      // Log downloaded video dimensions for validation
      probeVideoDimensions(outputPath)
        .then((dims) => console.log("[dl] Downloaded dimensions:", dims))
        .catch((err) => console.warn("[dl] Could not probe dimensions:", err.message));
      resolve();
    });

    proc.on("error", (err) => {
      console.error("[dl] Spawn error:", err.message);
      reject(
        new DownloadError(
          "Failed to start download. Is yt-dlp installed?",
          "spawn_error",
          err.message,
          false
        )
      );
    });
  });
}

export async function trimVideo(
  inputPath: string,
  outputPath: string,
  start: number,
  end: number,
  onProgress: (pct: number) => void
): Promise<void> {
  const duration = end - start;

  return new Promise((resolve, reject) => {
    // Validate input file exists before attempting trim
    const inputValidation = validateDownload(inputPath);
    console.log("[trim] Input validation:", inputValidation);

    if (!inputValidation.valid) {
      return reject(
        new DownloadError(
          "Cannot trim video: input file is missing or invalid",
          "trim_input_invalid",
          `File: ${inputPath}, Size: ${inputValidation.size}`,
          false
        )
      );
    }

    console.log("[trim] Starting FFmpeg:", { inputPath, start, end, duration });

    // Log input dimensions for validation
    probeVideoDimensions(inputPath)
      .then((dims) => console.log("[trim] Input dimensions:", dims))
      .catch((err) => console.warn("[trim] Could not probe input dimensions:", err.message));

    const proc = spawn("ffmpeg", [
      "-y",
      "-ss",
      String(start),
      "-i",
      inputPath,
      "-t",
      String(duration),
      "-vf",
      "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "18",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-avoid_negative_ts",
      "make_zero",
      "-progress",
      "pipe:1",
      outputPath,
    ]);

    let lastProgress = 0;

    proc.stdout.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        const match = line.match(/out_time_ms=(\d+)/);
        if (match) {
          const currentMs = parseInt(match[1], 10) / 1000000;
          const pct = Math.min(100, (currentMs / duration) * 100);
          if (pct > lastProgress) {
            lastProgress = pct;
            onProgress(pct);
          }
        }
      }
    });

    let stderrBuf = "";
    proc.stderr.on("data", (data: Buffer) => {
      stderrBuf += data.toString();
    });

    proc.on("close", (code) => {
      console.log("[trim] FFmpeg exited code:", code);

      if (stderrBuf.trim()) {
        console.log("[trim] stderr:", stderrBuf.trim().substring(0, 500));
      }

      // Validate output file
      const outputValidation = validateDownload(outputPath);
      console.log("[trim] Output validation:", outputValidation);

      if (code !== 0) {
        return reject(
          new DownloadError(
            "Video trimming failed. The downloaded file may be corrupted.",
            "trim_failed",
            stderrBuf.substring(0, 1000),
            false
          )
        );
      }

      if (!outputValidation.valid) {
        return reject(
          new DownloadError(
            "Trim completed but output file is missing or too small",
            "trim_output_invalid",
            `File size: ${outputValidation.size} bytes`,
            false
          )
        );
      }

      console.log("[trim] Trim successful:", outputValidation.size, "bytes");

      // Verify output is exactly 720p
      probeVideoDimensions(outputPath)
        .then((dims) => {
          console.log("[trim] Output dimensions:", dims);
          if (dims.width !== 1280 || dims.height !== 720) {
            console.warn("[trim] WARNING: Output is not 720p!", dims);
          } else {
            console.log("[trim] Verified: output is 1280x720 (720p)");
          }
        })
        .catch((err) => console.warn("[trim] Could not probe output dimensions:", err.message));

      resolve();
    });

    proc.on("error", (err) => {
      console.error("[trim] Spawn error:", err.message);
      reject(
        new DownloadError(
          "Failed to start FFmpeg. Is FFmpeg installed?",
          "ffmpeg_not_found",
          err.message,
          false
        )
      );
    });
  });
}

export function getTmpPath(filename: string): string {
  return path.join(TMP_DIR, filename);
}

export function cleanupTmp(maxAgeMs: number = 10 * 60 * 1000): void {
  if (!fs.existsSync(TMP_DIR)) return;
  const now = Date.now();
  for (const file of fs.readdirSync(TMP_DIR)) {
    const filePath = path.join(TMP_DIR, file);
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        console.log("[cleanup] Removed old file:", file);
      }
    } catch {
      // ignore
    }
  }
}
