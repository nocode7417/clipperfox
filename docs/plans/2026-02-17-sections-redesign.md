# How It Works + FAQ Sections Redesign
**Date:** 2026-02-17
**Status:** Approved

---

## File to modify
`app/(marketing)/page.tsx` — replace `.how-to-use` section CSS + JSX and `.faq` section CSS + JSX in-place.

---

## How It Works Section

### Layout
- `max-width: 1200px`, centered, `padding: 80px 0`
- Header: `section-label` "How it works" · `section-title` "Three steps. That's it." · `section-subtitle` "No installs. No account. No setup."
- Three cards in a flex row with arrow dividers between them

### Card structure
- `height: 420px`, `flex: 1`, `background: #161616`, `border: 1px solid #222222`, `border-radius: 16px`, `overflow: hidden`
- Two zones: visual zone (top 220px) + card body (below)

### Visual zone (`height: 220px`)
- `background: #0e0e0e`
- Single centered Iconify icon at `font-size: 48px`, color `#2a2a2a`
- On card hover → icon color transitions to `#3f3f46` (150ms ease)
- Card 1: `lucide:link-2` · Card 2: `lucide:scissors` · Card 3: `lucide:download`

### Card body (`padding: 24px`)
- Step label: `"STEP 01"` / `"STEP 02"` / `"STEP 03"` — `font-size: 11px`, `font-weight: 700`, `letter-spacing: 0.1em`, `color: #e15535`, uppercase
- Title: `font-size: 17px`, `font-weight: 600`, `color: #e4e4e7`, `margin: 8px 0`
- Description: `font-size: 13px`, `color: #52525b`, `line-height: 1.65`

### Arrow dividers
- `lucide:arrow-right` at `20px`, color `#2a2a2a`, `flex-shrink: 0`

### Content
| Card | Step | Title | Description |
|---|---|---|---|
| 1 | STEP 01 | Paste a link | YouTube, Twitch, or X. Any public video URL works. |
| 2 | STEP 02 | Trim the frame | Watch the video, drag the handles to your exact moment. |
| 3 | STEP 03 | Download the clip | MP4. Ready in under 30 seconds. Clean and compressed. |

---

## FAQ Section

### Layout
- `max-width: 640px`, centered, `padding: 80px 0`
- Header: `section-label` "FAQ" · `section-title` "Everything you need to know." (no subtitle)
- `gap: 8px` between items

### Accordion mechanism
- `<details>` / `<summary>` HTML — no JavaScript
- Closed: `background: #161616`, `border: 1px solid #1f1f1f`, `border-radius: 10px`
- Open: `border-color: #2a2a2a`
- Summary: `padding: 18px 20px`, `font-size: 14px`, `font-weight: 500`, `color: #e4e4e7`, flex row with `lucide:plus` icon right
- Icon: `transform: rotate(45deg)` on `details[open]`, `transition: 150ms`
- Answer: `padding: 0 20px 18px`, `font-size: 13px`, `color: #52525b`, `line-height: 1.65`
- Remove default `<summary>` triangle: `list-style: none`, `::-webkit-details-marker { display: none }`

### Questions
1. What platforms work with edith? → YouTube, Twitch, and X (Twitter). Any public video URL from these platforms.
2. Does it cost anything? → Nothing. No plan, no trial, no card. edith is free.
3. Do I need an account? → No. Open the tool, paste a link, clip it. That's the whole process.
4. How long can a clip be? → Up to 10 minutes. Most clips take under 30 seconds to process.
5. What format do I get? → MP4. Compressed and clean, ready to save or share.
6. Does edith keep my clips? → No. Your clip is deleted from the server the moment you download it.
