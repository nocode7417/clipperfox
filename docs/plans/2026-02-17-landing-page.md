# Landing Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dark-themed marketing landing page at `/` (1:1 structural clone of DataFast reference), move the clipping tool to `/app`.

**Architecture:** Next.js route groups separate the marketing page (`(marketing)/`) from the tool (`(tool)/app/`). Root layout becomes a bare shell. Each route group gets its own layout with distinct theming.

**Tech Stack:** Next.js 16 App Router, TypeScript, pure CSS (landing page), Tailwind (tool), Iconify icons, next/script.

---

### Task 1: Strip root layout to bare shell

**Files:**
- Modify: `app/layout.tsx`

**Step 1: Rewrite `app/layout.tsx`**

Replace entire file contents with:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "edith",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
```

Key changes:
- Remove `Inter` font import (each route group loads its own)
- Remove `./globals.css` import (tool layout will import it)
- Remove `style={{ backgroundColor: ... }}` from `<body>`
- Keep `suppressHydrationWarning` for browser extension compatibility
- Keep `metadata` with title "edith"

**Step 2: Verify file saved correctly**

Run: `cat app/layout.tsx` — confirm no Inter import, no globals.css import, no style prop.

---

### Task 2: Create marketing layout

**Files:**
- Create: `app/(marketing)/layout.tsx`

**Step 1: Create directory**

```bash
mkdir -p "app/(marketing)"
```

**Step 2: Write `app/(marketing)/layout.tsx`**

```tsx
import Script from "next/script";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />
      <Script
        src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"
        strategy="beforeInteractive"
      />
      <div
        style={{
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          backgroundColor: "#121212",
          color: "#ffffff",
          WebkitFontSmoothing: "antialiased",
          minHeight: "100vh",
          margin: 0,
        }}
      >
        {children}
      </div>
    </>
  );
}
```

Key decisions:
- Inter loaded via Google Fonts `<link>` (matches DataFast source exactly)
- Iconify loaded via `next/script` with `beforeInteractive` strategy
- Dark background `#121212`, white text, full viewport height
- No Tailwind — pure inline styles on the wrapper div

---

### Task 3: Create landing page

**Files:**
- Create: `app/(marketing)/page.tsx`

**Step 1: Write `app/(marketing)/page.tsx`**

This is the largest file. It contains all CSS from the DataFast source as a `<style>` block, with content adapted for edith branding.

