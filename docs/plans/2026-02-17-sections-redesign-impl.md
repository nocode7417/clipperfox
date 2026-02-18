# Implementation Plan: How It Works & FAQ Sections Redesign

**Date:** 2026-02-17
**Design Doc:** `docs/plans/2026-02-17-sections-redesign.md`

## Overview
Replace the current How It Works and FAQ sections in `app/(marketing)/page.tsx` with the DataFast-style card layout and CSS-only accordion design.

## Changes Required

### 1. How It Works Section

**CSS Changes (lines 265-317):**
- Replace `.steps-grid` → `.steps-container` (flex row, max-width 1200px, gap 16px)
- Replace `.step-card` with tall card design (height 420px, vertical flex layout)
- Add `.card-visual` (220px dark zone with centered icon)
- Add `.card-visual-icon` (48px icon with hover color transition)
- Add `.card-body`, `.card-step`, `.card-title`, `.card-desc` for content zone
- Add `.arrow-divider` for arrow separators between cards
- Remove old `.step-number`, `.step-title`, `.step-desc`

**JSX Changes (lines 460-491):**
- Replace 3 simple step cards with DataFast-style tall cards
- Each card: `.card-visual` div → iconify-icon → `.card-body` → step label/title/desc
- Add arrow dividers between cards
- Icons: `lucide:link-2`, `lucide:scissors`, `lucide:download`
- Update copy: "Three steps. That's it." subtitle "No installs. No account. No setup."

### 2. FAQ Section

**CSS Changes (lines 319-358):**
- Update `.faq-list` max-width to 640px, gap to 8px
- Replace `.faq-item` static styling with `details` element styles
- Add `.faq-item[open]` border-color change
- Add `.faq-summary` (padding, flex layout, cursor pointer, hide marker)
- Add `.faq-icon` with rotation transition
- Add `.faq-item[open] .faq-icon` rotate(45deg)
- Add `.faq-answer` padding and typography
- Remove old `.faq-q`, `.faq-a`

**JSX Changes (lines 495-532):**
- Remove `.map()` rendering pattern
- Replace with 6 hardcoded `<details className="faq-item">` elements
- Each: `<summary>` with question text + plus icon → `<p className="faq-answer">` with answer
- Remove subtitle from FAQ section
- Update copy: title "Everything you need to know."

## Implementation Steps
1. Edit CSS: Replace How It Works classes
2. Edit CSS: Replace FAQ classes
3. Edit JSX: Replace How It Works section
4. Edit JSX: Replace FAQ section
5. Verify: `npm run build`

## Files Modified
- `app/(marketing)/page.tsx` (4 targeted edits)
