/** Browser-local library. Metadata queries deliberately never read media bytes. */
export type MediaKind = "movies" | "tv" | "photos";
export type MediaItem = {
  id: string;
  title: string;
  name: string;
  kind: MediaKind;
  mime: string;
  size: number;
  addedAt: number;
  progress: number;
  duration: number;
  favorite: boolean;
  queued: boolean;
  queueOrder: number;
  watched: boolean;
  episode?: string;
  series?: string;
  season?: number;
  album?: string;
};
type MediaRecord = MediaItem & { fingerprint: string };
type BlobRecord = { id: string; blob: Blob };
export const MAX_MEDIA_BYTES = 500 * 1024 * 1024;
const DB_NAME = "orbit-media";
const META = "items";
const BLOBS = "blobs";
const CHANNEL = "orbit-media-changes";
const listeners = new Set<() => void>();
let database: Promise<IDBDatabase> | undefined;
let channel: BroadcastChannel | undefined;
let observing = false;

function changed() {
  for (const listener of listeners) listener();
}
function observe() {
  if (observing || typeof window === "undefined") return;
  observing = true;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = changed;
    }
  } catch {
    // Some private browsing modes disable BroadcastChannel; storage events remain.
  }
  window.addEventListener("storage", (event) => {
    if (event.key === CHANNEL) changed();
  });
}
function announce() {
  observe();
  changed();
  try {
    if (channel) channel.postMessage("changed");
    else localStorage.setItem(CHANNEL, `${Date.now()}-${Math.random()}`);
  } catch {
    // Updates in this tab still work when cross-tab storage is unavailable.
  }
}
export function subscribeMedia(listener: () => void) {
  observe();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function friendly(error: unknown): Error {
  if (error instanceof Error && error.name === "QuotaExceededError")
    return new Error(
      "Your browser has run out of storage. Remove a few library items, or free space on your device, then try again. Your existing files are unchanged.",
    );
  if (error instanceof Error && error.name === "ConstraintError")
    return new Error(
      "This file is already in your library. Open the existing item instead of importing it again.",
    );
  if (
    error instanceof Error &&
    (error.name === "SecurityError" || error.name === "InvalidStateError")
  )
    return new Error(
      "This browser isn’t allowing local library storage. Use a regular browser window and allow site storage, then try again.",
    );
  return error instanceof Error
    ? error
    : new Error("The local library could not be updated. Please try again.");
}
function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined")
    return Promise.reject(
      new Error(
        "Local library storage isn’t available in this browser. Try a current browser with site storage enabled.",
      ),
    );
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(DB_NAME, 1);
      } catch (error) {
        reject(friendly(error));
        return;
      }
      let abandoned = false;
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(META)) {
          const metadata = db.createObjectStore(META, { keyPath: "id" });
          metadata.createIndex("fingerprint", "fingerprint", { unique: true });
        }
        if (!db.objectStoreNames.contains(BLOBS))
          db.createObjectStore(BLOBS, { keyPath: "id" });
      };
      request.onsuccess = () => {
        const db = request.result;
        if (abandoned) {
          db.close();
          return;
        }
        db.onversionchange = () => {
          db.close();
          database = undefined;
        };
        resolve(db);
      };
      request.onerror = () => reject(friendly(request.error));
      request.onblocked = () => {
        abandoned = true;
        reject(
          new Error(
            "Another Orbit tab is holding the library open. Close other Orbit tabs and try again.",
          ),
        );
      };
    }).catch((error) => {
      database = undefined;
      throw error;
    });
  }
  return database;
}
function metadata(record: MediaRecord): MediaItem {
  const { fingerprint: _fingerprint, ...item } = record;
  return item;
}
function complete<T>(transaction: IDBTransaction, value: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    let requestError: DOMException | null = null;
    transaction.oncomplete = () => {
      try {
        resolve(value());
      } catch (error) {
        reject(friendly(error));
      }
    };
    transaction.onerror = (event) => {
      const next = (event.target as IDBRequest).error || transaction.error;
      if (
        !requestError ||
        next?.name === "ConstraintError" ||
        next?.name === "QuotaExceededError"
      )
        requestError = next;
    };
    transaction.onabort = () =>
      reject(
        friendly(
          requestError ||
            transaction.error ||
            new Error("The library update was interrupted. Please try again."),
        ),
      );
  });
}
export async function listMedia(): Promise<MediaItem[]> {
  const db = await openDatabase();
  const tx = db.transaction(META, "readonly");
  const request = tx.objectStore(META).getAll();
  const records = await complete(tx, () => request.result as MediaRecord[]);
  return records.map(metadata).sort((a, b) => b.addedAt - a.addedAt);
}
export const exportMediaMetadata = listMedia;
export async function getMediaBlob(id: string): Promise<Blob> {
  const db = await openDatabase();
  const tx = db.transaction(BLOBS, "readonly");
  const request = tx.objectStore(BLOBS).get(id);
  const record = await complete(
    tx,
    () => request.result as BlobRecord | undefined,
  );
  if (!record?.blob)
    throw new Error(
      "The original file is missing from this browser. Import it again from your device.",
    );
  return record.blob;
}
const videoExtensions = new Set(["mp4", "webm", "mov", "m4v", "ogv", "ogg"]);
const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
const mimeByExtension: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  ogv: "video/ogg",
  ogg: "video/ogg",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};
