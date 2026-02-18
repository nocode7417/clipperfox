import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

/**
 * Log levels
 */
export type LogLevel = "info" | "warn" | "error";

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Get configured log level from environment
 */
function getLogLevel(): LogLevel {
  const level = (process.env.LOG_LEVEL || "info").toLowerCase();
  if (level === "warn" || level === "error") {
    return level;
  }
  return "info";
}

/**
 * Check if a log level should be emitted based on configuration
 */
function shouldLog(level: LogLevel): boolean {
  const configuredLevel = getLogLevel();
  const levels: LogLevel[] = ["info", "warn", "error"];
  const configuredIndex = levels.indexOf(configuredLevel);
  const messageIndex = levels.indexOf(level);
  return messageIndex >= configuredIndex;
}

/**
 * Sanitize metadata to remove sensitive information
 */
function sanitizeMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const sanitized = { ...metadata };

  // Remove or redact sensitive fields
  const sensitiveKeys = [
    "cookie",
    "cookies",
    "password",
    "token",
    "apiKey",
    "api_key",
    "secret",
  ];

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      sanitized[key] = "[REDACTED]";
    }
  }

  return sanitized;
}

/**
 * Log a structured message
 *
 * @param entry - Log entry to emit
 */
export function log(entry: LogEntry): void {
  if (!shouldLog(entry.level)) {
    return;
  }

  const timestamp = new Date().toISOString();
  const sanitizedMetadata = sanitizeMetadata(entry.metadata);

  const logMessage = [
    `[${timestamp}]`,
    `[${entry.component}]`,
    entry.message,
    sanitizedMetadata ? JSON.stringify(sanitizedMetadata) : "",
  ]
    .filter(Boolean)
    .join(" ");

  switch (entry.level) {
    case "error":
      console.error(logMessage);
      break;
    case "warn":
      console.warn(logMessage);
      break;
    default:
      console.log(logMessage);
  }
}

/**
 * Log a yt-dlp invocation (sanitized)
 *
 * @param args - yt-dlp arguments
 * @param url - Video URL (truncated for brevity)
 */
export function logYtDlpInvocation(args: string[], url: string): void {
  // Remove sensitive args from log
  const sanitizedArgs = args
    .map((arg, i) => {
      if (
        arg === "--cookies" ||
        arg === "--cookies-from-browser" ||
        arg === "--proxy"
      ) {
        // Redact the value that follows these flags
        if (i + 1 < args.length) {
          return `${arg} [REDACTED]`;
        }
      }
      return arg;
    })
    .filter((arg) => arg !== "[REDACTED]");

  log({
    timestamp: new Date().toISOString(),
    level: "info",
    component: "yt-dlp",
    message: "Invoking yt-dlp",
    metadata: {
      args: sanitizedArgs.join(" "),
      url: url.substring(0, 60),
    },
  });
}

/**
 * Get error log directory path
 */
function getErrorLogDir(): string {
  return (
    process.env.YT_DLP_ERROR_LOG_DIR ||
    path.join(process.cwd(), "tmp", "errors")
  );
}

/**
 * Ensure error log directory exists
 */
function ensureErrorLogDir(): void {
  const dir = getErrorLogDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write full error stderr to a log file for debugging
 *
 * @param stderr - Full stderr output from yt-dlp
 * @param errorCode - Error code for naming
 * @returns Path to the created log file
 */
export function writeErrorLog(stderr: string, errorCode: string): string {
  ensureErrorLogDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const uuid = uuidv4().split("-")[0]; // Short UUID
  const filename = `error-${timestamp}-${errorCode}-${uuid}.log`;
  const logPath = path.join(getErrorLogDir(), filename);

  const logContent = [
    `Error Code: ${errorCode}`,
    `Timestamp: ${new Date().toISOString()}`,
    ``,
    `=== STDERR OUTPUT ===`,
    stderr,
  ].join("\n");

  try {
    fs.writeFileSync(logPath, logContent, "utf-8");
    log({
      timestamp: new Date().toISOString(),
      level: "info",
      component: "logger",
      message: `Error log written: ${filename}`,
    });
  } catch (err) {
    log({
      timestamp: new Date().toISOString(),
      level: "error",
      component: "logger",
      message: "Failed to write error log",
      metadata: {
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }

  return logPath;
}

/**
 * Clean up old error logs (older than maxAgeMs)
 *
 * @param maxAgeMs - Maximum age in milliseconds (default: 24 hours)
 */
export function cleanupErrorLogs(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  const dir = getErrorLogDir();

  if (!fs.existsSync(dir)) {
    return;
  }

  const now = Date.now();

  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      if (!file.startsWith("error-") || !file.endsWith(".log")) {
        continue;
      }

      const filePath = path.join(dir, file);

      try {
        const stat = fs.statSync(filePath);
        const age = now - stat.mtimeMs;

        if (age > maxAgeMs) {
          fs.unlinkSync(filePath);
          log({
            timestamp: new Date().toISOString(),
            level: "info",
            component: "logger",
            message: `Cleaned up old error log: ${file}`,
          });
        }
      } catch (err) {
        // Ignore errors for individual files
      }
    }
  } catch (err) {
    log({
      timestamp: new Date().toISOString(),
      level: "warn",
      component: "logger",
      message: "Error during error log cleanup",
      metadata: {
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
