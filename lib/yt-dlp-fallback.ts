import {
  fetchMetadata,
  downloadVideo,
  VideoMetadata,
  DownloadError,
  YtDlpOptions,
} from "./processor";
import { retryWithBackoff } from "./retry-helper";
import { log } from "./logger";

/**
 * Fetch metadata with retry and player client fallback
 *
 * Strategy:
 * 1. Try web client with retry (3 attempts, exponential backoff)
 * 2. If bot detection, try TV client (single attempt)
 * 3. If still failing, try Android client (single attempt)
 * 4. Throw with comprehensive guidance
 *
 * @param url - YouTube video URL
 * @returns Video metadata
 */
export async function fetchMetadataWithFallback(
  url: string
): Promise<VideoMetadata> {
  // Attempt 1-3: Web client with retry
  try {
    return await retryWithBackoff(
      () => fetchMetadata(url, { playerClient: "web" }),
      {
        maxAttempts: 3,
      },
      (ctx) => {
        log({
          timestamp: new Date().toISOString(),
          level: "warn",
          component: "metadata-fallback",
          message: `Retry attempt ${ctx.attempt}/${ctx.totalAttempts}`,
          metadata: {
            url: url.substring(0, 60),
            error: ctx.lastError?.message,
            delayMs: ctx.nextDelayMs,
          },
        });
      }
    );
  } catch (err) {
    // If not bot detection, throw immediately
    if (!(err instanceof DownloadError && err.code === "youtube_bot_detection")) {
      throw err;
    }

    log({
      timestamp: new Date().toISOString(),
      level: "warn",
      component: "metadata-fallback",
      message: "Web client failed with bot detection, trying TV client",
      metadata: { url: url.substring(0, 60) },
    });
  }

  // Attempt 4: TV client (often bypasses bot detection)
  try {
    log({
      timestamp: new Date().toISOString(),
      level: "info",
      component: "metadata-fallback",
      message: "Fallback: trying TV player client",
    });

    return await fetchMetadata(url, { playerClient: "tv" });
  } catch (err) {
    log({
      timestamp: new Date().toISOString(),
      level: "warn",
      component: "metadata-fallback",
      message: "TV client failed, trying Android client",
      metadata: {
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }

  // Attempt 5: Android client
  try {
    log({
      timestamp: new Date().toISOString(),
      level: "info",
      component: "metadata-fallback",
      message: "Fallback: trying Android player client",
    });

    return await fetchMetadata(url, { playerClient: "android" });
  } catch (err) {
    // All strategies exhausted
    log({
      timestamp: new Date().toISOString(),
      level: "error",
      component: "metadata-fallback",
      message: "All fallback strategies exhausted",
      metadata: {
        url: url.substring(0, 60),
        error: err instanceof Error ? err.message : String(err),
      },
    });

    throw new DownloadError(
      "All retry strategies exhausted. YouTube is blocking this request.",
      "all_fallbacks_failed",
      "Tried: web (3x retry), tv, android. See guidance for solutions.",
      false,
      `All fallback strategies failed. This usually means:
  1. Your IP is rate-limited by YouTube - try setting YT_DLP_PROXY or use a different network
  2. Authentication is required - set YT_DLP_COOKIES_BROWSER=chrome (or your browser)
  3. The video may be private or region-restricted
  4. Wait 10-30 minutes before trying again`
    );
  }
}

/**
 * Download video with retry and player client fallback
 *
 * Strategy: Same as fetchMetadataWithFallback but for downloads
 *
 * @param url - YouTube video URL
 * @param outputPath - Where to save the downloaded video
 * @param onProgress - Progress callback (0-100)
 * @returns Promise that resolves when download completes
 */
export async function downloadVideoWithFallback(
  url: string,
  outputPath: string,
  onProgress: (pct: number) => void
): Promise<void> {
  // Attempt 1-3: Web client with retry
  try {
    return await retryWithBackoff(
      () => downloadVideo(url, outputPath, onProgress, { playerClient: "web" }),
      {
        maxAttempts: 3,
      },
      (ctx) => {
        log({
          timestamp: new Date().toISOString(),
          level: "warn",
          component: "download-fallback",
          message: `Retry attempt ${ctx.attempt}/${ctx.totalAttempts}`,
          metadata: {
            url: url.substring(0, 60),
            error: ctx.lastError?.message,
            delayMs: ctx.nextDelayMs,
          },
        });
      }
    );
  } catch (err) {
    // If not bot detection, throw immediately
    if (!(err instanceof DownloadError && err.code === "youtube_bot_detection")) {
      throw err;
    }

    log({
      timestamp: new Date().toISOString(),
      level: "warn",
      component: "download-fallback",
      message: "Web client failed with bot detection, trying TV client",
      metadata: { url: url.substring(0, 60) },
    });
  }

  // Attempt 4: TV client
  try {
    log({
      timestamp: new Date().toISOString(),
      level: "info",
      component: "download-fallback",
      message: "Fallback: trying TV player client",
    });

    return await downloadVideo(url, outputPath, onProgress, {
      playerClient: "tv",
    });
  } catch (err) {
    log({
      timestamp: new Date().toISOString(),
      level: "warn",
      component: "download-fallback",
      message: "TV client failed, trying Android client",
      metadata: {
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }

  // Attempt 5: Android client
  try {
    log({
      timestamp: new Date().toISOString(),
      level: "info",
      component: "download-fallback",
      message: "Fallback: trying Android player client",
    });

    return await downloadVideo(url, outputPath, onProgress, {
      playerClient: "android",
    });
  } catch (err) {
    // All strategies exhausted
    log({
      timestamp: new Date().toISOString(),
      level: "error",
      component: "download-fallback",
      message: "All fallback strategies exhausted",
      metadata: {
        url: url.substring(0, 60),
        error: err instanceof Error ? err.message : String(err),
      },
    });

    throw new DownloadError(
      "All retry strategies exhausted. YouTube is blocking this request.",
      "all_fallbacks_failed",
      "Tried: web (3x retry), tv, android. See guidance for solutions.",
      false,
      `All fallback strategies failed. This usually means:
  1. Your IP is rate-limited by YouTube - try setting YT_DLP_PROXY or use a different network
  2. Authentication is required - set YT_DLP_COOKIES_BROWSER=chrome (or your browser)
  3. The video may be private or region-restricted
  4. Wait 10-30 minutes before trying again`
    );
  }
}
