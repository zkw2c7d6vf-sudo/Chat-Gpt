import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  Film,
  FolderOpen,
  HardDrive,
  Heart,
  Image,
  Library,
  LoaderCircle,
  Pencil,
  Play,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Tv,
  Upload,
  X,
} from "lucide-react";
import type { MediaItem, MediaKind } from "./store";
import {
  addMedia,
  deleteMedia,
  listMedia,
  subscribeMedia,
  updateMedia,
} from "./store";
import MediaPlayer, { formatDuration } from "./MediaPlayer";
import "./media.css";

function bytes(value: number) {
  return value >= 1024 ** 3
    ? `${(value / 1024 ** 3).toFixed(1)} GB`
    : value >= 1024 ** 2
      ? `${(value / 1024 ** 2).toFixed(1)} MB`
      : `${Math.ceil(value / 1024)} KB`;
}
const kindNames: Record<MediaKind, string> = {
  movies: "Movies",
  tv: "TV shows",
  photos: "Photos",
};
function KindIcon({ kind, size = 22 }: { kind: MediaKind; size?: number }) {
  return kind === "movies" ? (
    <Film size={size} />
  ) : kind === "tv" ? (
    <Tv size={size} />
  ) : (
    <Image size={size} />
  );
}
function useLibrary() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setItems(await listMedia());
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Your library could not be opened.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return subscribeMedia(() => void refresh());
  }, [refresh]);
  return { items, loading, error, refresh };
}
function SmallDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>("input,button")?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab") {
        const items = ref.current?.querySelectorAll<HTMLElement>(
          "button,input,select",
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle, true);
    return () => {
      document.removeEventListener("keydown", handle, true);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="media-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="media-small-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="media-dialog-heading">
          <h2>{title}</h2>
          <button
            type="button"
            className="media-icon"
            onClick={onClose}
            aria-label="Close media dialog"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function MediaCenter({
  initialMediaId,
  onOpened,
}: {
  initialMediaId?: string;
  onOpened?: () => void;
}) {
  const { items, loading, error, refresh } = useLibrary();
  const [category, setCategory] = useState<MediaKind>("movies");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    "all" | "favorites" | "unwatched" | "continue"
  >("all");
  const [sort, setSort] = useState("recent");
  const [tab, setTab] = useState<"library" | "tonight">("library");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState<MediaItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [episode, setEpisode] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState("");
  const [notice, setNotice] = useState("");
  const [failures, setFailures] = useState<string[]>([]);
  const [usage, setUsage] = useState<{ usage?: number; quota?: number } | null>(
    null,
  );
  const picker = useRef<HTMLInputElement>(null);
  const consumedId = useRef("");
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (initialMediaId && initialMediaId !== consumedId.current) {
      consumedId.current = initialMediaId;
      setActiveId(initialMediaId);
      onOpened?.();
    }
  }, [initialMediaId, onOpened]);
  useEffect(() => {
    if (!initialMediaId) consumedId.current = "";
  }, [initialMediaId]);
  useEffect(() => {
    void navigator.storage
      ?.estimate?.()
      .then(setUsage)
      .catch(() => {});
  }, [items.length]);
  const active = items.find((i) => i.id === activeId) || null;
  const queue = useMemo(
    () =>
      items
        .filter((i) => i.queued && i.kind !== "photos")
        .sort((a, b) => a.queueOrder - b.queueOrder),
    [items],
  );
  const filtered = useMemo(() => {
    let result = items.filter(
      (item) =>
        item.kind === category &&
        `${item.title} ${item.name} ${item.episode || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    if (filter === "favorites") result = result.filter((i) => i.favorite);
    if (filter === "unwatched") result = result.filter((i) => !i.watched);
    if (filter === "continue")
      result = result.filter(
        (i) => i.progress > 2 && !i.watched && i.kind !== "photos",
      );
    return result.sort(
      sort === "title"
        ? (a, b) => a.title.localeCompare(b.title)
        : (a, b) => b.addedAt - a.addedAt,
    );
  }, [items, category, query, filter, sort]);
  const totalSize = items.reduce((sum, item) => sum + item.size, 0);
  const queuedIds = new Set(queue.map((i) => i.id));
  const action = async (run: () => Promise<unknown>, success = "") => {
    try {
      await run();
      if (success) setNotice(success);
    } catch (e) {
      setFailures([
        e instanceof Error ? e.message : "That change couldn’t be saved.",
      ]);
    }
  };
  const importFiles = async (files: FileList | File[]) => {
    if (busy) return;
    const batch = Array.from(files);
    if (!batch.length) return;
    setBusy(true);
    setFailures([]);
    setNotice("");
    let count = 0;
    const errors: string[] = [];
    try {
      for (let i = 0; i < batch.length; i++) {
        const file = batch[i];
        setImporting(`Adding ${i + 1} of ${batch.length} · ${file.name}`);
        try {
          await addMedia(file, category);
          count++;
        } catch (e) {
          errors.push(
            `${file.name}: ${e instanceof Error ? e.message : "Could not import this file."}`,
          );
        }
      }
      if (count)
        setNotice(
          `${count} ${count === 1 ? "file" : "files"} added to ${kindNames[category].toLowerCase()}. Originals stay on this device.`,
        );
      setFailures(errors);
      await refresh();
    } finally {
      setBusy(false);
      setImporting("");
      if (picker.current) picker.current.value = "";
    }
  };
  const openPicker = () => {
    picker.current?.click();
  };
  const closePlayer = useCallback(() => setActiveId(null), []);
  const closeEdit = useCallback(() => setEditing(null), []);
  const closeDelete = useCallback(() => setDeleting(null), []);
  const edit = (item: MediaItem) => {
    setEditing(item);
    setEditTitle(item.title);
    setEpisode(item.episode || "");
  };
  const saveDetails = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !editTitle.trim()) return;
    setBusy(true);
    try {
      await updateMedia(editing.id, {
        title: editTitle.trim().slice(0, 200),
        episode: episode.trim().slice(0, 80),
      });
      setEditing(null);
      setNotice("Details saved. Your original filename is unchanged.");
    } catch (e) {
      setFailures([
        e instanceof Error ? e.message : "Details couldn’t be saved.",
      ]);
    } finally {
      setBusy(false);
    }
  };
  const moveQueue = async (index: number, direction: -1 | 1) => {
    const other = queue[index + direction];
    const current = queue[index];
    if (!other || !current) return;
    await action(async () => {
      await updateMedia(current.id, { queueOrder: other.queueOrder });
      await updateMedia(other.id, { queueOrder: current.queueOrder });
    });
  };
  const toggleQueue = (item: MediaItem) =>
    action(
      () =>
        updateMedia(item.id, {
          queued: !item.queued,
          queueOrder: item.queued
            ? item.queueOrder
            : Math.max(0, ...queue.map((i) => i.queueOrder)) + 1,
        }),
      item.queued
        ? "Removed from tonight’s queue."
        : "Added to tonight’s queue.",
    );
  const showing = tab === "tonight" ? queue : filtered;
  const activeIndex = active
    ? showing.findIndex((i) => i.id === active.id)
    : -1;
  const storagePercent = usage?.quota
    ? Math.min(100, Math.round(((usage.usage || 0) / usage.quota) * 100))
    : null;
  return (
    <div className="media-center">
      <div className="media-topline">
        <div className="media-main-tabs">
          <button
            className={tab === "library" ? "active" : ""}
            onClick={() => setTab("library")}
          >
            <Library size={16} />
            Your library
          </button>
          <button
            className={tab === "tonight" ? "active" : ""}
            onClick={() => setTab("tonight")}
          >
            <Sparkles size={15} />
            Tonight’s queue<span>{queue.length}</span>
          </button>
        </div>
        <span className="media-private-label">
          <ShieldCheck size={13} />
          ON THIS DEVICE
        </span>
      </div>
      <section className="media-library-intro">
        <div>
          <span className="media-eyebrow">YOUR PERSONAL MEDIA CENTER</span>
          <h2>
            {tab === "tonight"
              ? "A little something to look forward to."
              : "A home for your favorites."}
          </h2>
          <p>
            {tab === "tonight"
              ? "Pick a movie, line up an episode, and make a night of it."
              : "Your movies, TV, and photos. A built-in player. No extra tabs."}
          </p>
        </div>
        <button
          className="media-import-button"
          onClick={openPicker}
          disabled={busy}
        >
          <Plus size={17} />
          Add {category === "photos" ? "photos" : "media"}
          <ChevronDown size={13} />
        </button>
      </section>
      <input
        type="file"
        ref={picker}
        hidden
        multiple
        accept={
          category === "photos"
            ? "image/jpeg,image/png,image/webp,image/gif,image/avif,.jpg,.jpeg,.png,.webp,.gif,.avif"
            : "video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.m4v,.webm,.mov,.ogv"
        }
        aria-label="Import media files"
        onChange={(e) => {
          if (e.target.files) void importFiles(e.target.files);
        }}
      />
      {(notice || busy) && (
        <div className="media-notice" role="status">
          {busy ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <Check size={15} />
          )}
          <span>{importing || notice}</span>
          {!busy && (
            <button
              className="media-icon"
              aria-label="Dismiss library notice"
              onClick={() => setNotice("")}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      {failures.length > 0 && (
        <div className="media-errors" role="alert">
          <div>
            <strong>
              {failures.length > 1
                ? `${failures.length} files need attention`
                : "A little attention needed"}
            </strong>
            <button
              className="media-icon"
              aria-label="Dismiss media error"
              onClick={() => setFailures([])}
            >
              <X size={14} />
            </button>
          </div>
          <ul>
            {failures.map((failure, i) => (
              <li key={i}>{failure}</li>
            ))}
          </ul>
        </div>
      )}
      {tab === "library" && (
        <>
          <div className="media-category-tabs">
            {(["movies", "tv", "photos"] as MediaKind[]).map((kind) => (
              <button
                key={kind}
                className={category === kind ? "active" : ""}
                onClick={() => {
                  setCategory(kind);
                  setQuery("");
                  setFilter("all");
                }}
              >
                <KindIcon kind={kind} size={18} />
                {kindNames[kind]}
                <span>{items.filter((i) => i.kind === kind).length}</span>
              </button>
            ))}
          </div>
          <div className="media-toolbar">
            <label className="media-search">
              <Search size={16} />
              <input
                type="search"
                aria-label="Search your media"
                placeholder={`Find a ${category === "movies" ? "movie" : category === "tv" ? "show or episode" : "photo"}…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div>
              <label className="media-filter">
                <SlidersHorizontal size={14} />
                <select
                  aria-label="Filter media"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as typeof filter)}
                >
                  <option value="all">
                    All {kindNames[category].toLowerCase()}
                  </option>
                  <option value="favorites">Favorites</option>
                  {category !== "photos" && (
                    <>
                      <option value="unwatched">Not watched</option>
                      <option value="continue">Continue watching</option>
                    </>
                  )}
                </select>
              </label>
              <label className="media-sort">
                <select
                  aria-label="Sort media"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="recent">Recently added</option>
                  <option value="title">Title A–Z</option>
                </select>
                <ChevronDown size={12} />
              </label>
            </div>
          </div>
        </>
      )}
      {loading ? (
        <div className="media-empty">
          <LoaderCircle size={30} className="spin" />
          <h3>Opening your library…</h3>
        </div>
      ) : error ? (
        <div className="media-empty">
          <HardDrive size={32} />
          <h3>Your library couldn’t open.</h3>
          <p>{error}</p>
          <button className="media-secondary" onClick={() => void refresh()}>
            Try again
            <ArrowRight size={14} />
          </button>
        </div>
      ) : tab === "tonight" ? (
        <div className="media-tonight">
          <div className="media-queue-explainer">
            <span>
              <Sparkles size={18} />
            </span>
            <div>
              <h3>Your night. Your lineup.</h3>
              <p>
                Queue a local movie or episode from the library. Reorder it
                here; nothing plays until you choose it.
              </p>
            </div>
          </div>
          {queue.length ? (
            <ol className="media-queue-list">
              {queue.map((item, index) => (
                <li key={item.id}>
                  <span className="queue-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={`queue-art kind-${item.kind}`}>
                    <KindIcon kind={item.kind} />
                  </span>
                  <button
                    className="queue-title"
                    onClick={() => setActiveId(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span>
                      {item.episode || kindNames[item.kind]} ·{" "}
                      {item.duration
                        ? formatDuration(item.duration)
                        : bytes(item.size)}
                      {item.progress > 2
                        ? ` · Resume ${formatDuration(item.progress)}`
                        : ""}
                    </span>
                  </button>
                  <div className="queue-actions">
                    <button
                      className="media-icon"
                      disabled={index === 0}
                      aria-label={`Move ${item.title} up`}
                      onClick={() => void moveQueue(index, -1)}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="media-icon"
                      disabled={index === queue.length - 1}
                      aria-label={`Move ${item.title} down`}
                      onClick={() => void moveQueue(index, 1)}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      className="media-icon"
                      aria-label={`Remove ${item.title} from queue`}
                      onClick={() => void toggleQueue(item)}
                    >
                      <X size={15} />
                    </button>
                    <button
                      className="queue-play"
                      aria-label={`Play ${item.title}`}
                      onClick={() => setActiveId(item.id)}
                    >
                      <Play size={14} fill="currentColor" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="media-empty queue-empty">
              <div className="media-empty-symbol">
                <Sparkles size={37} />
              </div>
              <h3>Leave a little room for movie night.</h3>
              <p>
                Your queue is empty. Add a local movie or episode, then choose
                “Queue for tonight”.
              </p>
              <button
                className="media-secondary"
                onClick={() => setTab("library")}
              >
                Browse your library
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      ) : filtered.length ? (
        <div
          className="media-grid"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length)
              void importFiles(e.dataTransfer.files);
          }}
        >
          {filtered.map((item) => (
            <article key={item.id} className={`media-item kind-${item.kind}`}>
              <button
                className="media-poster"
                aria-label={`${item.kind === "photos" ? "View" : "Play"} ${item.title}`}
                onClick={() => setActiveId(item.id)}
              >
                <div className="poster-grid" />
                <span className="poster-kind">
                  <KindIcon kind={item.kind} size={15} />
                  {item.kind === "tv"
                    ? "EPISODE"
                    : item.kind === "movies"
                      ? "MOVIE"
                      : "PHOTO"}
                </span>
                <div className="poster-symbol">
                  <KindIcon kind={item.kind} size={55} />
                </div>
                <span className="poster-play">
                  {item.kind === "photos" ? (
                    <Image size={19} />
                  ) : (
                    <Play size={18} fill="currentColor" />
                  )}
                </span>
                {item.watched && (
                  <span className="poster-watched">
                    <Check size={11} />
                    Watched
                  </span>
                )}
                {item.progress > 2 &&
                  !item.watched &&
                  item.kind !== "photos" && (
                    <span className="poster-resume">
                      Resume {formatDuration(item.progress)}
                    </span>
                  )}
                <span className="poster-file-type">
                  {item.name.split(".").at(-1)?.toUpperCase()}
                </span>
                {item.duration > 0 && item.kind !== "photos" && (
                  <span className="poster-duration">
                    {formatDuration(item.duration)}
                  </span>
                )}
                {item.duration > 0 &&
                  item.progress > 0 &&
                  item.kind !== "photos" && (
                    <span className="poster-progress">
                      <i
                        style={{
                          width: `${Math.min(100, (item.progress / item.duration) * 100)}%`,
                        }}
                      />
                    </span>
                  )}
              </button>
              <div className="media-item-details">
                <h3 title={item.title}>{item.title}</h3>
                <p>
                  {item.episode || bytes(item.size)}
                  <span>·</span>
                  {item.kind === "photos"
                    ? "Photo"
                    : item.watched
                      ? "Watched"
                      : item.progress > 2
                        ? "In progress"
                        : "Ready when you are"}
                </p>
              </div>
              <div className="media-item-actions">
                <button
                  className={`media-icon ${item.favorite ? "is-favorite" : ""}`}
                  aria-label={`${item.favorite ? "Unfavorite" : "Favorite"} ${item.title}`}
                  onClick={() =>
                    void action(() =>
                      updateMedia(item.id, { favorite: !item.favorite }),
                    )
                  }
                >
                  <Heart
                    size={15}
                    fill={item.favorite ? "currentColor" : "none"}
                  />
                </button>
                {item.kind !== "photos" && (
                  <button
                    className={`media-queue-toggle ${queuedIds.has(item.id) ? "queued" : ""}`}
                    onClick={() => void toggleQueue(item)}
                    aria-label={`${item.queued ? "Remove from tonight" : "Queue for tonight"} ${item.title}`}
                  >
                    {item.queued ? <Check size={12} /> : <Plus size={12} />}
                    <span>{item.queued ? "Queued" : "Tonight"}</span>
                  </button>
                )}
                <span className="media-action-spacer" />
                {item.kind !== "photos" && (
                  <button
                    className={`media-icon ${item.watched ? "is-watched" : ""}`}
                    aria-label={`${item.watched ? "Mark unwatched" : "Mark watched"} ${item.title}`}
                    onClick={() =>
                      void action(() =>
                        updateMedia(item.id, { watched: !item.watched }),
                      )
                    }
                  >
                    <Check size={15} />
                  </button>
                )}
                <button
                  className="media-icon"
                  aria-label={`Edit ${item.title}`}
                  onClick={() => edit(item)}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="media-icon"
                  aria-label={`Remove ${item.title}`}
                  onClick={() => setDeleting(item)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div
          className={`media-empty media-dropzone ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length)
              void importFiles(e.dataTransfer.files);
          }}
        >
          <div className={`media-empty-art kind-${category}`}>
            <div />
            <div />
            <span>
              <KindIcon kind={category} size={42} />
            </span>
          </div>
          <span className="media-eyebrow">
            {query || filter !== "all"
              ? "A LITTLE SEARCH DETOUR"
              : "YOUR SPACE, READY FOR A STORY"}
          </span>
          <h3>
            {query || filter !== "all"
              ? "No matches in this corner."
              : category === "movies"
                ? "Your next favorite night starts here."
                : category === "tv"
                  ? "A home for “just one more episode”."
                  : "A few moments worth keeping."}
          </h3>
          <p>
            {query || filter !== "all"
              ? "Try another search or clear your filter."
              : category === "photos"
                ? "Add photos from your device. View them here, privately, at your own pace."
                : "Drop local video files here, or choose them from your device. MP4, WebM, MOV, and Ogg containers are accepted; playback depends on their codecs."}
          </p>
          {query || filter !== "all" ? (
            <button
              className="media-secondary"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Clear filters
              <X size={14} />
            </button>
          ) : (
            <button
              className="media-import-button"
              onClick={openPicker}
              disabled={busy}
            >
              <Upload size={15} />
              Choose {category === "photos" ? "photos" : "video files"}
            </button>
          )}
          <span className="media-empty-note">
            {query || filter !== "all"
              ? "Your files are still in the library."
              : "Local files only. No subscriptions, external account access, or server upload."}
          </span>
        </div>
      )}
      <div className="media-storage-footer">
        <span>
          <HardDrive size={14} />
          {items.length} {items.length === 1 ? "file" : "files"}
          <i /> {bytes(totalSize)} in your library
          {storagePercent !== null && (
            <>
              <i />
              {storagePercent}% of browser storage in use
            </>
          )}
        </span>
        <button
          onClick={() =>
            void navigator.storage
              ?.persist?.()
              .then((granted) =>
                setNotice(
                  granted
                    ? "Persistent browser storage is enabled. Keep originals elsewhere too."
                    : "Your browser manages storage automatically. Keep originals elsewhere; clearing site data removes the library.",
                ),
              )
              .catch(() =>
                setNotice(
                  "Persistent storage could not be requested. Keep your original files.",
                ),
              )
          }
        >
          <ShieldCheck size={12} />
          Protect local storage
          <ArrowUpRight size={12} />
        </button>
      </div>
      <p className="media-storage-note">
        This browser stores a copy of imported files, up to 500 MB each. Keep
        your originals: clearing site data or browser storage eviction can
        remove the library. Streaming-service downloads and DRM-protected files
        won’t play here.
      </p>
      {active && (
        <MediaPlayer
          item={active}
          onClose={closePlayer}
          onPrevious={
            activeIndex > 0
              ? () => setActiveId(showing[activeIndex - 1].id)
              : undefined
          }
          onNext={
            activeIndex >= 0 && activeIndex < showing.length - 1
              ? () => setActiveId(showing[activeIndex + 1].id)
              : undefined
          }
        />
      )}
      {editing && (
        <SmallDialog title="A few details" onClose={closeEdit}>
          <form className="media-details-form" onSubmit={saveDetails}>
            <label>
              Title
              <input
                aria-label="Media title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={200}
                required
              />
            </label>
            {editing.kind === "tv" && (
              <label>
                Episode or season
                <input
                  aria-label="Episode or season"
                  value={episode}
                  onChange={(e) => setEpisode(e.target.value)}
                  maxLength={80}
                  placeholder="Season 1 · Episode 2"
                />
              </label>
            )}
            <p>Your original filename stays {editing.name}.</p>
            <button
              className="media-import-button"
              type="submit"
              disabled={busy || !editTitle.trim()}
            >
              <Check size={15} />
              Save details
            </button>
          </form>
        </SmallDialog>
      )}
      {deleting && (
        <SmallDialog title="Remove this file?" onClose={closeDelete}>
          <p className="media-delete-explainer">
            Remove <strong>{deleting.title}</strong> and its resume point from
            this browser’s library? Your original file on your computer is
            unchanged.
          </p>
          <div className="media-dialog-actions">
            <button className="media-secondary" onClick={closeDelete}>
              Keep it
            </button>
            <button
              className="media-delete-confirm"
              onClick={() =>
                void action(async () => {
                  await deleteMedia(deleting.id);
                  setDeleting(null);
                  if (activeId === deleting.id) setActiveId(null);
                }, "Removed from your local library.")
              }
            >
              <Trash2 size={14} />
              Remove from library
            </button>
          </div>
        </SmallDialog>
      )}
    </div>
  );
}

export function MediaSummary({ onOpen }: { onOpen: (id?: string) => void }) {
  const { items, loading, error } = useLibrary();
  const continuing = items
    .filter(
      (item) => item.kind !== "photos" && item.progress > 2 && !item.watched,
    )
    .sort((a, b) => b.addedAt - a.addedAt)[0];
  const queued = items
    .filter((item) => item.queued && item.kind !== "photos")
    .sort((a, b) => a.queueOrder - b.queueOrder);
  const next = continuing || queued[0];
  return (
    <section className="card media-summary-card">
      <div className="media-summary-heading">
        <h2>
          <Film size={17} />A little screen time
        </h2>
        <button
          className="media-icon"
          aria-label="Open media center"
          onClick={() => onOpen()}
        >
          <ArrowUpRight size={16} />
        </button>
      </div>
      {loading ? (
        <p className="media-summary-empty">Opening your local library…</p>
      ) : error ? (
        <p className="media-summary-empty">
          Local media is unavailable in this browser. Open the media center for
          details.
        </p>
      ) : next ? (
        <button className="media-summary-play" onClick={() => onOpen(next.id)}>
          <span className={`summary-media-art kind-${next.kind}`}>
            <KindIcon kind={next.kind} size={25} />
          </span>
          <span>
            <small>
              {continuing
                ? "PICK UP WHERE YOU LEFT OFF"
                : "FIRST IN TONIGHT’S QUEUE"}
            </small>
            <strong>{next.title}</strong>
            <em>
              {continuing
                ? `Resume ${formatDuration(next.progress)}`
                : next.episode || "Ready when you are"}
            </em>
          </span>
          <span className="summary-play-icon">
            <Play size={14} fill="currentColor" />
          </span>
        </button>
      ) : (
        <button className="media-summary-add" onClick={() => onOpen()}>
          <span>
            <FolderOpen size={23} />
          </span>
          <div>
            <strong>Make a little room for movie night.</strong>
            <p>Add your movies, TV, and photos.</p>
          </div>
          <Plus size={17} />
        </button>
      )}
      <div className="media-summary-footer">
        <span>
          {items.length} local {items.length === 1 ? "file" : "files"}
          <i /> {queued.length} queued tonight
        </span>
        <span>
          <ShieldCheck size={10} />
          Private
        </span>
      </div>
    </section>
  );
}
