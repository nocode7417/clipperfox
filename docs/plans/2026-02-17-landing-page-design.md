# Edith — Landing Page Design Document
**Date:** 2026-02-17
**Status:** Approved

---

## Overview

Add a marketing landing page at `/` that is a 1:1 structural replica of the DataFast reference design, adapted with edith branding and messaging. The clipping tool moves to `/app`.

---

## Route Structure (Route Groups)

```
app/
  layout.tsx                  ← bare shell: <html><body> only, no bg, no font
  (marketing)/
    layout.tsx                ← dark bg #121212, Inter via Google Fonts link
    page.tsx                  ← landing page
  (tool)/
    layout.tsx                ← light bg #F5F5F7, Inter, suppressHydrationWarning
    app/
      page.tsx                ← clipping tool (moved from current app/page.tsx)
  api/                        ← unchanged
```

Routes: `/` → landing, `/app` → clipping tool.

---

## Content Mapping (1:1 structural, brand-adapted)

| DataFast element | edith replacement |
|---|---|
| Logo: icon + "DataFast" | Text only: "edith", Inter 600, 18px, white |
| Nav: Pricing · FAQ · Reviews | **How to Use** · FAQ · Reviews |
| Nav: Login button | **Removed** — right side of navbar empty |
| Hero title | "Clip anything. Keep what matters." |
| Hero subtitle | "Paste a link. Trim the moment. Download the clip. Works on YouTube, Twitch, and X — no account, no waiting." |
| Input icon | `lucide:scissors` |
| Input placeholder | "Paste a YouTube, Twitch or X link…" |
| CTA button | "Start clipping" + arrow → links to `/app` |
| Trial text | "No signup required. Free forever. Just open and use." |
| Social proof | Same 7-avatar group, "Loved by **13,745** people" |

---

## Styling Rules

- All CSS from the original source reproduced verbatim as `<style>` blocks in the landing page
- CSS variables preserved exactly: `--background: #121212`, `--primary: #e15535`, all others
- No Tailwind on the landing page — pure CSS to match original exactly
- Iconify loaded via `<Script>` tag (`strategy="beforeInteractive"`)
- Spacing, typography scale, layout values: all identical to source

---

## Layout Fix: Navbar without Login

The original navbar uses `justify-content: space-between` across three children (logo, nav-links, login). Removing the login button leaves two children. The fix: no CSS change needed — two children with `space-between` places logo left and nav-links right, which is actually cleaner.

---

## Files to Create/Modify

| Action | File |
|---|---|
| Modify | `app/layout.tsx` → bare shell only |
| Create | `app/(marketing)/layout.tsx` |
| Create | `app/(marketing)/page.tsx` |
| Create | `app/(tool)/layout.tsx` |
| Move | `app/page.tsx` → `app/(tool)/app/page.tsx` |
