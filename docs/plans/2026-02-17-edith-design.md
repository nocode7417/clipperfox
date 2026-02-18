# Edith — Design Document
**Date:** 2026-02-17
**Status:** Approved

---

## Overview

Edith is a single-page web app with one job: paste a video URL, trim it, download it. It targets YouTube, Twitch, and X (Twitter). The aesthetic is macOS-level minimalism — no marketing copy, no onboarding, no chrome beyond what the task requires.

---

## Stack

- **Framework:** Next.js 14 (App Router), TypeScript
- **Styling:** Tailwind CSS
- **Video processing:** yt-dlp + ffmpeg, invoked as shell subprocesses from API routes
- **Transport:** Server-Sent Events (SSE) for streaming progress
- **Persistence:** None. Stateless. Temp files only.

---

## Project Structure

```
edith/
├── app/
│   ├── page.tsx              # Entire UI
│   ├── layout.tsx            # Inter font, #F5F5F7 background
│   └── api/
│       ├── metadata/route.ts # GET: yt-dlp --dump-json → thumbnail + duration
│       └── clip/route.ts     # POST: SSE stream → yt-dlp → ffmpeg → done event
├── components/
│   ├── UrlInput.tsx
│   ├── VideoPreview.tsx
│   ├── Timeline.tsx
│   └── ExportButton.tsx
├── lib/
│   └── processor.ts          # spawnYtDlp, spawnFfmpeg, parseFfmpegProgress
└── tmp/                      # Ephemeral clips, gitignored, auto-deleted after download
```

---

## UI State Machine

| State | Visible elements |
|---|---|
| `idle` | "edith" wordmark + pill URL input |
| `loading_metadata` | Inline spinner inside right edge of input pill |
| `ready` | Thumbnail + timeline scrubber + Export button (200ms fade-in) |
| `exporting` | Export button morphs into linear progress bar (SSE-driven) |
| `done` | Bar flashes green 400ms → auto-triggers file download → resets to `ready` |
| `error` | Input border → `#FF3B30`, 3px horizontal shake, single gray error line below |

Transitions are driven by local React state. No router changes. No modals. No alerts.

---

## Visual Design

### Brand
- Wordmark: "edith", Inter Medium, `letter-spacing: 0.08em`, color `#1D1D1F`, 18px
- Background: `#F5F5F7`
- No logo, no tagline

### URL Input
- Pill: `border-radius: 50px`, `1px solid #E0E0E0`, `box-shadow: 0 2px 8px rgba(0,0,0,0.06)`
- Width: 600px on desktop, 100% on mobile
- Font: Inter Regular, 15px
- Placeholder: `"Paste a YouTube, Twitch or X link…"`
- Fires on `onPaste` — not `onChange` — to avoid partial-URL requests

### VideoPreview
- 16:9 thumbnail, full-width of input container
- Entrance: `opacity: 0 → 1`, `translateY(4px) → 0`, 200ms ease-out
- No video title shown

### Timeline Scrubber
- Track: full-width, `height: 4px`, `border-radius: 2px`
- Filled region (between handles): `#0071E3` at 40% opacity
- Unfilled region: `#E0E0E0`
- Handles: 16px visible circle; 44px transparent touch target on mobile
- On pointer-down: `scale(1.25) → 1`, spring `cubic-bezier(0.34, 1.56, 0.64, 1)`, 4px effective bounce
- Magnetic repel: handles cannot be dragged within 8px of each other (prevents zero-length clips)
- Timestamps: `HH:MM:SS`, `font-variant-numeric: tabular-nums`, 13px, `#6E6E73`, positioned below each handle

### Export Button
- Default: "Export", `#0071E3`, white text, pill shape
- On click: `scale(0.96) → scale(1)`, 150ms, then morphs into progress bar
- Progress bar: same pill, blue fill via `width` — linear timing, no easing (macOS style)
- On done: `#34C759` (Apple green) for 400ms → reset
- Mobile: `position: fixed; bottom: 1.5rem; left: 1rem; right: 1rem`

---

## Backend

### `GET /api/metadata?url=<encoded>`

Runs `yt-dlp --dump-json --no-playlist --no-download "<url>"`.

Returns:
```json
{ "thumbnail": "https://...", "duration": 312 }
```

Errors: non-zero yt-dlp exit → `400 { "error": "unsupported_source" | "network_error" }`

---

### `POST /api/clip` — SSE stream

Request body:
```json
{ "url": "string", "start": 42, "end": 97 }
```

Server-side validation:
- `end > start`
- `end - start ≤ 600` (10-minute max clip)

SSE event sequence:
```
data: {"type":"progress","phase":"download","pct":0}
...
data: {"type":"progress","phase":"download","pct":60}
data: {"type":"progress","phase":"trim","pct":60}
...
data: {"type":"progress","phase":"trim","pct":100}
data: {"type":"done","downloadId":"<uuid>"}
```

- `download` phase → drives progress bar 0→60%
- `trim` phase → drives progress bar 60→100%
- Client interpolates linearly between events (bar never jumps)
- Clip written to `tmp/<uuid>.mp4`

---

### `GET /api/download?id=<uuid>`

- Streams file with `Content-Disposition: attachment; filename="edith-clip.mp4"`
- Deletes temp file after response closes
- Returns `404` if ID not found (already downloaded or expired)

---

## Error Handling & Constraints

| Concern | Handling |
|---|---|
| Max clip length | 10 min enforced server-side before spawning processes |
| Temp file cleanup | Startup sweep of `tmp/` for files older than 10 minutes |
| Invalid URL | `unsupported_source` error, inline display |
| Network failure | `network_error`, inline display |
| Concurrent clips | No explicit limit — personal-scale tool |
| Auth | None |

---

## Mobile

- Input: full-width pill, same visual treatment
- Thumbnail + timeline: full-width, stacked
- Scrubber handles: 44px touch targets
- Export button: fixed to bottom of viewport
- Font sizes unchanged (15px input reads fine on mobile)

---

## Animations Summary

| Trigger | Animation |
|---|---|
| URL paste → metadata loaded | 200ms fade + 4px lift on thumbnail + timeline |
| Handle pointer-down | scale(1.25)→1 spring bounce |
| Export click | scale(0.96)→1 pulse 150ms |
| Progress fill | Linear width expansion, no easing |
| Done | Green flash 400ms |
| Error | Red border + 3px horizontal shake |
