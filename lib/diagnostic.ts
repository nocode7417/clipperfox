/**
 * Diagnostic utilities for testing yt-dlp and FFmpeg functionality
 * Run with: npx ts-node lib/diagnostic.ts
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { getTmpPath } from "./processor";

const TEST_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"; // Short test video

interface DiagnosticResult {
  component: string;
  status: "ok" | "error" | "warning";
  message: string;
  details?: string;
}

async function runCommand(
  command: string,
  args: string[],
  timeout = 30000
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args);
    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill();
      resolve({
        success: false,
        stdout,
        stderr: stderr + "\n[Timeout after " + timeout + "ms]",
      });
    }, timeout);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (!killed) {
        clearTimeout(timer);
        resolve({
          success: code === 0,
          stdout,
          stderr,
        });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        stdout,
        stderr: err.message,
      });
    });
  });
}

export async function runDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  // Check 1: yt-dlp installed
  console.log("\n[1/5] Checking yt-dlp installation...");
  const ytDlpVersion = await runCommand("yt-dlp", ["--version"], 5000);
  if (ytDlpVersion.success) {
    results.push({
      component: "yt-dlp",
      status: "ok",
      message: `yt-dlp is installed (version ${ytDlpVersion.stdout.trim()})`,
    });
  } else {
    results.push({
      component: "yt-dlp",
      status: "error",
      message: "yt-dlp is not installed or not in PATH",
      details: ytDlpVersion.stderr,
    });
    // Can't continue without yt-dlp
    return results;
  }

  // Check 2: FFmpeg installed
  console.log("[2/5] Checking FFmpeg installation...");
  const ffmpegVersion = await runCommand("ffmpeg", ["-version"], 5000);
  if (ffmpegVersion.success) {
    const version = ffmpegVersion.stdout.split("\n")[0];
    results.push({
      component: "ffmpeg",
      status: "ok",
      message: `FFmpeg is installed (${version})`,
    });
  } else {
    results.push({
      component: "ffmpeg",
      status: "error",
      message: "FFmpeg is not installed or not in PATH",
      details: ffmpegVersion.stderr,
    });
  }

  // Check 3: tmp directory writable
  console.log("[3/5] Checking tmp directory...");
  const tmpDir = path.join(process.cwd(), "tmp");
  try {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const testFile = path.join(tmpDir, "test-write.tmp");
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);
    results.push({
      component: "filesystem",
      status: "ok",
      message: `Tmp directory is writable (${tmpDir})`,
    });
  } catch (err) {
    results.push({
      component: "filesystem",
      status: "error",
      message: "Tmp directory is not writable",
      details: String(err),
    });
  }

  // Check 4: YouTube metadata fetch
  console.log("[4/5] Testing YouTube metadata fetch...");
  const metadataResult = await runCommand(
    "yt-dlp",
    [
      "--dump-json",
      "--no-download",
      "--user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "--extractor-args",
      "youtube:player_client=web",
      TEST_URL,
    ],
    15000
  );

  if (metadataResult.success) {
    try {
      const info = JSON.parse(metadataResult.stdout);
      results.push({
        component: "youtube-metadata",
        status: "ok",
        message: `Can fetch metadata for "${info.title?.substring(0, 50)}..."`,
        details: `Duration: ${info.duration}s, Uploader: ${info.uploader}`,
      });
    } catch {
      results.push({
        component: "youtube-metadata",
        status: "warning",
        message: "Fetched metadata but could not parse JSON",
        details: metadataResult.stdout.substring(0, 200),
      });
    }
  } else {
    const is403 = metadataResult.stderr.includes("403");
    results.push({
      component: "youtube-metadata",
      status: "error",
      message: is403
        ? "YouTube is blocking requests (HTTP 403)"
        : "Cannot fetch YouTube metadata",
      details: metadataResult.stderr.substring(0, 500),
    });
  }

  // Check 5: YouTube download test (small file only)
  console.log("[5/5] Testing YouTube download (small sample)...");
  const testDownloadPath = getTmpPath("diagnostic-test.mp4");

  // Clean up any existing test file
  try {
    if (fs.existsSync(testDownloadPath)) {
      fs.unlinkSync(testDownloadPath);
    }
  } catch {
    // ignore
  }

  const downloadResult = await runCommand(
    "yt-dlp",
    [
      "-f",
      "worst[ext=mp4]", // Download smallest format for quick test
      "--user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "--extractor-args",
      "youtube:player_client=web",
      "--extractor-args",
      "youtube:player_skip=webpage,configs,js",
      "--no-check-certificates",
      "-o",
      testDownloadPath,
      TEST_URL,
    ],
    60000
  );

  // Clean up test file
  try {
    if (fs.existsSync(testDownloadPath)) {
      const stats = fs.statSync(testDownloadPath);
      fs.unlinkSync(testDownloadPath);

      if (downloadResult.success || stats.size > 1024) {
        results.push({
          component: "youtube-download",
          status: "ok",
          message: "Can download YouTube videos",
          details: `Downloaded ${Math.round(stats.size / 1024)}KB successfully`,
        });
      } else {
        results.push({
          component: "youtube-download",
          status: "error",
          message: "Download command failed",
          details: downloadResult.stderr.substring(0, 500),
        });
      }
    } else {
      const is403 = downloadResult.stderr.includes("403");
      results.push({
        component: "youtube-download",
        status: "error",
        message: is403
          ? "YouTube is blocking downloads (HTTP 403 - SABR restriction)"
          : "Download failed - file not created",
        details: downloadResult.stderr.substring(0, 500),
      });
    }
  } catch (err) {
    results.push({
      component: "youtube-download",
      status: "error",
      message: "Error during download verification",
      details: String(err),
    });
  }

  return results;
}

// Run diagnostics if this file is executed directly
if (require.main === module) {
  runDiagnostics().then((results) => {
    console.log("\n" + "=".repeat(60));
    console.log("DIAGNOSTIC RESULTS");
    console.log("=".repeat(60));

    let errors = 0;
    let warnings = 0;

    for (const result of results) {
      const icon =
        result.status === "ok" ? "✓" : result.status === "warning" ? "⚠" : "✗";
      console.log(`\n${icon} [${result.component}] ${result.message}`);
      if (result.details) {
        console.log(`  Details: ${result.details}`);
      }

      if (result.status === "error") errors++;
      if (result.status === "warning") warnings++;
    }

    console.log("\n" + "=".repeat(60));
    if (errors === 0 && warnings === 0) {
      console.log("All checks passed! The system is ready to use.");
    } else if (errors === 0) {
      console.log(`${warnings} warning(s) found. System should work but may have issues.`);
    } else {
      console.log(`${errors} error(s) and ${warnings} warning(s) found. Please fix the errors above.`);
      process.exit(1);
    }
    console.log("=".repeat(60) + "\n");
  });
}
