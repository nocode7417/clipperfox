import fs from "fs";
import path from "path";

/**
 * Supported browsers for cookie extraction via yt-dlp --cookies-from-browser
 */
const SUPPORTED_BROWSERS = [
  "chrome",
  "firefox",
  "edge",
  "brave",
  "chromium",
  "opera",
  "safari",
  "vivaldi",
] as const;

type SupportedBrowser = (typeof SUPPORTED_BROWSERS)[number];

/**
 * Detect which browsers are installed on Windows
 * Checks common installation paths
 */
export function detectAvailableBrowsers(): string[] {
  const availableBrowsers: string[] = [];

  // Common browser paths on Windows
  const browserPaths: Record<string, string[]> = {
    chrome: [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      path.join(
        process.env.LOCALAPPDATA || "",
        "Google\\Chrome\\Application\\chrome.exe"
      ),
    ],
    firefox: [
      "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
      "C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe",
    ],
    edge: [
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ],
    brave: [
      path.join(
        process.env.LOCALAPPDATA || "",
        "BraveSoftware\\Brave-Browser\\Application\\brave.exe"
      ),
      "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    ],
  };

  for (const [browser, paths] of Object.entries(browserPaths)) {
    for (const browserPath of paths) {
      try {
        if (fs.existsSync(browserPath)) {
          availableBrowsers.push(browser);
          break; // Found this browser, no need to check other paths
        }
      } catch {
        // Ignore errors, continue checking
      }
    }
  }

  return availableBrowsers;
}

/**
 * Get browser cookie args from environment variable
 * Returns args for yt-dlp if YT_DLP_COOKIES_BROWSER is set and valid
 */
export function getBrowserCookieArgs(): string[] {
  const browserEnv = process.env.YT_DLP_COOKIES_BROWSER?.toLowerCase().trim();

  if (!browserEnv) {
    return [];
  }

  // Validate browser is supported
  if (!SUPPORTED_BROWSERS.includes(browserEnv as SupportedBrowser)) {
    console.warn(
      `[auth] Invalid browser '${browserEnv}'. Supported: ${SUPPORTED_BROWSERS.join(", ")}`
    );
    return [];
  }

  console.log(`[auth] Using browser cookies: ${browserEnv}`);
  return ["--cookies-from-browser", browserEnv];
}

/**
 * Get cookie file args from environment variable
 * Returns args for yt-dlp if YT_DLP_COOKIES_FILE is set and valid
 */
export function getCookieFileArgs(): string[] {
  const cookieFile = process.env.YT_DLP_COOKIES_FILE?.trim();

  if (!cookieFile) {
    return [];
  }

  // Validate path is absolute
  if (!path.isAbsolute(cookieFile)) {
    console.warn(
      `[auth] Cookie file path must be absolute: ${cookieFile}`
    );
    return [];
  }

  // Validate file exists and is readable
  try {
    if (!fs.existsSync(cookieFile)) {
      console.warn(`[auth] Cookie file not found: ${cookieFile}`);
      return [];
    }

    fs.accessSync(cookieFile, fs.constants.R_OK);
    console.log(`[auth] Using cookie file: ${cookieFile}`);
    return ["--cookies", cookieFile];
  } catch (err) {
    console.warn(
      `[auth] Cannot read cookie file: ${cookieFile}`,
      err instanceof Error ? err.message : String(err)
    );
    return [];
  }
}

/**
 * Get proxy args from environment variable
 * Returns args for yt-dlp if YT_DLP_PROXY is set and valid
 */
export function getProxyArgs(): string[] {
  const proxyUrl = process.env.YT_DLP_PROXY?.trim();

  if (!proxyUrl) {
    return [];
  }

  // Basic URL validation
  try {
    const url = new URL(proxyUrl);

    // Validate protocol
    if (!["http:", "https:", "socks5:", "socks4:"].includes(url.protocol)) {
      console.warn(
        `[auth] Invalid proxy protocol: ${url.protocol}. Use http://, https://, or socks5://`
      );
      return [];
    }

    // Log only hostname for security (not full URL which might contain credentials)
    console.log(`[auth] Using proxy: ${url.protocol}//${url.hostname}`);
    return ["--proxy", proxyUrl];
  } catch {
    console.warn(`[auth] Invalid proxy URL format: ${proxyUrl}`);
    return [];
  }
}

/**
 * Get authentication args for yt-dlp
 * Priority: Browser cookies > Cookie file > No auth (graceful degradation)
 *
 * @returns Array of yt-dlp arguments for authentication
 */
export function getAuthenticationArgs(): string[] {
  // Try browser cookies first (highest priority)
  const browserArgs = getBrowserCookieArgs();
  if (browserArgs.length > 0) {
    return browserArgs;
  }

  // Fall back to cookie file
  const cookieFileArgs = getCookieFileArgs();
  if (cookieFileArgs.length > 0) {
    return cookieFileArgs;
  }

  // No authentication configured - graceful degradation
  console.log("[auth] No authentication configured (cookies/proxy)");
  return [];
}
