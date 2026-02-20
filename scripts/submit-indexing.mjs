#!/usr/bin/env node
/**
 * submit-indexing.mjs
 *
 * Reads the sitemap to collect all pSEO URLs, then submits each to the
 * Google Indexing API (URL_UPDATED) via a service account.
 *
 * Prerequisites:
 *   1. Enable "Web Search Indexing API" in Google Cloud Console
 *   2. Create a service account & download the JSON key
 *   3. Save the key as  service-account.json  in the project root
 *   4. In Google Search Console → Settings → Users, add the service
 *      account email as an Owner (delegated)
 *
 * Usage:
 *   node scripts/submit-indexing.mjs            # submit all pSEO URLs
 *   node scripts/submit-indexing.mjs --dry-run  # print URLs without submitting
 *
 * Google quota: 200 URL notifications per day per project.
 */

import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const KEY_PATH = path.join(ROOT, "service-account.json");
const SITE = "https://clipperfox.com";
const DAILY_QUOTA = 200;
const isDryRun = process.argv.includes("--dry-run");

// ── Collect URLs from the Excel source ──────────────────────────────────
function getSitemapUrls() {
  const filePath = path.join(ROOT, "Untitled spreadsheet.xlsx");

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Excel file not found: ${filePath}`);
    process.exit(1);
  }

  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf);
  const ws = wb.Sheets["pSEO Master"];
  const rows = XLSX.utils.sheet_to_json(ws);

  const urls = [SITE]; // homepage always
  for (const row of rows) {
    const slug = String(row["Slug"] || "").trim();
    if (slug) {
      const clean = slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-|-$/g, "");
      if (clean) urls.push(`${SITE}/${clean}`);
    }
  }

  return [...new Set(urls)]; // deduplicate
}

// ── Authenticate ────────────────────────────────────────────────────────
function getAuthClient() {
  if (!fs.existsSync(KEY_PATH)) {
    console.error(`❌ Service account key not found at: ${KEY_PATH}`);
    console.error(`\nSetup steps:`);
    console.error(`  1. Go to https://console.cloud.google.com/apis/credentials`);
    console.error(`  2. Create a service account → download JSON key`);
    console.error(`  3. Save it as "service-account.json" in your project root`);
    console.error(`  4. Enable "Web Search Indexing API" in your GCP project`);
    console.error(`  5. Add the service account email as Owner in Google Search Console`);
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/indexing"],
  });
  return auth;
}

// ── Submit URLs ─────────────────────────────────────────────────────────
async function submitUrl(auth, url) {
  const indexing = google.indexing({ version: "v3", auth });
  const res = await indexing.urlNotifications.publish({
    requestBody: { url, type: "URL_UPDATED" },
  });
  return res.data;
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log("📡 ClipperFox Indexing Submitter\n");

  const urls = getSitemapUrls();
  console.log(`Found ${urls.length} URLs to submit`);

  if (urls.length > DAILY_QUOTA) {
    console.warn(`⚠️  Google quota is ${DAILY_QUOTA}/day — only first ${DAILY_QUOTA} will be submitted`);
    console.warn(`   Run this script again tomorrow for the rest.\n`);
  }

  const batch = urls.slice(0, DAILY_QUOTA);

  if (isDryRun) {
    console.log(`\n🔍 Dry run — URLs that would be submitted:\n`);
    batch.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
    console.log(`\nTotal: ${batch.length} URLs (dry run, nothing submitted)`);
    return;
  }

  const auth = getAuthClient();
  let success = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const url = batch[i];
    try {
      await submitUrl(auth, url);
      success++;
      // Progress every 50 URLs
      if ((i + 1) % 50 === 0 || i === batch.length - 1) {
        console.log(`  ✓ ${i + 1}/${batch.length} submitted`);
      }
    } catch (err) {
      failed++;
      const msg = err.response?.data?.error?.message || err.message;
      console.error(`  ✗ ${url} — ${msg}`);
    }

    // Rate limit: ~5 requests/sec to stay well within Google's limits
    if (i < batch.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log(`\n✅ Done: ${success} submitted, ${failed} failed`);

  if (urls.length > DAILY_QUOTA) {
    const remaining = urls.length - DAILY_QUOTA;
    console.log(`⏳ ${remaining} URLs remaining — run again tomorrow`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
