# HLS Streaming Optimization for edith

**Date:** 2026-02-17
**Status:** Approved
**Priority:** Phase 1 - Preview Loading Speed

## Overview

Optimize edith's video preview loading to deliver instant playback using HLS (HTTP Live Streaming) instead of progressive MP4 downloads. This reduces preview load time from 10-30 seconds to under 2 seconds for YouTube and Twitch videos.

## Problem Statement

**Current bottleneck:** Users paste a URL and wait 10-30 seconds for progressive MP4 to download before they can preview the video. This creates friction in the clipping workflow.

**Goal:** Instant video preview using adaptive streaming, with critical timeline performance fixes to ensure smooth scrubbing.

## Architecture Approach: Direct HLS Passthrough

**Selected approach:** Extract HLS manifest URLs from yt-dlp and stream directly to the browser with hls.js polyfill.

**Why this approach:**
- Fastest preview loading (instant playback)
- Minimal backend changes (just URL extraction)
- Small client bundle increase (60KB gzipped)
- Works natively on YouTube, Twitch

**Trade-offs accepted:**
- HLS URLs expire in ~6 hours (acceptable for quick-clip workflow)
- Requires hls.js polyfill for Chrome/Firefox (Safari has native support)
- X/Twitter may not provide HLS (falls back to progressive)

## Component Changes

### 1. Backend: Metadata API (`lib/processor.ts`)

**Current behavior:**
- `yt-dlp --dump-json` extracts all formats
- Backend searches for progressive MP4 format
- Returns single `videoUrl` (direct MP4 file)

**New behavior:**
- Extract HLS manifest URL using `yt-dlp --print "%(manifest_url)s"`
- Keep progressive MP4 extraction as fallback
- Return both URLs in metadata response

**New API response:**
```typescript
interface VideoMetadata {
  thumbnail: string;
  duration: number;
  hlsUrl?: string;        // NEW: .m3u8 manifest
  progressiveUrl?: string; // Existing MP4 (fallback)
  isLive: boolean;        // NEW: true for live streams
}
```

**Implementation:**
1. Run `yt-dlp --print "%(manifest_url)s"` to extract HLS URL
2. Keep existing `--dump-json` for progressive format
3. Return both URLs
4. Add `is_live` detection from yt-dlp metadata

### 2. Frontend: HLS Video Player (`app/page.tsx`)

**Dependencies:**
```json
{
  "hls.js": "^1.5.15"  // ~60KB gzipped
}
```

**Player logic:**
```typescript
useEffect(() => {
  if (!videoRef.current) return;

  // Safari has native HLS support
  if (hlsUrl && videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
    videoRef.current.src = hlsUrl;
    return;
  }

  // Chrome/Firefox: use hls.js
  if (hlsUrl && Hls.isSupported()) {
    const hls = new Hls({
      maxBufferLength: 30,  // 30s buffer
      maxMaxBufferLength: 60
    });
    hls.loadSource(hlsUrl);
    hls.attachMedia(videoRef.current);
    return () => hls.destroy();
  }

  // Fallback to progressive
  if (progressiveUrl) {
    videoRef.current.src = progressiveUrl;
  }
}, [hlsUrl, progressiveUrl]);
```

**Changes:**
- Remove `src` prop from video JSX (set dynamically)
- Add HLS initialization with cleanup
- Maintain existing play/pause/timeupdate handlers
- Keep thumbnail fallback for errors

### 3. Timeline Performance Fix (Critical Only)

**Current issue:**
- Pointer move updates state on every pixel → React re-renders
- Handle position updates cause layout recalculation

**Critical fixes:**

**a) CSS transforms instead of layout changes:**
```typescript
// Before (causes layout):
<div style={{ left: `${startPct}%` }}>

// After (GPU-accelerated):
<div style={{ transform: `translateX(${startPct}%)` }}>
```

**b) Prevent unnecessary re-renders:**
```typescript
const Timeline = React.memo(({ start, end, duration, ... }) => {
  // existing logic
});
```

**c) Basic throttling (16ms = 60fps):**
```typescript
const handlePointerMove = useCallback((e: React.PointerEvent) => {
  if (!activeHandle) return;
  if (Date.now() - lastUpdateRef.current < 16) return;
  lastUpdateRef.current = Date.now();
  // existing position calculation
}, [activeHandle, ...]);
```

**Deferred to Phase 3:**
- ❌ requestAnimationFrame batching
- ❌ Web Worker calculations
- ❌ Virtual timeline rendering

## Error Handling

### HLS-specific Errors

**1. Manifest load failure:**
- Automatic fallback to progressive URL
- No error shown to user
- Brief "Loading stream..." indicator

**2. HLS unsupported (old browsers):**
- Detect via `!Hls.isSupported()`
- Use progressive URL immediately
- Seamless user experience

**3. No formats available:**
- Show thumbnail-only mode
- Display: "Preview unavailable. You can still trim and export."

### Platform-Specific Handling

| Platform | HLS | Progressive | Strategy |
|----------|-----|------------|----------|
| YouTube | ✅ | ✅ | HLS → fallback progressive |
| Twitch | ✅ | ✅ | HLS → fallback progressive |
| X/Twitter | ❌ | ✅ | Use progressive directly |

### Live Stream Handling
- Detect via `info.is_live` from yt-dlp
- Show "Live streams cannot be trimmed"
- Disable timeline/export controls
- Allow preview-only mode

### URL Expiration (6-hour limit)
- Video error after successful load
- Show "Preview expired. Re-paste URL to continue."
- Clear message with easy re-paste flow

### Timeout Handling
- 10-second timeout on yt-dlp fetch
- Show "Taking longer than expected..." after 5s
- Allow cancel and retry

## Testing Strategy

### Manual Testing Checklist
- ✅ YouTube URL → HLS preview <2s
- ✅ Twitch URL → HLS preview <2s
- ✅ X/Twitter URL → progressive fallback works
- ✅ Live stream → shows error, preview-only mode
- ✅ Safari → native HLS playback
- ✅ Chrome → hls.js polyfill
- ✅ Mobile → smooth timeline scrubbing
- ✅ Expired URL → clear error message
- ✅ Export clip → existing flow unchanged

### Performance Metrics
- **Time to first frame:** <2s for HLS (baseline: 10-30s)
- **HLS success rate:** >90% for YouTube/Twitch
- **Timeline smoothness:** 60fps during drag
- **Export time:** Baseline for Phase 2

## Rollout Plan

**Phase 1a (this design):**
- HLS preview with progressive fallback
- Critical timeline performance fixes
- Export workflow unchanged

**Phase 1b (measure):**
- Track preview load times
- Monitor HLS vs progressive usage
- Gather user feedback

**Phase 2 (future):**
- Segment-based export optimization
- Download only needed timestamp range
- Faster clip generation

**Phase 3 (future):**
- Advanced timeline optimizations (RAF, workers)
- Only if Phase 1 metrics show need

## Backward Compatibility

- ✅ Progressive flow stays as fallback
- ✅ No breaking API changes
- ✅ Export workflow unchanged
- ✅ Existing error handling preserved

## Success Criteria

**Phase 1 complete when:**
1. YouTube/Twitch videos preview in <2 seconds
2. Timeline dragging is smooth (60fps)
3. Progressive fallback works for X/Twitter
4. Export flow unchanged and functional
5. No increase in error rates

**Metrics to track:**
- Preview load time percentiles (p50, p90, p95)
- HLS adoption rate by platform
- Timeline performance (frame rate during drag)
- Error rate by platform
