import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Expand,
  Film,
  Image,
  LoaderCircle,
  PictureInPicture2,
  Subtitles,
  X,
} from "lucide-react";
import type { MediaItem } from "./store";
import { getMediaBlob, updateMedia } from "./store";
export function formatDuration(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const s = Math.floor(value);
  return s >= 3600
    ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
    : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
export default function MediaPlayer({
  item,
  onClose,
  onPrevious,
  onNext,
  onUpdate,
}: {
  item: MediaItem;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onUpdate?: (item: MediaItem) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [savingError, setSavingError] = useState("");
  const [loading, setLoading] = useState(true);
  const [subtitle, setSubtitle] = useState<{
    url: string;
    label: string;
  } | null>(null);
  const [pipBusy, setPipBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const subtitleInput = useRef<HTMLInputElement>(null);
  const lastSaved = useRef(0);
  const latestProgress = useRef(item.progress);
  const latestDuration = useRef(item.duration);
  const updated = useRef(onUpdate);
  updated.current = onUpdate;
  const initiallyFocused = useRef(document.activeElement as HTMLElement);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setLoading(true);
    setError("");
    setSavingError("");
    setSubtitle(null);
    latestProgress.current = item.progress;
    latestDuration.current = item.duration;
    getMediaBlob(item.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setUrl(objectUrl);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(
            e instanceof Error ? e.message : "This file could not be opened.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
      video.current?.pause();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      void updateMedia(item.id, {
        progress: latestProgress.current,
        duration: latestDuration.current,
      }).catch(() => {});
    };
  }, [item.id]);
  useEffect(
    () => () => {
      if (subtitle) URL.revokeObjectURL(subtitle.url);
    },
    [subtitle],
  );
  useEffect(() => {
    const previous = initiallyFocused.current;
    shell.current?.querySelector<HTMLElement>("button")?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (
        item.kind === "photos" &&
        !["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)
      ) {
        if (event.key === "ArrowRight") onNext?.();
        if (event.key === "ArrowLeft") onPrevious?.();
      }
      if (event.key === "Tab") {
        const items = shell.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not([type="file"]),video',
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle, true);
    return () => {
      document.removeEventListener("keydown", handle, true);
      previous?.focus();
    };
  }, [onClose, item.kind, onNext, onPrevious]);
  const save = async (ended = false) => {
    const el = video.current;
    if (!el) return;
    const duration = Number.isFinite(el.duration) ? el.duration : 0;
    const progress = Number.isFinite(el.currentTime) ? el.currentTime : 0;
    latestProgress.current = progress;
    latestDuration.current = duration;
    try {
      const result = await updateMedia(item.id, {
        progress,
        duration,
        ...(ended ? { watched: true } : {}),
      });
      updated.current?.(result);
    } catch (e) {
      setSavingError(
        e instanceof Error ? e.message : "Couldn’t save the resume point.",
      );
    }
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shell.current?.requestFullscreen();
    } catch {
      setSavingError(
        "Fullscreen is unavailable here. Use the video’s built-in fullscreen control.",
      );
    }
  };
  const pictureInPicture = async () => {
    if (!video.current) return;
    setPipBusy(true);
    try {
      if (document.pictureInPictureElement)
        await document.exitPictureInPicture();
      else await video.current.requestPictureInPicture();
    } catch {
      setSavingError(
        "Picture-in-picture is unavailable for this video or browser.",
      );
    } finally {
      setPipBusy(false);
    }
  };
  const addSubtitles = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".vtt")) {
      setSavingError("Choose a WebVTT (.vtt) subtitle file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSavingError("Subtitle files must be smaller than 2 MB.");
      return;
    }
    const content = await file.text();
    if (!content.trimStart().startsWith("WEBVTT")) {
      setSavingError("This is not a valid WebVTT subtitle file.");
      return;
    }
    setSubtitle({
      url: URL.createObjectURL(new Blob([content], { type: "text/vtt" })),
      label: file.name,
    });
    setSavingError("");
  };
  return (
    <div
      className="media-player-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="media-player-shell"
        ref={shell}
        role="dialog"
        aria-modal="true"
        aria-label={`Playing ${item.title}`}
      >
        <header className="media-player-heading">
          <div className="media-player-title">
            <span>
              {item.kind === "photos" ? (
                <Image size={20} />
              ) : (
                <Film size={20} />
              )}
            </span>
            <div>
              <h2>{item.title}</h2>
              <p>
                {item.episode || item.name}
                <span> · </span>
                {item.kind === "photos"
                  ? "Photo viewer"
                  : "Local playback · saved on this browser"}
              </p>
            </div>
          </div>
          <button
            className="media-icon"
            onClick={onClose}
            aria-label="Close media player"
          >
            <X size={21} />
          </button>
        </header>
        <div
          className={`media-screen ${item.kind === "photos" ? "photo-screen" : ""}`}
        >
          {loading ? (
            <div className="media-player-state">
              <LoaderCircle className="spin" size={30} />
              <p>Opening your file…</p>
            </div>
          ) : error ? (
            <div className="media-player-state media-playback-error">
              <Film size={35} />
              <h3>This format can’t play here.</h3>
              <p>{error}</p>
              <span>
                MP4 with H.264/AAC is usually the most compatible. A file
                extension alone doesn’t guarantee supported codecs. Your
                original file is unchanged.
              </span>
              {url && (
                <a href={url} download={item.name}>
                  <Download size={15} /> Download original
                </a>
              )}
            </div>
          ) : item.kind === "photos" ? (
            <img
              src={url}
              alt={item.title}
              onError={() =>
                setError(
                  "The browser couldn’t decode this image. Download it to open in another app.",
                )
              }
            />
          ) : (
            <video
              key={item.id}
              ref={video}
              src={url}
              controls
              playsInline
              preload="metadata"
              aria-label={`${item.title} video player`}
              onLoadedMetadata={() => {
                const el = video.current;
                if (!el) return;
                latestDuration.current = Number.isFinite(el.duration)
                  ? el.duration
                  : 0;
                if (item.progress > 0 && item.progress < el.duration - 2)
                  el.currentTime = item.progress;
                void save();
              }}
              onTimeUpdate={() => {
                const el = video.current;
                if (!el) return;
                latestProgress.current = el.currentTime;
                if (Date.now() - lastSaved.current > 5000) {
                  lastSaved.current = Date.now();
                  void save();
                }
              }}
              onPause={() => void save()}
              onEnded={() => void save(true)}
              onError={() =>
                setError(
                  "Your browser could not decode the video or audio in this file. Try another browser, or open the original in a desktop media player.",
                )
              }
            >
              {subtitle && (
                <track
                  key={subtitle.url}
                  kind="subtitles"
                  src={subtitle.url}
                  label={subtitle.label}
                  srcLang="en"
                  default
                />
              )}
              Your browser doesn’t support HTML video.
            </video>
          )}
        </div>
        <div className="media-player-toolbar">
          <div>
            {onPrevious && (
              <button onClick={onPrevious} className="media-tool">
                <ArrowLeft size={15} />
                Previous
              </button>
            )}
            {onNext && (
              <button onClick={onNext} className="media-tool">
                Next
                <ArrowRight size={15} />
              </button>
            )}
          </div>
          <div>
            {item.kind !== "photos" && url && !error && (
              <>
                <input
                  type="file"
                  accept=".vtt,text/vtt"
                  ref={subtitleInput}
                  hidden
                  aria-label="Add subtitles"
                  onChange={(event) => {
                    void addSubtitles(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <button
                  className="media-tool"
                  onClick={() => subtitleInput.current?.click()}
                >
                  <Subtitles size={16} />
                  Subtitles
                </button>
                {document.pictureInPictureEnabled && (
                  <button
                    className="media-tool"
                    disabled={pipBusy}
                    onClick={() => void pictureInPicture()}
                  >
                    <PictureInPicture2 size={16} />
                    <span>Picture-in-picture</span>
                  </button>
                )}
              </>
            )}
            <button className="media-tool" onClick={() => void fullscreen()}>
              <Expand size={16} />
              <span>Fullscreen</span>
            </button>
            {url && (
              <a
                className="media-tool"
                href={url}
                download={item.name}
                aria-label="Download original file"
              >
                <Download size={16} />
                <span>Original</span>
              </a>
            )}
          </div>
        </div>
        {savingError && (
          <div className="media-player-warning" role="status">
            {savingError}
            <button
              onClick={() => setSavingError("")}
              aria-label="Dismiss player notice"
            >
              <X size={13} />
            </button>
          </div>
        )}
        <div className="media-player-footnote">
          <Check size={12} />
          Local file. No streaming subscription, account access, or upload to
          Orbit’s server.
          {subtitle && (
            <span> · Subtitles are temporary for this player session.</span>
          )}
        </div>
      </div>
    </div>
  );
}