export async function addMedia(
  file: File,
  kind: MediaKind,
): Promise<MediaItem> {
  if (!["movies", "tv", "photos"].includes(kind))
    throw new Error("Choose Movies, TV, or Photos before importing.");
  if (!file.size)
    throw new Error(
      `${file.name || "This file"} is empty and cannot be imported.`,
    );
  if (file.size > MAX_MEDIA_BYTES)
    throw new Error(
      `${file.name} is larger than the 500 MB per-file limit. Use a smaller copy for this browser library.`,
    );
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const isImage = imageExtensions.has(extension);
  const isVideo = videoExtensions.has(extension);
  if (kind === "photos" ? !isImage : !isVideo)
    throw new Error(
      kind === "photos"
        ? "Choose a JPG, PNG, WebP, GIF, or AVIF photo."
        : "Choose an MP4, WebM, MOV, M4V, or Ogg video. Browser playback still depends on its video/audio codecs.",
    );
  if (
    file.type &&
    file.type !== "application/octet-stream" &&
    !(kind === "photos"
      ? file.type.startsWith("image/")
      : file.type.startsWith("video/") || file.type === "application/ogg")
  )
    throw new Error(
      "This file’s type does not match the selected library category.",
    );
  try {
    const estimate = await navigator.storage?.estimate();
    if (
      estimate?.quota &&
      estimate.usage !== undefined &&
      file.size > estimate.quota - estimate.usage
    )
      throw new Error(
        "There isn’t enough browser storage for this file. Remove library items or free space before importing it.",
      );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("There isn’t enough")
    )
      throw error;
    // Storage estimates are optional; IndexedDB still enforces the real quota.
  }
  const db = await openDatabase();
  const now = Date.now();
  const item: MediaRecord = {
    id: crypto.randomUUID(),
    title:
      file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[._]+/g, " ")
        .trim()
        .slice(0, 200) || "Untitled",
    name: file.name,
    kind,
    mime:
      file.type && file.type !== "application/octet-stream"
        ? file.type
        : mimeByExtension[extension],
    size: file.size,
    addedAt: now,
    progress: 0,
    duration: 0,
    favorite: false,
    queued: false,
    queueOrder: now,
    watched: false,
    fingerprint: `${file.name}\u0000${file.size}\u0000${file.lastModified}`,
  };
  const tx = db.transaction([META, BLOBS], "readwrite");
  const pending = complete(tx, () => metadata(item));
  tx.objectStore(META).add(item);
  // Re-wrap with a useful MIME type if the operating system omitted it.
  tx.objectStore(BLOBS).add({
    id: item.id,
    blob: new Blob([file], { type: item.mime }),
  } satisfies BlobRecord);
  const result = await pending;
  announce();
  return result;
}
export async function updateMedia(
  id: string,
  patch: Partial<MediaItem>,
): Promise<MediaItem> {
  const db = await openDatabase();
  const tx = db.transaction(META, "readwrite");
  const store = tx.objectStore(META);
  const request = store.get(id);
  let result: MediaItem | undefined;
  let validationError: Error | undefined;
  const pending = complete(tx, () => {
    if (!result)
      throw validationError || new Error("This library item no longer exists.");
    return result;
  });
  request.onsuccess = () => {
    const current = request.result as MediaRecord | undefined;
    if (!current) {
      validationError = new Error("This library item no longer exists.");
      tx.abort();
      return;
    }
    const next = { ...current };
    try {
      if (patch.title !== undefined) {
        if (typeof patch.title !== "string" || !patch.title.trim())
          throw new Error("Give this item a title before saving.");
        next.title = patch.title.trim().slice(0, 200);
      }
      if (patch.episode !== undefined) {
        if (typeof patch.episode !== "string")
          throw new Error("Episode details must be text.");
        next.episode = patch.episode.trim().slice(0, 100);
      }
      for (const key of ["series", "album"] as const) {
        if (patch[key] !== undefined) {
          if (typeof patch[key] !== "string")
            throw new Error("Media details must be text.");
          next[key] = patch[key].trim().slice(0, 100);
        }
      }
      if (patch.season !== undefined) {
        if (
          !Number.isInteger(patch.season) ||
          patch.season < 0 ||
          patch.season > 999
        )
          throw new Error("Season must be a number from 0 to 999.");
        next.season = patch.season;
      }
      for (const key of ["favorite", "queued", "watched"] as const) {
        if (patch[key] !== undefined) {
          if (typeof patch[key] !== "boolean")
            throw new Error("The library update was invalid.");
          next[key] = patch[key];
        }
      }
      for (const key of ["progress", "duration", "queueOrder"] as const) {
        if (patch[key] !== undefined) {
          if (!Number.isFinite(patch[key]) || patch[key]! < 0)
            throw new Error("Playback values must be positive numbers.");
          next[key] = patch[key]!;
        }
      }
      if (next.duration > 0)
        next.progress = Math.min(next.progress, next.duration);
      if (patch.kind !== undefined) {
        if (
          patch.kind !== current.kind &&
          ([patch.kind, current.kind].includes("photos") ||
            !["movies", "tv"].includes(patch.kind))
        )
          throw new Error(
            "Photos and videos cannot be moved into each other’s categories.",
          );
        next.kind = patch.kind;
      }
      result = metadata(next);
      store.put(next);
    } catch (error) {
      validationError = friendly(error);
      tx.abort();
    }
  };
  try {
    const updated = await pending;
    announce();
    return updated;
  } catch (error) {
    throw validationError || friendly(error);
  }
}
export async function deleteMedia(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([META, BLOBS], "readwrite");
  const pending = complete(tx, () => undefined);
  tx.objectStore(META).delete(id);
  tx.objectStore(BLOBS).delete(id);
  await pending;
  announce();
}
