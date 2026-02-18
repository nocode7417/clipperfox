"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type AppState = "idle" | "loading_metadata" | "ready" | "exporting" | "done" | "error";

export default function LandingPage() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [videoTitle, setVideoTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState("");
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [progress, setProgress] = useState(0);
  const [exportPhase, setExportPhase] = useState<"download" | "trim">("download");
  const [videoUrl, setVideoUrl] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(true);
  const [activeHandle, setActiveHandle] = useState<"start" | "end" | null>(null);
  const [bounceHandle, setBounceHandle] = useState<"start" | "end" | null>(null);
  const [pulse, setPulse] = useState(false);
  const [skipFeedback, setSkipFeedback] = useState<{ dir: "left" | "right"; key: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastUpdateRef = useRef(0);

  const buildFilename = useCallback((title: string, startSec: number, endSec: number): string => {
    const stopWords = new Set([
      "a","an","the","and","or","but","in","on","at","to","for","of","with",
      "by","from","this","that","is","are","was","were","be","been","being",
      "have","has","had","do","does","did","will","would","could","should",
      "may","might","it","its","i","you","he","she","we","they","my","your",
      "our","their","how","what","when","where","who","why","about","into",
      "through","just","more","so","if","as","up","out","not","no","can",
      "all","also","get","than","then","now","here","there","which","over",
    ]);
    const words = title
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stopWords.has(w.toLowerCase()))
      .slice(0, 4)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    const shortTitle = words.length > 0 ? words.join("_") : "Clip";
    const fmt = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = Math.round(s % 60);
      return m > 0 ? `${m}m${sec}s` : `${sec}s`;
    };
    return `${shortTitle}_Clip_${fmt(startSec)}-${fmt(endSec)}.mp4`;
  }, []);

  const seekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const skipVideo = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    const next = Math.min(Math.max(videoRef.current.currentTime + seconds, 0), videoRef.current.duration || 0);
    videoRef.current.currentTime = next;
    setCurrentTime(next);
    setSkipFeedback({ dir: seconds > 0 ? "right" : "left", key: Date.now() });
  }, []);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  }, []);

  const fetchMetadata = useCallback(async (inputUrl: string) => {
    setAppState("loading_metadata");
    setError(null);
    setThumbnail("");
    setVideoUrl("");
    setCurrentTime(0);
    setIsPlaying(false);

    try {
      const res = await fetch(
        `/api/metadata?url=${encodeURIComponent(inputUrl)}`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "unsupported_source");
      }
      const data = await res.json();

      if (data.isLive) {
        setThumbnail(data.thumbnail);
        setError("Live streams cannot be trimmed");
        setAppState("error");
        return;
      }

      setThumbnail(data.thumbnail);
      setVideoTitle(data.title || "");
      setVideoUrl(data.videoUrl || "");
      setDuration(data.duration);
      setStart(0);
      setEnd(data.duration);
      setAppState("ready");
    } catch (err) {
      const msg =
        err instanceof Error && err.message === "network_error"
          ? "Something went wrong"
          : "Unsupported source";
      setError(msg);
      setAppState("error");
    }
  }, []);

  const handleExport = useCallback(async () => {
    setAppState("exporting");
    setProgress(0);
    setExportPhase("download");
    setError(null);

    try {
      console.log("[export] Starting with:", { url: url.substring(0, 60), start, end });
      const res = await fetch("/api/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, start, end }),
      });

      console.log("[export] Response:", res.status, res.ok, "body:", !!res.body);

      if (!res.ok || !res.body) {
        throw new Error("export_failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("[export] Stream ended normally");
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const dataMatch = line.match(/^data:\s*(.+)$/m);
          if (!dataMatch) continue;

          try {
            const event = JSON.parse(dataMatch[1]);

            if (event.type === "progress") {
              setProgress(event.pct);
              if (event.phase) setExportPhase(event.phase);
            } else if (event.type === "done") {
              console.log("[export] Done event received:", event.downloadId);
              setProgress(100);
              setAppState("done");

              const a = document.createElement("a");
              a.href = `/api/download?id=${event.downloadId}`;
              const videoId = Math.floor(100 + Math.random() * 90000);
              a.download = `clipperfox-${videoId}.mp4`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);

              setTimeout(() => {
                setAppState("ready");
                setProgress(0);
              }, 2000);
              return;
            } else if (event.type === "error") {
              console.error("[export] Server error event:", event.error);
              throw new Error(event.error);
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }
    } catch (err) {
      console.error("[export] Caught error:", err);
      setError("Something went wrong");
      setAppState("error");
    }
  }, [url, start, end]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").trim();
      if (pasted) {
        setUrl(pasted);
      }
    },
    [fetchMetadata]
  );

  const handleInputSubmit = useCallback(() => {
    if (url.trim()) {
      fetchMetadata(url);
    }
  }, [url, fetchMetadata]);

  // Timeline logic
  const MIN_CLIP_SECONDS = 1;

  const pctToTime = useCallback(
    (pct: number) => Math.max(0, Math.min(duration, (pct / 100) * duration)),
    [duration]
  );

  const clientXToPct = useCallback((clientX: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }, []);

  const handlePointerDown = useCallback(
    (handle: "start" | "end") => (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setActiveHandle(handle);
      setBounceHandle(handle);
      setTimeout(() => setBounceHandle(null), 200);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeHandle) return;
      // Throttle to ~60fps (16ms)
      const now = Date.now();
      if (now - lastUpdateRef.current < 16) return;
      lastUpdateRef.current = now;

      const pct = clientXToPct(e.clientX);
      const time = pctToTime(pct);

      if (activeHandle === "start") {
        const clamped = Math.min(time, end - MIN_CLIP_SECONDS);
        const newStart = Math.max(0, clamped);
        setStart(newStart);
        seekTo(newStart);
      } else {
        const clamped = Math.max(time, start + MIN_CLIP_SECONDS);
        const newEnd = Math.min(duration, clamped);
        setEnd(newEnd);
        seekTo(newEnd);
      }
    },
    [activeHandle, clientXToPct, pctToTime, start, end, duration, seekTo]
  );

  const handlePointerUp = useCallback(() => {
    setActiveHandle(null);
  }, []);

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeHandle) return;
      const pct = clientXToPct(e.clientX);
      const time = pctToTime(pct);
      seekTo(time);
    },
    [activeHandle, clientXToPct, pctToTime, seekTo]
  );

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const setStartFromPlayback = useCallback(() => {
    if (!videoRef.current || duration <= 0) return;
    const t = videoRef.current.currentTime;
    const clamped = Math.min(t, end - MIN_CLIP_SECONDS);
    setStart(Math.max(0, clamped));
    setBounceHandle("start");
    setTimeout(() => setBounceHandle(null), 200);
  }, [duration, end]);

  const setEndFromPlayback = useCallback(() => {
    if (!videoRef.current || duration <= 0) return;
    const t = videoRef.current.currentTime;
    const clamped = Math.max(t, start + MIN_CLIP_SECONDS);
    setEnd(Math.min(duration, clamped));
    setBounceHandle("end");
    setTimeout(() => setBounceHandle(null), 200);
  }, [duration, start]);

  // Keyboard shortcuts: I = set start, O = set end
  useEffect(() => {
    if (appState !== "ready") return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        setStartFromPlayback();
      } else if (e.key === "o" || e.key === "O") {
        e.preventDefault();
        setEndFromPlayback();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        skipVideo(5);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        skipVideo(-5);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [appState, setStartFromPlayback, setEndFromPlayback, skipVideo]);

  const startPct = duration > 0 ? (start / duration) * 100 : 0;
  const endPct = duration > 0 ? (end / duration) * 100 : 100;
  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const hasVideoSource = videoUrl.trim() !== "";
  const showPreview = ["ready", "exporting", "done"].includes(appState);
  const isDone = appState === "done";
  const isExporting = appState === "exporting";

  return (
    <>
      <style>{`
        /* ── Reset & base ── */
        .container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        /* ── Navbar ── */
        .navbar {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          padding: 24px 0;
        }

        .navbar .nav-links {
          justify-self: center;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 9px;
          user-select: none;
          text-decoration: none;
        }

        .logo-mark {
          width: 32px;
          height: 32px;
          border-radius: 17px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-mark img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
          image-rendering: -webkit-optimize-contrast;
        }

        .logo-wordmark {
          font-weight: 600;
          font-size: 16px;
          line-height: 1;
          color: #ffffff;
          letter-spacing: 0.02em;
        }

        .nav-links {
          display: flex;
          gap: 32px;
          align-items: center;
        }

        .nav-item {
          color: #a1a1aa;
          font-size: 14px;
          text-decoration: none;
          cursor: pointer;
          font-weight: 500;
          letter-spacing: 0.01em;
          transition: color 0.15s ease;
        }

        .nav-item:hover {
          color: #ffffff;
        }

        /* ── Hero ── */
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
          font-size: clamp(36px, 7vw, 64px);
          font-weight: 700;
          line-height: 1.05;
          letter-spacing: -0.03em;
          margin: 0 0 20px 0;
          color: #ffffff;
        }

        .hero-title em {
          font-style: normal;
          color: #e15535;
        }

        .hero-subtitle {
          font-size: 17px;
          line-height: 1.7;
          color: #71717a;
          max-width: 500px;
          margin: 0 0 24px 0;
          font-weight: 400;
        }

        .hero-badges {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
          margin: 0 0 48px 0;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #a1a1aa;
          letter-spacing: 0.01em;
        }

        .hero-badge iconify-icon {
          color: #e15535;
        }

        @media (max-width: 480px) {
          .hero-badges {
            gap: 10px 16px;
          }
          .hero-badge {
            font-size: 12px;
          }
        }

        /* ── Form / Tool ── */
        .form-container {
          width: 100%;
          max-width: 600px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .input-wrapper {
          display: flex;
          align-items: center;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 50px;
          padding: 11px 14px;
          transition: border-color 0.2s;
          position: relative;
        }

        .input-wrapper:focus-within {
          border-color: #3f3f46;
        }

        .input-wrapper.has-error {
          border: 1.5px solid #FF453A;
        }

        .input-wrapper.shake {
          animation: shake 200ms ease-in-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }

        .input-icon {
          color: #3f3f46;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 10px;
          flex-shrink: 0;
        }

        .main-input {
          background: transparent;
          border: none;
          outline: none;
          color: #ffffff;
          font-size: 14px;
          width: 100%;
          font-family: inherit;
        }

        .main-input::placeholder {
          color: #3f3f46;
        }

        .url-spinner {
          position: absolute;
          right: 20px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid #2a2a2a;
          border-top-color: #e15535;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .cta-button {
          background: linear-gradient(180deg, #f06445 0%, #e15535 100%);
          border: none;
          border-radius: 50px;
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          padding: 13px 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          letter-spacing: 0.01em;
          box-shadow: 0 2px 12px rgba(225, 85, 53, 0.25);
          text-decoration: none;
          transition: opacity 0.15s ease, box-shadow 0.15s ease, transform 150ms ease-out;
        }

        .cta-button:hover {
          opacity: 0.92;
          box-shadow: 0 4px 20px rgba(225, 85, 53, 0.35);
        }

        .cta-button:active {
          opacity: 0.88;
        }

        .cta-button.pulse {
          transform: scale(0.96);
        }

        .cta-button:disabled {
          cursor: default;
        }

        .export-label {
          position: relative;
          z-index: 1;
        }

        /* ── Export progress state ── */
        .export-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
        }

        .export-bar-track {
          width: 100%;
          height: 3px;
          border-radius: 9999px;
          background: #2a2a2a;
          overflow: hidden;
        }

        .export-bar-fill {
          height: 100%;
          border-radius: 9999px;
          background: #e15535;
          transition: width 400ms linear;
        }

        .export-status-text {
          font-size: 13px;
          color: #52525b;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.01em;
        }

        .url-error-text {
          font-size: 13px;
          color: #52525b;
          text-align: center;
        }

        /* ── Video Preview ── */
        .preview-wrap {
          position: relative;
          width: 100%;
          overflow: hidden;
          border-radius: 16px;
          transition: opacity 200ms ease-out, transform 200ms ease-out;
        }

        .preview-wrap.hidden {
          opacity: 0;
          transform: translateY(4px);
          pointer-events: none;
          height: 0;
          overflow: hidden;
        }

        .preview-wrap.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .preview-video,
        .preview-img {
          width: 100%;
          aspect-ratio: 16 / 9;
          object-fit: contain;
          border-radius: 16px;
          display: block;
          background: #000;
        }

        .preview-play-btn {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 300ms;
          cursor: pointer;
          background: transparent;
          border: none;
        }

        .preview-play-btn.faded {
          opacity: 0;
        }

        .skip-feedback {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.03em;
          padding: 8px 14px;
          border-radius: 20px;
          pointer-events: none;
          animation: skip-pop 600ms ease forwards;
        }

        .skip-feedback-left  { left: 18%; }
        .skip-feedback-right { right: 18%; }

        @keyframes skip-pop {
          0%   { opacity: 0; transform: translateY(-50%) scale(0.85); }
          15%  { opacity: 1; transform: translateY(-50%) scale(1); }
          70%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-50%) scale(0.95); }
        }

        .preview-play-circle {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 150ms;
        }

        .preview-play-circle:hover {
          transform: scale(1.1);
        }

        /* ── Timeline ── */
        .tl-wrap {
          width: 100%;
          transition: opacity 200ms ease-out, transform 200ms ease-out;
        }

        .tl-wrap.hidden {
          opacity: 0;
          transform: translateY(4px);
          pointer-events: none;
          height: 0;
          overflow: hidden;
        }

        .tl-wrap.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .tl-track {
          position: relative;
          width: 100%;
          height: 40px;
          display: flex;
          align-items: center;
          cursor: pointer;
          user-select: none;
          touch-action: none;
          container-type: inline-size;
        }

        .tl-bg {
          position: absolute;
          left: 0;
          right: 0;
          height: 4px;
          border-radius: 9999px;
          background: #2a2a2a;
        }

        .tl-active {
          position: absolute;
          height: 4px;
          border-radius: 9999px;
          background: rgba(225, 85, 53, 0.3);
        }

        .tl-playhead {
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          will-change: left;
        }

        .tl-playhead-line {
          width: 2px;
          height: 20px;
          border-radius: 9999px;
          background: #ffffff;
          opacity: 0.5;
        }

        .tl-handle {
          position: absolute;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tl-handle-touch {
          width: 44px;
          height: 44px;
          position: absolute;
        }

        .tl-handle-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #e15535;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
          transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .tl-handle-dot.bounce {
          transform: scale(1.25);
        }

        .tl-timestamps {
          position: relative;
          width: 100%;
          height: 20px;
          margin-top: 2px;
        }

        .tl-time {
          position: absolute;
          transform: translateX(-50%);
          font-size: 13px;
          color: #52525b;
          font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
          font-variant-numeric: tabular-nums;
        }

        .tl-mark-row {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
        }

        .tl-mark-btn {
          background: transparent;
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          color: #71717a;
          font-size: 12px;
          font-weight: 500;
          padding: 5px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: color 0.15s, border-color 0.15s, background 0.15s;
          font-family: inherit;
          letter-spacing: 0.01em;
        }

        .tl-mark-btn:hover {
          color: #e4e4e7;
          border-color: #3f3f46;
          background: #1a1a1a;
        }

        .tl-mark-btn:active {
          background: #222;
        }

        .tl-mark-key {
          font-size: 10px;
          color: #3f3f46;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 3px;
          padding: 1px 4px;
          font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
          line-height: 1.2;
        }

        /* ── Social proof ── */

        .loved-text strong {
          color: #a1a1aa;
          font-weight: 500;
        }

        /* ── Divider ── */
        .section-divider {
          width: 100%;
          height: 1px;
          background: #1f1f1f;
          margin: 0;
        }

        /* ── How to Use ── */
        .how-to-use {
          padding: 100px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .section-label {
          font-size: 11px;
          font-weight: 600;
          color: #e15535;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 16px;
        }

        .section-title {
          font-size: clamp(24px, 5vw, 36px);
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.02em;
          margin: 0 0 12px 0;
          line-height: 1.1;
        }

        .tutorial-wrap {
          width: 100%;
          max-width: 860px;
          margin-top: 48px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.06);
          background: #0e0e0e;
        }

        .tutorial-wrap video {
          width: 100%;
          display: block;
          border-radius: 0;
          outline: none;
        }

        @media (max-width: 640px) {
          .tutorial-wrap {
            border-radius: 10px;
          }
        }

        /* ── FAQ ── */
        .faq {
          padding: 100px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .faq-list {
          width: 100%;
          max-width: 640px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 48px;
          text-align: left;
        }

        .faq-item {
          background: #161616;
          border: 1px solid #1f1f1f;
          border-radius: 10px;
        }

        .faq-item[open] {
          border-color: #2a2a2a;
        }

        .faq-summary {
          padding: 18px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          list-style: none;
          font-size: 14px;
          font-weight: 500;
          color: #e4e4e7;
        }

        .faq-summary::-webkit-details-marker {
          display: none;
        }

        .faq-icon {
          transition: transform 150ms ease;
          flex-shrink: 0;
          color: #52525b;
          display: flex;
        }

        .faq-item[open] .faq-icon {
          transform: rotate(45deg);
        }

        .faq-answer {
          padding: 0 20px 18px;
          font-size: 13px;
          color: #52525b;
          line-height: 1.65;
          margin: 0;
        }

        /* ── Footer ── */
        .footer {
          padding: 72px 0 56px 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-top: 1px solid #1a1a1a;
        }

        .footer-logo {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .footer-logo-mark {
          width: 20px;
          height: 20px;
          border-radius: 9px;
          overflow: hidden;
          opacity: 0.5;
          flex-shrink: 0;
        }

        .footer-logo-mark img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .footer-logo-text {
          font-size: 13px;
          font-weight: 600;
          color: #52525b;
          letter-spacing: 0.06em;
        }

        .footer-separator {
          font-size: 12px;
          color: #2a2a2a;
          user-select: none;
        }

        .footer-text {
          font-size: 12px;
          color: #3f3f46;
          font-weight: 400;
          letter-spacing: 0.005em;
        }

        /* ── Tablet (≤1024px) ── */
        @media (max-width: 1024px) {
          .hero {
            padding-top: 60px;
            padding-bottom: 80px;
          }
          .how-to-use, .faq {
            padding: 72px 0;
          }
        }

        /* ── Mobile (≤768px) ── */
        @media (max-width: 768px) {
          .container {
            padding: 0 16px;
          }
          .navbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 0;
            gap: 12px;
          }
          .navbar .nav-links {
            justify-self: auto;
            gap: 16px;
            flex-shrink: 0;
          }
          .logo {
            gap: 8px;
            min-width: 0;
          }
          .logo-mark {
            width: 28px;
            height: 28px;
          }
          .logo-wordmark {
            font-size: 15px;
          }
          .nav-item {
            font-size: 13px;
            padding: 6px 0;
          }
          .hero {
            padding-top: 40px;
            padding-bottom: 60px;
          }
          .hero-subtitle {
            font-size: 15px;
            line-height: 1.6;
            max-width: 90%;
          }
          .hero-badges {
            margin: 0 0 32px 0;
          }
          .input-wrapper {
            padding: 10px 12px;
          }
          .cta-button {
            padding: 14px 20px;
            font-size: 15px;
            min-height: 48px;
          }
          .preview-wrap {
            border-radius: 10px;
          }
          .preview-video, .preview-img {
            border-radius: 10px;
          }
          .tl-mark-btn {
            padding: 8px 14px;
            font-size: 13px;
          }
          .how-to-use, .faq {
            padding: 56px 0;
          }
          .faq-summary {
            padding: 16px;
          }
          .faq-answer {
            padding: 0 16px 16px;
          }
          .footer {
            padding: 40px 0 32px 0;
          }
        }
      `}</style>

      <div className="container">
        {/* ── Navigation ── */}
        <nav className="navbar">
          <div className="logo">
            <div className="logo-mark">
              <img src="/images/favicon.png" alt="Clipperfox" draggable={false} />
            </div>
            <span className="logo-wordmark">clipperfox</span>
          </div>
          <div className="nav-links">
            <a href="#how-to-use" className="nav-item">
              How to Use
            </a>
            <a href="#faq" className="nav-item">
              FAQ
            </a>
          </div>
        </nav>

        {/* ── Hero + Tool ── */}
        <main className="hero">
          <h1 className="hero-title">
            Clip the moment.
            <br />
            <em>Keep what counts.</em>
          </h1>

          <p className="hero-subtitle">
            Paste a YouTube link, set your in/out points, and download a clean 720p MP4 &mdash; in under 30 seconds.
          </p>

          <div className="hero-badges">
            <span className="hero-badge"><iconify-icon icon="lucide:check" style={{ fontSize: "13px" }}></iconify-icon> Free forever</span>
            <span className="hero-badge"><iconify-icon icon="lucide:check" style={{ fontSize: "13px" }}></iconify-icon> No signup</span>
            <span className="hero-badge"><iconify-icon icon="lucide:check" style={{ fontSize: "13px" }}></iconify-icon> No watermark</span>
            <span className="hero-badge"><iconify-icon icon="lucide:check" style={{ fontSize: "13px" }}></iconify-icon> No install</span>
          </div>

          <div className="form-container">
            {/* URL Input */}
            <div className={`input-wrapper${error ? " has-error shake" : ""}`}>
              <div className="input-icon">
                <iconify-icon
                  icon="lucide:scissors"
                  style={{ fontSize: "16px" }}
                ></iconify-icon>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInputSubmit();
                }}
                className="main-input"
                placeholder="Paste a YouTube link…"
              />
              {appState === "loading_metadata" && <div className="url-spinner" />}
            </div>

            {error && <p className="url-error-text">{error}</p>}

            {/* Video Preview */}
            <div
              className={`preview-wrap ${showPreview ? "visible" : "hidden"}`}
              onMouseMove={() => setShowControls(true)}
              onMouseLeave={() => isPlaying && setShowControls(false)}
              onTouchEnd={(e) => {
                if (!videoRef.current) return;
                const touch = e.changedTouches[0];
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const now = Date.now();
                const last = lastTapRef.current;
                if (last && now - last.time < 300 && Math.abs(x - last.x) < 60) {
                  // double-tap confirmed
                  const isRight = x > rect.width / 2;
                  skipVideo(isRight ? 10 : -10);
                  lastTapRef.current = null;
                } else {
                  lastTapRef.current = { time: now, x };
                }
              }}
            >
              {hasVideoSource ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    poster={thumbnail}
                    className="preview-video"
                    playsInline
                    preload="metadata"
                    onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                  />

                  {skipFeedback && (
                    <div
                      key={skipFeedback.key}
                      className={`skip-feedback skip-feedback-${skipFeedback.dir}`}
                      onAnimationEnd={() => setSkipFeedback(null)}
                    >
                      {skipFeedback.dir === "right" ? "›› 5s" : "‹‹ 5s"}
                    </div>
                  )}

                  <button
                    onClick={togglePlay}
                    className={`preview-play-btn${!showControls && isPlaying ? " faded" : ""}`}
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    <div className="preview-play-circle">
                      {isPlaying ? (
                        <svg width="20" height="24" viewBox="0 0 20 24" fill="white">
                          <rect x="2" y="0" width="5" height="24" rx="1" />
                          <rect x="13" y="0" width="5" height="24" rx="1" />
                        </svg>
                      ) : (
                        <svg
                          width="22"
                          height="26"
                          viewBox="0 0 22 26"
                          fill="white"
                          style={{ marginLeft: 4 }}
                        >
                          <path d="M2 1.5L20.5 13L2 24.5V1.5Z" />
                        </svg>
                      )}
                    </div>
                  </button>
                </>
              ) : (
                thumbnail && (
                  <img
                    src={thumbnail}
                    alt=""
                    className="preview-img"
                    draggable={false}
                  />
                )
              )}
            </div>

            {/* Timeline */}
            <div className={`tl-wrap ${showPreview ? "visible" : "hidden"}`}>
              <div
                ref={trackRef}
                className="tl-track"
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onClick={handleTrackClick}
              >
                <div className="tl-bg" />

                <div
                  className="tl-active"
                  style={{
                    left: `${startPct}%`,
                    width: `${endPct - startPct}%`,
                  }}
                />

                {duration > 0 && (
                  <div className="tl-playhead" style={{ left: `${playheadPct}%` }}>
                    <div className="tl-playhead-line" />
                  </div>
                )}

                <div
                  className="tl-handle"
                  style={{ left: `${startPct}%` }}
                  onPointerDown={handlePointerDown("start")}
                >
                  <div className="tl-handle-touch" />
                  <div
                    className={`tl-handle-dot${bounceHandle === "start" ? " bounce" : ""}`}
                  />
                </div>

                <div
                  className="tl-handle"
                  style={{ left: `${endPct}%` }}
                  onPointerDown={handlePointerDown("end")}
                >
                  <div className="tl-handle-touch" />
                  <div
                    className={`tl-handle-dot${bounceHandle === "end" ? " bounce" : ""}`}
                  />
                </div>
              </div>

              <div className="tl-timestamps">
                <span className="tl-time" style={{ left: `${startPct}%` }}>
                  {formatTime(start)}
                </span>
                <span className="tl-time" style={{ left: `${endPct}%` }}>
                  {formatTime(end)}
                </span>
              </div>

              <div className="tl-mark-row">
                <button className="tl-mark-btn" onClick={setStartFromPlayback}>
                  Set start <span className="tl-mark-key">I</span>
                </button>
                <button className="tl-mark-btn" onClick={setEndFromPlayback}>
                  Set end <span className="tl-mark-key">O</span>
                </button>
              </div>
            </div>

            {/* Export Button / Progress */}
            {isExporting ? (
              <div className="export-state">
                <div className="export-bar-track">
                  <div className="export-bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="export-status-text">
                  {exportPhase === "download" ? "Downloading" : "Trimming"}&hellip; {Math.round(progress)}%
                </span>
              </div>
            ) : !showPreview ? (
              <button
                onClick={handleInputSubmit}
                disabled={!url.trim() || appState === "loading_metadata"}
                className="cta-button"
              >
                Start clipping
                <iconify-icon
                  icon="lucide:arrow-right"
                  style={{ fontSize: "16px" }}
                ></iconify-icon>
              </button>
            ) : (
              <button
                onClick={() => {
                  if (appState !== "idle" && appState !== "ready") return;
                  setPulse(true);
                  setTimeout(() => {
                    setPulse(false);
                    handleExport();
                  }, 150);
                }}
                className={`cta-button${pulse ? " pulse" : ""}`}
                style={{
                  background: isDone
                    ? "#34C759"
                    : "linear-gradient(180deg, #f06445 0%, #e15535 100%)",
                }}
              >
                <span className="export-label">
                  {isDone ? "Done" : "Export"}
                </span>
              </button>
            )}
          </div>

        </main>

        <div className="section-divider" />

        {/* ── How to Use ── */}
        <section id="how-to-use" className="how-to-use">
          <p className="section-label">How it works</p>
          <h2 className="section-title">See it in action.</h2>

          <div className="tutorial-wrap">
            <video
              src="/videos/tutorial.mp4"
              controls
              playsInline
              preload="metadata"
            />
          </div>
        </section>

        <div className="section-divider" />

        {/* ── FAQ ── */}
        <section id="faq" className="faq">
          <p className="section-label">FAQ</p>
          <h2 className="section-title">Common questions about clipping YouTube videos.</h2>

          <div className="faq-list">
            <details className="faq-item">
              <summary className="faq-summary">
                What platforms does Clipperfox support?
                <iconify-icon icon="lucide:plus" className="faq-icon" style={{ fontSize: "16px" }}></iconify-icon>
              </summary>
              <p className="faq-answer">
                Clipperfox currently supports YouTube, the world&rsquo;s largest video platform with over 800 million active videos.
                You can clip any public YouTube video by pasting its URL directly into the tool. Support for additional platforms
                is planned for future releases, but YouTube covers the vast majority of use cases for content creators, educators,
                and researchers who need to extract specific moments from online video.
              </p>
            </details>

            <details className="faq-item">
              <summary className="faq-summary">
                Is Clipperfox really free with no signup?
                <iconify-icon icon="lucide:plus" className="faq-icon" style={{ fontSize: "16px" }}></iconify-icon>
              </summary>
              <p className="faq-answer">
                Clipperfox is 100% free with no signup, no account creation, and no credit card required. Unlike most video
                clipping tools that gate features behind paywalls or trial periods, Clipperfox provides full functionality &mdash;
                including 720p HD exports &mdash; at zero cost. There are no hidden fees, no watermarks on exported clips,
                and no premium tier. The tool is designed to be genuinely free for everyone.
              </p>
            </details>

            <details className="faq-item">
              <summary className="faq-summary">
                How do I clip a YouTube video online?
                <iconify-icon icon="lucide:plus" className="faq-icon" style={{ fontSize: "16px" }}></iconify-icon>
              </summary>
              <p className="faq-answer">
                Clipping a YouTube video with Clipperfox takes three steps and under 30 seconds. First, paste the YouTube
                video URL into the input field and click &ldquo;Start Clipping.&rdquo; Second, use the frame-accurate timeline to drag
                the start and end handles to your exact desired moment &mdash; or press I and O on your keyboard for precision.
                Third, click &ldquo;Export Clip&rdquo; and your trimmed MP4 downloads automatically. No software installation or
                browser extension is needed.
              </p>
            </details>

            <details className="faq-item">
              <summary className="faq-summary">
                What video quality and format does Clipperfox export?
                <iconify-icon icon="lucide:plus" className="faq-icon" style={{ fontSize: "16px" }}></iconify-icon>
              </summary>
              <p className="faq-answer">
                Every clip exported from Clipperfox is encoded at 1280&times;720 resolution (720p HD) using the H.264 video
                codec and AAC audio at 128 kbps. The output format is MP4, which is universally compatible with every major
                platform including iOS, Android, Windows, macOS, and social media services like Instagram, TikTok, and Twitter.
                Clips are compressed with a CRF value of 18, which delivers near-lossless visual quality at efficient file sizes.
              </p>
            </details>

            <details className="faq-item">
              <summary className="faq-summary">
                How long can a clip be?
                <iconify-icon icon="lucide:plus" className="faq-icon" style={{ fontSize: "16px" }}></iconify-icon>
              </summary>
              <p className="faq-answer">
                Clipperfox supports clips of up to 10 minutes in length. Most clips process in under 30 seconds from the
                moment you click export, depending on the segment duration and your connection speed. The tool uses server-side
                ffmpeg encoding to ensure consistent quality regardless of your device&rsquo;s processing power. Short clips
                under 60 seconds typically finish in 5&ndash;10 seconds.
              </p>
            </details>

            <details className="faq-item">
              <summary className="faq-summary">
                Does Clipperfox store my data or clips?
                <iconify-icon icon="lucide:plus" className="faq-icon" style={{ fontSize: "16px" }}></iconify-icon>
              </summary>
              <p className="faq-answer">
                Clipperfox does not store any user data, clips, or browsing history. Temporary files created during the
                export process are deleted from the server the instant your download completes. No cookies are used for
                tracking, no account data is collected, and no video content is cached or retained. Your privacy is protected
                by design &mdash; the architecture ensures zero data persistence after each session.
              </p>
            </details>

            <details className="faq-item">
              <summary className="faq-summary">
                Can I use Clipperfox on my phone or tablet?
                <iconify-icon icon="lucide:plus" className="faq-icon" style={{ fontSize: "16px" }}></iconify-icon>
              </summary>
              <p className="faq-answer">
                Clipperfox is fully responsive and works on any modern mobile browser including Safari on iOS and Chrome on
                Android. On mobile devices, you can double-tap the left or right side of the video preview to skip backward
                or forward by 10 seconds, replicating the gesture pattern familiar from YouTube&rsquo;s own player. The
                timeline handles are touch-optimized for precise start/end selection on smaller screens.
              </p>
            </details>

            <details className="faq-item">
              <summary className="faq-summary">
                What keyboard shortcuts does Clipperfox offer?
                <iconify-icon icon="lucide:plus" className="faq-icon" style={{ fontSize: "16px" }}></iconify-icon>
              </summary>
              <p className="faq-answer">
                Clipperfox provides professional-grade keyboard shortcuts inspired by non-linear video editors. Press I to set
                the clip start point and O to set the clip end point at the current playback position &mdash; the same convention
                used in Adobe Premiere Pro and DaVinci Resolve. Arrow keys let you skip forward or backward by 5 seconds for
                quick navigation. These shortcuts make it possible to set frame-accurate in/out points without touching the mouse.
              </p>
            </details>

            <details className="faq-item">
              <summary className="faq-summary">
                Is Clipperfox safe to use?
                <iconify-icon icon="lucide:plus" className="faq-icon" style={{ fontSize: "16px" }}></iconify-icon>
              </summary>
              <p className="faq-answer">
                Clipperfox is a browser-based tool that requires no software downloads, browser extensions, or system
                permissions. All processing happens server-side using industry-standard tools (ffmpeg and yt-dlp), and
                no executable code is run on your device beyond the web interface. The site is served over HTTPS with
                security headers including X-Content-Type-Options, X-Frame-Options, and strict referrer policies.
                No personal information is collected at any point.
              </p>
            </details>

            <details className="faq-item">
              <summary className="faq-summary">
                How is Clipperfox different from other YouTube clippers?
                <iconify-icon icon="lucide:plus" className="faq-icon" style={{ fontSize: "16px" }}></iconify-icon>
              </summary>
              <p className="faq-answer">
                Most YouTube clipping tools require account creation, inject watermarks, limit export quality behind
                paywalls, or require desktop software installation. Clipperfox eliminates all of these barriers &mdash;
                it is entirely browser-based, exports in full 720p HD quality, adds no watermark, and requires zero signup.
                The interface is designed for speed: paste, trim, download. Average time from URL to exported clip
                is under 45 seconds.
              </p>
            </details>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="footer">
          <span className="footer-logo">
            <span className="footer-logo-mark">
              <img src="/images/favicon.png" alt="" draggable={false} />
            </span>
            <span className="footer-logo-text">clipperfox</span>
          </span>
          <span className="footer-separator">·</span>
          <span className="footer-text">Free forever</span>
        </footer>
      </div>
    </>
  );
}