```tsx
import Link from "next/link";

export default function LandingPage() {
  return (
    <>
      <style>{`
        .container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        .navbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 0;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 18px;
          color: white;
        }

        .nav-links {
          display: flex;
          gap: 32px;
          align-items: center;
        }

        .nav-item {
          color: #d4d4d8;
          font-size: 15px;
          text-decoration: none;
          cursor: pointer;
          font-weight: 500;
        }

        .hero {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding-top: 80px;
          padding-bottom: 120px;
          text-align: center;
        }

        .hero-title {
          font-size: 64px;
          font-weight: 700;
          line-height: 1.1;
          letter-spacing: -0.02em;
          margin: 0 0 24px 0;
          color: white;
        }

        .hero-subtitle {
          font-size: 20px;
          line-height: 1.5;
          color: #a1a1aa;
          max-width: 640px;
          margin: 0 0 48px 0;
        }

        .form-container {
          width: 100%;
          max-width: 360px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .input-wrapper {
          display: flex;
          align-items: center;
          background: #18181b;
          border: 1px solid #3f3f46;
          border-radius: 6px;
          padding: 10px 12px;
          transition: border-color 0.2s;
        }

        .input-wrapper:focus-within {
          border-color: #52525b;
        }

        .input-icon {
          color: #71717a;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 12px;
        }

        .main-input {
          background: transparent;
          border: none;
          outline: none;
          color: white;
          font-size: 15px;
          width: 100%;
          font-family: inherit;
        }

        .main-input::placeholder {
          color: #52525b;
        }

        .cta-button {
          background: linear-gradient(180deg, #f06445 0%, #e15535 100%);
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 16px;
          font-weight: 600;
          padding: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
          text-decoration: none;
        }

        .cta-button:active {
          opacity: 0.95;
        }

        .trial-text {
          font-size: 13px;
          color: #71717a;
          margin-top: 4px;
        }

        .social-proof {
          margin-top: 64px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .avatar-group {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .avatar-wrapper {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          overflow: hidden;
          border: 3px solid #121212;
          margin-left: -10px;
          position: relative;
          z-index: 1;
        }

        .avatar-wrapper:first-child {
          margin-left: 0;
        }

        .avatar-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .loved-text {
          font-size: 15px;
          color: #a1a1aa;
        }

        .loved-text strong {
          color: white;
          font-weight: 600;
        }
      `}</style>

      <div className="container">
        {/* Navigation */}
        <nav className="navbar">
          <div className="logo">edith</div>

          <div className="nav-links">
            <span className="nav-item">How to Use</span>
            <span className="nav-item">FAQ</span>
            <span className="nav-item">Reviews</span>
          </div>
        </nav>

        {/* Hero */}
        <main className="hero">
          <h1 className="hero-title">Clip anything. Keep what matters.</h1>

          <p className="hero-subtitle">
            Paste a link. Trim the moment. Download the clip.<br />
            Works on YouTube, Twitch, and X — no account, no waiting.
          </p>

          <div className="form-container">
            <div className="input-wrapper">
              <div className="input-icon">
                <iconify-icon
                  icon="lucide:scissors"
                  style={{ fontSize: "18px" }}
                ></iconify-icon>
              </div>
              <input
                type="text"
                className="main-input"
                placeholder="Paste a YouTube, Twitch or X link…"
                readOnly
              />
            </div>

            <Link href="/app" className="cta-button">
              Start clipping
              <iconify-icon
                icon="lucide:arrow-right"
                style={{ fontSize: "18px" }}
              ></iconify-icon>
            </Link>

            <div className="trial-text">
              No signup required. Free forever. Just open and use.
            </div>
          </div>

          <div className="social-proof">
            <div className="avatar-group">
              <div className="avatar-wrapper">
                <img
                  src="https://storage.googleapis.com/banani-avatars/avatar%2Fmale%2F25-35%2FEuropean%2F2"
                  alt="User"
                />
              </div>
              <div className="avatar-wrapper">
                <img
                  src="https://storage.googleapis.com/banani-avatars/avatar%2Ffemale%2F25-35%2FHispanic%2F3"
                  alt="User"
                />
              </div>
              <div className="avatar-wrapper">
                <img
                  src="https://storage.googleapis.com/banani-avatars/avatar%2Fmale%2F35-50%2FAfrican%2F4"
                  alt="User"
                />
              </div>
              <div className="avatar-wrapper">
                <img
                  src="https://storage.googleapis.com/banani-avatars/avatar%2Ffemale%2F18-25%2FEast%20Asian%2F1"
                  alt="User"
                />
              </div>
              <div className="avatar-wrapper">
                <img
                  src="https://storage.googleapis.com/banani-avatars/avatar%2Fmale%2F25-35%2FNorth%20American%2F5"
                  alt="User"
                />
              </div>
              <div className="avatar-wrapper">
                <img
                  src="https://storage.googleapis.com/banani-avatars/avatar%2Ffemale%2F25-35%2FEuropean%2F6"
                  alt="User"
                />
              </div>
              <div className="avatar-wrapper">
                <img
                  src="https://storage.googleapis.com/banani-avatars/avatar%2Fmale%2F35-50%2FSouth%20Asian%2F7"
                  alt="User"
                />
              </div>
            </div>
            <div className="loved-text">
              Loved by <strong>13,745</strong> people
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
```

**Important implementation notes:**
- The `iconify-icon` web component requires a TypeScript declaration. Create `types/iconify.d.ts` (see Task 4).
- The input is `readOnly` — it's decorative on the landing page. The CTA links to `/app` where the real tool lives.
- The CTA button uses `Link` from `next/link` wrapping the same visual styling as the DataFast `<button>`.
- CSS class names match DataFast source exactly — no renaming.
- `className` used instead of `class` (React).

---

### Task 4: Add TypeScript declaration for iconify-icon

**Files:**
- Create: `types/iconify.d.ts`

**Step 1: Create types directory and declaration file**

```bash
mkdir -p types
```

```typescript
declare namespace JSX {
  interface IntrinsicElements {
    "iconify-icon": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        icon: string;
        style?: React.CSSProperties;
        width?: string;
        height?: string;
      },
      HTMLElement
    >;
  }
}
```

This tells TypeScript that `<iconify-icon>` is a valid JSX element with an `icon` prop.

---

### Task 5: Create tool layout

**Files:**
- Create: `app/(tool)/layout.tsx`

**Step 1: Create directory structure**

```bash
mkdir -p "app/(tool)/app"
```

**Step 2: Write `app/(tool)/layout.tsx`**

```tsx
import { Inter } from "next/font/google";
import "../globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function ToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={inter.className}
      style={{
        backgroundColor: "#F5F5F7",
        margin: 0,
        minHeight: "100vh",
      }}
    >
      {children}
    </div>
  );
}
```

Key decisions:
- Imports `../globals.css` (relative path up to `app/` where it lives)
- Inter loaded via `next/font/google` (same as original root layout)
- Light background `#F5F5F7`
- Wraps children in a `<div>` (not `<body>` — that's in root layout)

---

### Task 6: Move clipping tool to route group

**Files:**
- Move: `app/page.tsx` → `app/(tool)/app/page.tsx`
- Delete: `app/page.tsx` (after copy)

**Step 1: Copy the file**

```bash
cp "app/page.tsx" "app/(tool)/app/page.tsx"
```

**Step 2: Delete original**

```bash
rm "app/page.tsx"
```

**Step 3: Verify imports in copied file**

The component imports use `@/` alias paths:
- `@/components/UrlInput` ✓
- `@/components/VideoPreview` ✓
- `@/components/Timeline` ✓
- `@/components/ExportButton` ✓

These resolve from project root via `tsconfig.json` paths, so they work regardless of which directory the file is in. No changes needed.

---

### Task 7: Verify build

**Step 1: Run build**

```bash
npm run build
```

**Expected output:**
```
Route (app)
┌ ○ /                    ← landing page (marketing)
├ ○ /_not-found
├ ○ /app                 ← clipping tool
├ ƒ /api/clip
├ ƒ /api/download
└ ƒ /api/metadata
```

Both `/` and `/app` should appear. API routes unchanged.

**Step 2: Smoke test**

```bash
npm run dev
```

- Open `http://localhost:3000` — should show dark landing page with "Clip anything. Keep what matters."
- Click "Start clipping" — should navigate to `/app` with the light-themed clipping tool
- Verify the clipping tool still works at `/app`

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add landing page, move tool to /app route group"
```

---

## Task Summary

| Task | Action | Files |
|------|--------|-------|
| 1 | Strip root layout | Modify `app/layout.tsx` |
| 2 | Marketing layout | Create `app/(marketing)/layout.tsx` |
| 3 | Landing page | Create `app/(marketing)/page.tsx` |
| 4 | Iconify types | Create `types/iconify.d.ts` |
| 5 | Tool layout | Create `app/(tool)/layout.tsx` |
| 6 | Move tool page | Move `app/page.tsx` → `app/(tool)/app/page.tsx` |
| 7 | Build + verify | Run `npm run build`, smoke test, commit |
