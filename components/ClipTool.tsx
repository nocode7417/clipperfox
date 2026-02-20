"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type AppState = "idle" | "loading_metadata" | "ready" | "exporting" | "done" | "error";

const ACTION_LABELS: Record<string, { placeholder: string; cta: string; exportLabel: string }> = {
  trim: { placeholder: "Paste a YouTube link to trim\u2026", cta: "Start trimming", exportLabel: "Export" },
  crop: { placeholder: "Paste a YouTube link to crop\u2026", cta: "Start cropping", exportLabel: "Export" },
  cut: { placeholder: "Paste a YouTube link to cut\u2026", cta: "Start cutting", exportLabel: "Export" },
  clip: { placeholder: "Paste a YouTube link to clip\u2026", cta: "Start clipping", exportLabel: "Export" },
};

const DEFAULT_LABELS = { placeholder: "Paste a YouTube link\u2026", cta: "Start clipping", exportLabel: "Export" };

interface ClipToolProps {
  defaultAction?: string;
}

export default function ClipTool({ defaultAction }: ClipToolProps) {
  const labels = (defaultAction && ACTION_LABELS[defaultAction]) || DEFAULT_LABELS;

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
        .ct-form {
          width: 100%;
          max-width: 600px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .ct-input-wrap {
          display: flex;
          align-items: center;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 50px;
          padding: 11px 14px;
          transition: border-color 0.2s;
          position: relative;
        }
        .ct-input-wrap:focus-within { border-color: #3f3f46; }
        .ct-input-wrap.has-error { border: 1.5px solid #FF453A; }
        .ct-input-wrap.shake { animation: ct-shake 200ms ease-in-out; }
        @keyframes ct-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
        .ct-input-icon {
          color: #3f3f46;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 10px;
          flex-shrink: 0;
        }
        .ct-input {
          background: transparent;
          border: none;
          outline: none;
          color: #ffffff;
          font-size: 14px;
          width: 100%;
          font-family: inherit;
        }
        .ct-input::placeholder { color: #3f3f46; }
        .ct-spinner {
          position: absolute;
          right: 20px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid #2a2a2a;
          border-top-color: #e15535;
          animation: ct-spin 0.6s linear infinite;
        }
        @keyframes ct-spin { to { transform: rotate(360deg); } }
        .ct-btn {
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
          box-shadow: none;
          text-decoration: none;
          transition: opacity 0.15s ease, transform 150ms ease-out;
        }
        .ct-btn:hover { opacity: 0.92; }
        .ct-btn:active { opacity: 0.88; }
        .ct-btn.pulse { transform: scale(0.96); }
        .ct-btn:disabled { cursor: default; }
        .ct-export-label { position: relative; z-index: 1; }
        .ct-export-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
        }
        .ct-bar-track {
          width: 100%;
          height: 3px;
          border-radius: 9999px;
          background: #2a2a2a;
          overflow: hidden;
        }
        .ct-bar-fill {
          height: 100%;
          border-radius: 9999px;
          background: #e15535;
          transition: width 400ms linear;
        }
        .ct-status-text {
          font-size: 13px;
          color: #52525b;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.01em;
        }
        .ct-error-text {
          font-size: 13px;
          color: #52525b;
          text-align: center;
        }
        .ct-preview-wrap {
          position: relative;
          width: 100%;
          overflow: hidden;
          border-radius: 16px;
          transition: opacity 200ms ease-out, transform 200ms ease-out;
        }
        .ct-preview-wrap.hidden {
          opacity: 0;
          transform: translateY(4px);
          pointer-events: none;
          height: 0;
          overflow: hidden;
        }
        .ct-preview-wrap.visible { opacity: 1; transform: translateY(0); }
        .ct-preview-video, .ct-preview-img {
          width: 100%;
          aspect-ratio: 16 / 9;
          object-fit: contain;
          border-radius: 16px;
          display: block;
          background: #000;
        }
        .ct-play-btn {
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
        .ct-play-btn.faded { opacity: 0; }
        .ct-skip-fb {
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
          animation: ct-skip-pop 600ms ease forwards;
        }
        .ct-skip-fb-left { left: 18%; }
        .ct-skip-fb-right { right: 18%; }
        @keyframes ct-skip-pop {
          0%   { opacity: 0; transform: translateY(-50%) scale(0.85); }
          15%  { opacity: 1; transform: translateY(-50%) scale(1); }
          70%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-50%) scale(0.95); }
        }
        .ct-play-circle {
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
        .ct-play-circle:hover { transform: scale(1.1); }
        .ct-tl-wrap {
          width: 100%;
          transition: opacity 200ms ease-out, transform 200ms ease-out;
        }
        .ct-tl-wrap.hidden {
          opacity: 0;
          transform: translateY(4px);
          pointer-events: none;
          height: 0;
          overflow: hidden;
        }
        .ct-tl-wrap.visible { opacity: 1; transform: translateY(0); }
        .ct-tl-track {
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
        .ct-tl-bg {
          position: absolute;
          left: 0; right: 0;
          height: 4px;
          border-radius: 9999px;
          background: #2a2a2a;
        }
        .ct-tl-active {
          position: absolute;
          height: 4px;
          border-radius: 9999px;
          background: rgba(225, 85, 53, 0.3);
        }
        .ct-tl-playhead {
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          will-change: left;
        }
        .ct-tl-playhead-line {
          width: 2px;
          height: 20px;
          border-radius: 9999px;
          background: #ffffff;
          opacity: 0.5;
        }
        .ct-tl-handle {
          position: absolute;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ct-tl-handle-touch { width: 44px; height: 44px; position: absolute; }
        .ct-tl-handle-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #e15535;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
          transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .ct-tl-handle-dot.bounce { transform: scale(1.25); }
        .ct-tl-timestamps {
          position: relative;
          width: 100%;
          height: 20px;
          margin-top: 2px;
        }
        .ct-tl-time {
          position: absolute;
          transform: translateX(-50%);
          font-size: 13px;
          color: #52525b;
          font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
          font-variant-numeric: tabular-nums;
        }
        .ct-tl-mark-row {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
        }
        .ct-tl-mark-btn {
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
        .ct-tl-mark-btn:hover { color: #e4e4e7; border-color: #3f3f46; background: #1a1a1a; }
        .ct-tl-mark-btn:active { background: #222; }
        .ct-tl-mark-key {
          font-size: 10px;
          color: #3f3f46;
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 3px;
          padding: 1px 4px;
          font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
          line-height: 1.2;
        }
        @media (max-width: 768px) {
          .ct-input-wrap { padding: 10px 12px; }
          .ct-btn { padding: 14px 20px; font-size: 15px; min-height: 48px; }
          .ct-preview-wrap { border-radius: 10px; }
          .ct-preview-video, .ct-preview-img { border-radius: 10px; }
          .ct-tl-mark-btn { padding: 8px 14px; font-size: 13px; }
        }
      `}</style>

      <div className="ct-form">
        {/* URL Input */}
        <div className={`ct-input-wrap${error ? " has-error shake" : ""}`}>
          <div className="ct-input-icon">
            <iconify-icon icon="lucide:scissors" style={{ fontSize: "16px" }} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => { if (e.key === "Enter") handleInputSubmit(); }}
            className="ct-input"
            placeholder={labels.placeholder}
          />
          {appState === "loading_metadata" && <div className="ct-spinner" />}
        </div>

        {error && <p className="ct-error-text">{error}</p>}

        {/* Video Preview */}
        <div
          className={`ct-preview-wrap ${showPreview ? "visible" : "hidden"}`}
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
                className="ct-preview-video"
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
                  className={`ct-skip-fb ct-skip-fb-${skipFeedback.dir}`}
                  onAnimationEnd={() => setSkipFeedback(null)}
                >
                  {skipFeedback.dir === "right" ? "\u203A\u203A 5s" : "\u2039\u2039 5s"}
                </div>
              )}
              <button
                onClick={togglePlay}
                className={`ct-play-btn${!showControls && isPlaying ? " faded" : ""}`}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                <div className="ct-play-circle">
                  {isPlaying ? (
                    <svg width="20" height="24" viewBox="0 0 20 24" fill="white">
                      <rect x="2" y="0" width="5" height="24" rx="1" />
                      <rect x="13" y="0" width="5" height="24" rx="1" />
                    </svg>
                  ) : (
                    <svg width="22" height="26" viewBox="0 0 22 26" fill="white" style={{ marginLeft: 4 }}>
                      <path d="M2 1.5L20.5 13L2 24.5V1.5Z" />
                    </svg>
                  )}
                </div>
              </button>
            </>
          ) : (
            thumbnail && <img src={thumbnail} alt="" className="ct-preview-img" draggable={false} />
          )}
        </div>

        {/* Timeline */}
        <div className={`ct-tl-wrap ${showPreview ? "visible" : "hidden"}`}>
          <div
            ref={trackRef}
            className="ct-tl-track"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={handleTrackClick}
          >
            <div className="ct-tl-bg" />
            <div className="ct-tl-active" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} />
            {duration > 0 && (
              <div className="ct-tl-playhead" style={{ left: `${playheadPct}%` }}>
                <div className="ct-tl-playhead-line" />
              </div>
            )}
            <div className="ct-tl-handle" style={{ left: `${startPct}%` }} onPointerDown={handlePointerDown("start")}>
              <div className="ct-tl-handle-touch" />
              <div className={`ct-tl-handle-dot${bounceHandle === "start" ? " bounce" : ""}`} />
            </div>
            <div className="ct-tl-handle" style={{ left: `${endPct}%` }} onPointerDown={handlePointerDown("end")}>
              <div className="ct-tl-handle-touch" />
              <div className={`ct-tl-handle-dot${bounceHandle === "end" ? " bounce" : ""}`} />
            </div>
          </div>
          <div className="ct-tl-timestamps">
            <span className="ct-tl-time" style={{ left: `${startPct}%` }}>{formatTime(start)}</span>
            <span className="ct-tl-time" style={{ left: `${endPct}%` }}>{formatTime(end)}</span>
          </div>
          <div className="ct-tl-mark-row">
            <button className="ct-tl-mark-btn" onClick={setStartFromPlayback}>
              Set start <span className="ct-tl-mark-key">I</span>
            </button>
            <button className="ct-tl-mark-btn" onClick={setEndFromPlayback}>
              Set end <span className="ct-tl-mark-key">O</span>
            </button>
          </div>
        </div>

        {/* Export / CTA */}
        {isExporting ? (
          <div className="ct-export-state">
            <div className="ct-bar-track">
              <div className="ct-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="ct-status-text">
              {exportPhase === "download" ? "Downloading" : "Trimming"}&hellip; {Math.round(progress)}%
            </span>
          </div>
        ) : !showPreview ? (
          <button
            onClick={handleInputSubmit}
            disabled={!url.trim() || appState === "loading_metadata"}
            className="ct-btn"
          >
            {labels.cta}
            <iconify-icon icon="lucide:arrow-right" style={{ fontSize: "16px" }} />
          </button>
        ) : (
          <button
            onClick={() => {
              if (appState !== "idle" && appState !== "ready") return;
              setPulse(true);
              setTimeout(() => { setPulse(false); handleExport(); }, 150);
            }}
            className={`ct-btn${pulse ? " pulse" : ""}`}
            style={{
              background: isDone
                ? "#34C759"
                : "linear-gradient(180deg, #f06445 0%, #e15535 100%)",
            }}
          >
            <span className="ct-export-label">
              {isDone ? "Done" : labels.exportLabel}
            </span>
          </button>
        )}
      </div>
    </>
  );
}
