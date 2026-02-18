import { DownloadError } from "./processor";

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;
  /** Initial delay in milliseconds before first retry (default: 1000) */
  initialDelayMs: number;
  /** Maximum delay cap in milliseconds (default: 10000) */
  maxDelayMs: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number;
  /** Error codes that should trigger retries */
  retryableErrors: string[];
}

/**
 * Context information passed to retry callbacks
 */
export interface RetryContext {
  /** Current attempt number (1-indexed) */
  attempt: number;
  /** Total number of attempts that will be made */
  totalAttempts: number;
  /** The error from the last failed attempt */
  lastError?: Error;
  /** Calculated delay before next retry (ms) */
  nextDelayMs?: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: parseInt(process.env.YT_DLP_MAX_RETRIES || "3", 10),
  initialDelayMs: parseInt(process.env.YT_DLP_RETRY_DELAY_MS || "1000", 10),
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    "youtube_bot_detection",
    "youtube_access_denied",
    "network_error",
    "download_validation_failed",
  ],
};

/**
 * Error thrown when all retry attempts are exhausted
 */
export class RetryExhaustedError extends DownloadError {
  constructor(
    message: string,
    public attempts: number,
    public lastError: Error,
    public retryHistory: RetryContext[]
  ) {
    const details =
      lastError instanceof DownloadError
        ? lastError.details
        : lastError.message;

    const guidance =
      lastError instanceof DownloadError
        ? lastError.guidance
        : "All retry attempts failed. Please try again later or check your network connection.";

    super(message, "retry_exhausted", details, false, guidance);
    this.name = "RetryExhaustedError";
  }
}

/**
 * Calculate delay for next retry attempt using exponential backoff
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay =
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Sleep for specified duration
 *
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 *
 * @param operation - The async function to retry
 * @param config - Partial retry configuration (merged with defaults)
 * @param onRetry - Optional callback invoked before each retry
 * @returns Promise resolving to operation result
 * @throws RetryExhaustedError if all attempts fail
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (context: RetryContext) => void
): Promise<T> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const retryHistory: RetryContext[] = [];

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < fullConfig.maxAttempts; attempt++) {
    try {
      // Execute the operation
      const result = await operation();
      return result; // Success!
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Check if error is retryable
      if (err instanceof DownloadError) {
        // If explicitly marked as non-retryable, fail immediately
        if (!err.retryable) {
          throw err;
        }

        // Check if error code is in retryable list
        if (!fullConfig.retryableErrors.includes(err.code)) {
          throw err;
        }
      }

      // If this was the last attempt, we're done
      if (attempt >= fullConfig.maxAttempts - 1) {
        break;
      }

      // Calculate delay for next retry
      const delayMs = calculateDelay(attempt, fullConfig);

      // Build retry context
      const context: RetryContext = {
        attempt: attempt + 1,
        totalAttempts: fullConfig.maxAttempts,
        lastError,
        nextDelayMs: delayMs,
      };

      retryHistory.push(context);

      // Call retry callback if provided
      if (onRetry) {
        onRetry(context);
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // All retries exhausted
  throw new RetryExhaustedError(
    `Operation failed after ${fullConfig.maxAttempts} attempts`,
    fullConfig.maxAttempts,
    lastError!,
    retryHistory
  );
}
