import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface KeywordRow {
  keyword: string;
  searchVolume: number;
  cluster: string;
  templateId: "crop-online" | "trim-download" | "generic-cutter" | "clip-maker";
  intent: string;
  primaryAction: string;
  outputFormat: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  pageIntro: string;
  featureBullets: string[];
  faq: FaqItem[];
  ctaText: string;
  priorityScore: number;
}

const CLUSTER_TO_TEMPLATE: Record<string, KeywordRow["templateId"]> = {
  "Crop Online": "crop-online",
  "Trim & Download": "trim-download",
  "Generic Cutter": "generic-cutter",
  "Clip Maker": "clip-maker",
  "Cut & Save": "generic-cutter",
  "Format Convert": "generic-cutter",
};

/** Sanitize a slug: lowercase, strip non-alphanumeric (except hyphens), collapse hyphens */
function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")   // replace special chars with hyphens
    .replace(/-{2,}/g, "-")         // collapse multiple hyphens
    .replace(/^-|-$/g, "");         // strip leading/trailing hyphens
}

function parseFaq(raw: string): FaqItem[] {
  if (!raw) return [];
  const pairs = raw.split("||").map((s) => s.trim()).filter(Boolean);
  return pairs.map((pair) => {
    const parts = pair.split("|").map((s) => s.trim());
    const question = (parts[0] || "").replace(/^Q\d+:\s*/, "");
    const answer = (parts[1] || "").replace(/^A\d+:\s*/, "");
    return { question, answer };
  });
}

function parseBullets(raw: string): string[] {
  if (!raw) return [];
  return raw.split("\n").map((s) => s.trim()).filter(Boolean);
}

let _cache: KeywordRow[] | null = null;

export function getAllKeywords(): KeywordRow[] {
  if (_cache) return _cache;

  const filePath = path.join(process.cwd(), "Untitled spreadsheet.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`[pSEO] Excel file not found: ${filePath}`);
  }

  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf);
  const ws = wb.Sheets["pSEO Master"];
  if (!ws) {
    throw new Error(`[pSEO] Sheet "pSEO Master" not found. Available sheets: ${wb.SheetNames.join(", ")}`);
  }

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
  if (raw.length === 0) {
    throw new Error(`[pSEO] Sheet "pSEO Master" has no data rows.`);
  }

  const errors: string[] = [];
  const seenSlugs = new Map<string, number>(); // slug -> first row index

  const rows: KeywordRow[] = [];

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    const excelRow = i + 2; // 1-indexed header + data offset

    const rawSlug = String(row["Slug"] || "").trim();
    const cluster = String(row["Cluster"] || "").trim();

    // Skip rows with no slug or unknown cluster (not an error, just empty/irrelevant rows)
    if (!rawSlug || !CLUSTER_TO_TEMPLATE[cluster]) continue;

    const slug = sanitizeSlug(rawSlug);

    if (!slug) {
      errors.push(`Row ${excelRow}: Slug "${rawSlug}" sanitized to empty string`);
      continue;
    }

    // Deduplicate slugs — keep first occurrence, warn on duplicates
    if (seenSlugs.has(slug)) {
      const firstRow = seenSlugs.get(slug)!;
      console.warn(`[pSEO] Row ${excelRow}: Duplicate slug "${slug}" (first seen at row ${firstRow}) — skipped`);
      continue;
    }
    seenSlugs.set(slug, excelRow);

    // Validate critical fields
    const keyword = String(row["Keyword"] || "").trim();
    const h1 = String(row["H1"] || "").trim();
    const metaTitle = String(row["Meta Title"] || "").trim();

    if (!keyword) {
      errors.push(`Row ${excelRow} (slug: "${slug}"): Missing required field "Keyword"`);
      continue;
    }

    rows.push({
      keyword,
      searchVolume: Number(row["Search Volume"]) || 0,
      cluster,
      templateId: CLUSTER_TO_TEMPLATE[cluster] || "generic-cutter",
      intent: String(row["Intent"] || "informational"),
      primaryAction: String(row["Primary Action"] || "trim"),
      outputFormat: String(row["Output Format"] || "mp4"),
      slug,
      metaTitle: metaTitle || `${keyword} — Clipperfox`,
      metaDescription: String(row["Meta Description"] || "").trim() || `Use Clipperfox to ${keyword.toLowerCase()} online for free. No signup, no watermark.`,
      h1: h1 || keyword,
      pageIntro: String(row["Page Intro"] || "").trim() || `Clipperfox makes it easy to ${keyword.toLowerCase()} right in your browser.`,
      featureBullets: parseBullets(String(row["Feature Bullets"] || "")),
      faq: parseFaq(String(row["FAQ"] || "")),
      ctaText: String(row["CTA Text"] || "Start Clipping"),
      priorityScore: Number(row["Priority Score"]) || 0,
    });
  }

  if (errors.length > 0) {
    throw new Error(
      `[pSEO] ${errors.length} corrupt row(s) found in Excel:\n${errors.map((e) => `  • ${e}`).join("\n")}`
    );
  }

  if (rows.length === 0) {
    throw new Error(`[pSEO] No valid rows after processing. Check that Slug and Cluster columns are populated.`);
  }

  console.log(`[pSEO] Loaded ${rows.length} keywords (${seenSlugs.size} unique slugs)`);
  _cache = rows;
  return _cache;
}

export function getKeywordBySlug(slug: string): KeywordRow | undefined {
  return getAllKeywords().find((row) => row.slug === slug);
}
