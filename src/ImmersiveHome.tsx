import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { writeLocal } from "./local";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Image,
  Layers3,
  Maximize2,
  Minimize2,
  Minus,
  RotateCcw,
  Search,
  Upload,
  X,
} from "lucide-react";

export type HomeWidgetContext = {
  mode: "compact" | "expanded";
  availableWidth: number;
  availableHeight: number;
  workspace: string;
};
export type HomeWidget = {
  id: string;
  title: string;
  icon: LucideIcon;
  compact: string;
  expanded: string;
  render: (context: HomeWidgetContext) => ReactNode;
  width?: number;
  height?: number;
};
type Geometry = { x: number; y: number; width: number; height: number };
type WindowState = Geometry & {
  closed: boolean;
  minimized: boolean;
  expanded: boolean;
  z: number;
};
type Scene = {
  id: string;
  title: string;
  category: string;
  background: string;
  thumbnail?: string;
  credit?: string;
};
type HomeState = {
  version: 1;
  space: string;
  scene: Scene;
  spaces: Record<string, Record<string, WindowState>>;
};
const KEY = "orbit-home-scene-v2";
const DEFAULT_VISIBLE: Record<string, string[]> = {
  Today: ["upnext", "focus", "weather"],
  Study: ["priorities", "focus", "notes"],
  Focus: ["focus", "ambient"],
  Unwind: ["spotify", "continue"],
};
const SPACES = ["Today", "Study", "Focus", "Unwind"];
const SCENE_COLORS = [
  ["Nightfall", "Space", "#091329", "#283f6d", "#0a1021"],
  ["Blue Hour", "City", "#102138", "#487596", "#0d1729"],
  ["Aurora", "Space", "#0d2534", "#21877f", "#1a2443"],
  ["Moonlight", "Space", "#101a36", "#465d9c", "#0a1224"],
  ["Deep Ocean", "Coast", "#071c38", "#126787", "#071528"],
  ["Forest Rain", "Nature", "#112628", "#285c58", "#0e1d2a"],
  ["Cobalt", "Minimal", "#101837", "#3258b1", "#0c152a"],
  ["Dusk", "Nature", "#241a38", "#965570", "#17152e"],
  ["Alpine Lake", "Nature", "#112c39", "#538e8d", "#182735"],
  ["Midnight City", "City", "#131525", "#534a78", "#0a1426"],
  ["Rose Sunset", "Coast", "#40243f", "#b06c78", "#291f3c"],
  ["Evergreen", "Nature", "#0d292b", "#397768", "#102126"],
  ["Cloud Nine", "Minimal", "#354c6a", "#8e9dbc", "#263653"],
  ["Nebula", "Space", "#1f173b", "#845290", "#12162e"],
  ["Coastal Fog", "Coast", "#23415a", "#7398a9", "#1b3044"],
  ["Golden Hour", "Nature", "#433041", "#b48664", "#242642"],
  ["Pine Ridge", "Nature", "#182b32", "#536e52", "#151c2b"],
  ["Harbor Lights", "City", "#131f3a", "#365a8c", "#25253d"],
  ["Desert Night", "Nature", "#2c2143", "#8c5978", "#13192f"],
  ["Sea Glass", "Coast", "#133c4d", "#5ea1a7", "#153047"],
  ["Slate", "Minimal", "#192532", "#455d74", "#19202b"],
  ["Indigo", "Minimal", "#181b48", "#4b58ab", "#141a33"],
  ["Moss", "Nature", "#1d342f", "#647c5b", "#1b2930"],
  ["Violet Night", "Space", "#191532", "#655caa", "#17152c"],
  ["Copper Sky", "Nature", "#3b2938", "#a56755", "#26243c"],
  ["City Dawn", "City", "#26364d", "#8b8795", "#1a2940"],
  ["Blue Lagoon", "Coast", "#13344c", "#43899f", "#162843"],
  ["Misty Hills", "Nature", "#253846", "#648982", "#233347"],
  ["Northern Sky", "Space", "#0f2e42", "#4177a9", "#172238"],
  ["Starfield", "Space", "#0d1532", "#38416d", "#0b0e1b"],
  ["Evening Drive", "City", "#1c253e", "#6c7194", "#182337"],
  ["Coastline", "Coast", "#213d4c", "#83a5af", "#223b5b"],
  ["Quiet Grey", "Minimal", "#252a38", "#515867", "#1c2532"],
  ["Lavender", "Minimal", "#312b4e", "#81769d", "#1a2037"],
  ["Underwater", "Coast", "#081f3c", "#186e89", "#101d2e"],
  ["Night Garden", "Nature", "#1a2c34", "#537e71", "#111d2e"],
] as const;
const PRESETS: Scene[] = SCENE_COLORS.map(([title, category, a, b, c]) => ({
  id: `preset-${title.toLowerCase().replace(/\s+/g, "-")}`,
  title,
  category,
  background: `radial-gradient(ellipse at 74% 28%, ${b}b5, transparent 52%), radial-gradient(ellipse at 10% 88%, ${c}, transparent 65%), linear-gradient(145deg, ${a}, ${c})`,
}));
const DEFAULT_SCENE = PRESETS[0];
const DEFAULT_GEOMETRIES: Record<string, Geometry> = {
  upnext: { x: 0, y: 0, width: 300, height: 185 },
  priorities: { x: 0, y: 0, width: 310, height: 310 },
  focus: { x: 360, y: 150, width: 320, height: 265 },
  spotify: { x: 0, y: 215, width: 300, height: 190 },
  weather: { x: 880, y: 0, width: 320, height: 290 },
  email: { x: 0, y: 200, width: 320, height: 320 },
  continue: { x: 360, y: 0, width: 320, height: 240 },
  notes: { x: 880, y: 0, width: 310, height: 295 },
  calendar: { x: 700, y: 120, width: 340, height: 340 },
  ambient: { x: 0, y: 0, width: 300, height: 210 },
  files: { x: 360, y: 0, width: 330, height: 275 },
};
const defaultWindow = (
  id: string,
  index: number,
  space = "Today",
): WindowState => ({
  ...(DEFAULT_GEOMETRIES[id] || { x: 20, y: 20, width: 320, height: 260 }),
  closed: !(DEFAULT_VISIBLE[space] || DEFAULT_VISIBLE.Today).includes(id),
  minimized: false,
  expanded: false,
  z: index + 1,
});
function readState(): HomeState {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    if (
      value?.version === 1 &&
      value.spaces &&
      typeof value.spaces === "object" &&
      !Array.isArray(value.spaces) &&
      value.scene &&
      typeof value.scene.background === "string" &&
      typeof value.scene.title === "string" &&
      SPACES.includes(value.space)
    ) {
      const scene = value.scene;
      const validScene =
        PRESETS.find((preset) => preset.id === scene.id) ||
        (safePhoto(scene.background) ||
        (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
          scene.background,
        ) &&
          scene.background.length < 2_100_000)
          ? scene
          : DEFAULT_SCENE);
      const spaces: HomeState["spaces"] = {};
      for (const area of SPACES) {
        const saved = value.spaces[area];
        if (!saved || typeof saved !== "object" || Array.isArray(saved))
          continue;
        spaces[area] = Object.fromEntries(
          Object.entries(saved).filter(([id, state]) => {
            const w = state as WindowState;
            return (
              Object.hasOwn(DEFAULT_GEOMETRIES, id) &&
              w &&
              ["x", "y", "width", "height", "z"].every((key) =>
                Number.isFinite(w[key as keyof WindowState]),
              ) &&
              [w.closed, w.expanded, w.minimized].every(
                (flag) => typeof flag === "boolean",
              )
            );
          }),
        ) as Record<string, WindowState>;
      }
      return { version: 1, space: value.space, scene: validScene, spaces };
    }
  } catch {
    /* local storage unavailable */
  }
  let scene = DEFAULT_SCENE;
  try {
    const old = JSON.parse(
      localStorage.getItem("orbit-immersive-home-v1") || "null",
    );
    if (
      old?.scene &&
      typeof old.scene.background === "string" &&
      (PRESETS.some((preset) => preset.id === old.scene.id) ||
        safePhoto(old.scene.background) ||
        /^data:image\/(png|jpeg|webp);base64,/.test(old.scene.background))
    )
      scene = old.scene;
  } catch {
    /* Leave earlier layout untouched. */
  }
  return { version: 1, space: "Today", scene, spaces: {} };
}
function safePhoto(url: unknown): url is string {
  return (
    typeof url === "string" &&
    /^https:\/\/(?:upload\.wikimedia\.org|commons\.wikimedia\.org)\//.test(url)
  );
}
function plain(text: unknown) {
  return String(text || "")
    .replace(/<[^>]*>/g, "")
    .slice(0, 120);
}
function ScenePicker({
  current,
  onSelect,
  onClose,
}: {
  current: Scene;
  onSelect: (scene: Scene) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<Scene[]>([]);
  const [photoSearch, setPhotoSearch] = useState("landscape nature");
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"presets" | "photos">("photos");
  const uploadRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (tab !== "photos") return () => controller.abort();
    let alive = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      generator: "search",
      gsrnamespace: "6",
      gsrsearch: `filetype:bitmap ${photoSearch || "landscape nature"}`,
      gsrlimit: "24",
      gsroffset: String(offset),
      prop: "imageinfo",
      iiprop: "url|mime|extmetadata",
      iiurlwidth: "1200",
    });
    fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Scene search unavailable");
        return r.json();
      })
      .then((data) => {
        if (!alive) return;
        const items: Scene[] = Object.values(data.query?.pages || {}).flatMap(
          (p: any) => {
            const info = p.imageinfo?.[0];
            if (
              !info ||
              !["image/jpeg", "image/png", "image/webp"].includes(info.mime)
            )
              return [];
            const url = info.thumburl || info.url;
            if (!safePhoto(url)) return [];
            const credit = plain(
              info.extmetadata?.Artist?.value || "Wikimedia Commons",
            );
            return [
              {
                id: `commons-${p.pageid}`,
                title: plain(p.title)
                  .replace(/^File:/, "")
                  .replace(/\.(jpe?g|png|webp)$/i, "")
                  .replace(/[_-]+/g, " "),
                category: "Community photos",
                background: url,
                thumbnail: url,
                credit,
              },
            ];
          },
        );
        setPhotos((prev) =>
          offset === 0
            ? items
            : [
                ...prev,
                ...items.filter((item) => !prev.some((p) => p.id === item.id)),
              ],
        );
        setMore(Boolean(data.continue));
      })
      .catch((e) => {
        if (alive && e.name !== "AbortError")
          setError(
            "Could not load online scenes. Local scenes remain available.",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [tab, photoSearch, offset]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const updateQuery = (value: string) => {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPhotoSearch(value.trim() || "landscape nature");
      setOffset(0);
    }, 400);
  };
  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const items = [
        ...(dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not([hidden])",
        ) || []),
      ].filter((item) => item.getClientRects().length);
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  const filtered =
    tab === "presets"
      ? PRESETS.filter(
          (s) =>
            (category === "All" || category === s.category) &&
            `${s.title} ${s.category}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
      : photos;
  const upload = (file?: File) => {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 1_500_000
    ) {
      setError("Choose a PNG, JPEG, or WebP image smaller than 1.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        try {
          onSelect({
            id: "custom",
            title: file.name,
            category: "My images",
            background: reader.result,
          });
          onClose();
        } catch {
          setError("Could not save this image.");
        }
      }
    };
    reader.readAsDataURL(file);
  };
  return (
    <div
      className="oi-modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Background library"
        className="oi-scene-modal"
      >
        <div className="oi-modal-title">
          <div>
            <h2>Backgrounds</h2>
            <span>Search and select a scene</span>
          </div>
          <button aria-label="Close backgrounds" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <div className="oi-scene-top">
          <div className="oi-scene-search">
            <Search size={17} />
            <input
              aria-label="Search backgrounds"
              placeholder="Search mountains, beaches, cities…"
              value={query}
              onChange={(e) => updateQuery(e.target.value)}
            />
          </div>
          <button onClick={() => uploadRef.current?.click()}>
            <Upload size={16} /> My image
          </button>
          <input
            ref={uploadRef}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </div>
        <div className="oi-scene-tabs">
          <button
            className={tab === "photos" ? "active" : ""}
            onClick={() => {
              setTab("photos");
              setOffset(0);
            }}
          >
            Search photos
          </button>
          <button
            className={tab === "presets" ? "active" : ""}
            onClick={() => setTab("presets")}
          >
            Built-in scenes ({PRESETS.length})
          </button>
        </div>
        {tab === "presets" && (
          <div className="oi-scene-categories">
            {["All", "Nature", "Coast", "City", "Space", "Minimal"].map((c) => (
              <button
                key={c}
                className={category === c ? "active" : ""}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        {error && (
          <p className="oi-scene-error" role="status">
            {error}
          </p>
        )}
        <div className="oi-scene-grid">
          {filtered.map((s) => (
            <button
              className={`oi-scene-option ${current.id === s.id ? "selected" : ""}`}
              key={s.id}
              onClick={() => {
                onSelect(s);
                onClose();
              }}
            >
              <span
                className="oi-scene-thumb"
                style={
                  s.thumbnail
                    ? {
                        backgroundImage: `linear-gradient(#06101b22,#06101b22),url("${s.thumbnail}")`,
                      }
                    : { background: s.background }
                }
              />
              <span className="oi-scene-name">{s.title}</span>
              {current.id === s.id && (
                <Check size={16} className="oi-scene-check" />
              )}
            </button>
          ))}
        </div>
        {tab === "photos" && (
          <div className="oi-scenes-bottom">
            {loading ? (
              "Loading photos…"
            ) : more ? (
              <button onClick={() => setOffset((o) => o + 24)}>
                Load more photos <ChevronDown size={15} />
              </button>
            ) : !photos.length ? (
              "Try a different search or choose built-in scenes."
            ) : (
              ""
            )}
            <small>
              Photos: Wikimedia Commons · External imagery and licenses belong
              to their contributors
            </small>
          </div>
        )}
      </section>
    </div>
  );
}

export default function ImmersiveHome({
  widgets,
  dateLabel,
  greeting,
  clock,
}: {
  widgets: HomeWidget[];
  dateLabel: string;
  greeting: string;
  clock: string;
}) {
  const [saved, setSaved] = useState<HomeState>(readState);
  const [showScenes, setShowScenes] = useState(false);
  const [showWidgets, setShowWidgets] = useState(false);
  const [widgetQuery, setWidgetQuery] = useState("");
  const [layoutUndo, setLayoutUndo] = useState<{
    space: string;
    windows: Record<string, WindowState>;
  } | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(1150);
  const [narrow, setNarrow] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const topZ = useRef(100);
  const frame = useRef<number | null>(null);
  const bodyCache = useRef(new Map<string, ReactNode>());
  const finishRef = useRef<(cancel?: boolean) => void>(() => {});
  const drag = useRef<{
    id: string;
    kind: "move" | "resize";
    startX: number;
    startY: number;
    geometry: Geometry;
    pending: Geometry;
    index: number;
    space: string;
    element: HTMLElement;
    grip: HTMLElement;
    pointerId: number;
  } | null>(null);
  const space = SPACES.includes(saved.space) ? saved.space : "Today";
  const states = saved.spaces[space] || {};
  const windowState = (id: string, index: number): WindowState => ({
    ...defaultWindow(id, index, space),
    ...states[id],
  });
  const setWindows = useCallback(
    (
      change: (
        current: Record<string, WindowState>,
      ) => Record<string, WindowState>,
    ) => {
      setSaved((prev) => {
        const area = prev.space;
        return {
          ...prev,
          spaces: { ...prev.spaces, [area]: change(prev.spaces[area] || {}) },
        };
      });
    },
    [],
  );
  const update = (id: string, index: number, patch: Partial<WindowState>) =>
    setWindows((current) => ({
      ...current,
      [id]: { ...defaultWindow(id, index, space), ...current[id], ...patch },
    }));
  useEffect(() => {
    if (!drag.current) writeLocal(KEY, saved);
  }, [saved]);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishRef.current(true);
    };
    window.addEventListener("keydown", cancel);
    return () => {
      window.removeEventListener("keydown", cancel);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      setCanvasWidth(width);
      setNarrow(width < 900);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const bounded = (g: Geometry) => {
    const width = Math.min(
      Math.max(265, g.width),
      Math.max(265, canvasWidth - 12),
    );
    return {
      ...g,
      x: Math.max(0, Math.min(g.x, canvasWidth - width)),
      y: Math.max(0, Math.min(g.y, 2500)),
      width,
      height: Math.max(170, Math.min(g.height, 950)),
    };
  };
  // Pointer movement stays outside React and storage. Only the final geometry is saved.
  const paintGesture = () => {
    frame.current = null;
    const active = drag.current;
    if (!active) return;
    const { element, pending, geometry, kind } = active;
    if (kind === "move")
      element.style.transform = `translate3d(${pending.x - geometry.x}px, ${pending.y - geometry.y}px, 0)`;
    else {
      element.style.width = `${pending.width}px`;
      element.style.height = `${pending.height}px`;
    }
  };
  const finish = (cancel = false) => {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    const geometry = cancel ? active.geometry : active.pending;
    Object.assign(active.element.style, {
      left: `${geometry.x}px`,
      top: `${geometry.y}px`,
      width: `${geometry.width}px`,
      height: `${geometry.height}px`,
      transform: "",
      willChange: "",
    });
    active.element.removeAttribute("data-manipulating");
    stageRef.current?.closest(".oi-root")?.removeAttribute("data-manipulating");
    if (active.grip.hasPointerCapture(active.pointerId))
      active.grip.releasePointerCapture(active.pointerId);
    setSaved((previous) => ({
      ...previous,
      spaces: {
        ...previous.spaces,
        [active.space]: {
          ...previous.spaces[active.space],
          [active.id]: {
            ...defaultWindow(active.id, active.index, active.space),
            ...previous.spaces[active.space]?.[active.id],
            ...geometry,
            z: ++topZ.current,
          },
        },
      },
    }));
  };
  finishRef.current = finish;
  useEffect(() => {
    if (drag.current && (drag.current.space !== space || narrow))
      finishRef.current(true);
  }, [space, narrow]);
  const start = (
    event: ReactPointerEvent,
    id: string,
    index: number,
    kind: "move" | "resize",
  ) => {
    if (event.button !== 0 || narrow || drag.current) return;
    if (
      kind === "move" &&
      (event.target as HTMLElement).closest("button,input,select,textarea,a")
    )
      return;
    const w = windowState(id, index);
    if (w.expanded) return;
    const element = event.currentTarget.closest<HTMLElement>(".oi-window");
    if (!element) return;
    const geometry = bounded(w);
    topZ.current = Math.max(
      topZ.current,
      ...Object.values(states).map((state) => state.z),
    );
    drag.current = {
      id,
      index,
      space,
      kind,
      startX: event.clientX,
      startY: event.clientY,
      geometry,
      pending: geometry,
      element,
      grip: event.currentTarget as HTMLElement,
      pointerId: event.pointerId,
    };
    element.style.zIndex = String(widgets.length + 1);
    element.style.willChange = kind === "move" ? "transform" : "width, height";
    element.setAttribute("data-manipulating", kind);
    stageRef.current
      ?.closest(".oi-root")
      ?.setAttribute("data-manipulating", kind);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };
  const moving = (event: ReactPointerEvent) => {
    const active = drag.current;
    if (!active || event.pointerId !== active.pointerId) return;
    const dx = event.clientX - active.startX,
      dy = event.clientY - active.startY;
    active.pending = bounded(
      active.kind === "move"
        ? {
            ...active.geometry,
            x: active.geometry.x + dx,
            y: active.geometry.y + dy,
          }
        : {
            ...active.geometry,
            width: active.geometry.width + dx,
            height: active.geometry.height + dy,
          },
    );
    if (frame.current === null)
      frame.current = requestAnimationFrame(paintGesture);
  };
  const reorder = (id: string, delta: number) => {
    const items = widgets
      .map((w, i) => ({ id: w.id, order: windowState(w.id, i).z }))
      .sort((a, b) => a.order - b.order);
    const from = items.findIndex((w) => w.id === id),
      to = Math.min(items.length - 1, Math.max(0, from + delta));
    if (to === from) return;
    const [target] = items.splice(from, 1);
    items.splice(to, 0, target);
    setWindows((current) =>
      Object.fromEntries(
        items.map((w, i) => [
          w.id,
          {
            ...defaultWindow(
              w.id,
              widgets.findIndex((x) => x.id === w.id),
              space,
            ),
            ...current[w.id],
            z: i + 1,
          },
        ]),
      ),
    );
  };
  const raise = (id: string, index: number) => {
    topZ.current = Math.max(
      topZ.current,
      ...Object.values(states).map((state) => state.z),
    );
    update(id, index, { z: ++topZ.current });
  };
  const renderContent = (widget: HomeWidget, context: HomeWidgetContext) => {
    // Parent clock/focus updates can continue without rebuilding panel contents mid-gesture.
    if (drag.current && bodyCache.current.has(widget.id))
      return bodyCache.current.get(widget.id);
    const content = widget.render(context);
    bodyCache.current.set(widget.id, content);
    return content;
  };
  const backdrop =
    saved.scene.background.startsWith("data:") ||
    saved.scene.background.startsWith("https://")
      ? `linear-gradient(#07122060,#07122060),url("${saved.scene.background.replaceAll('"', "")}")`
      : saved.scene.background;
  const ordered = [...widgets].sort(
    (a, b) =>
      windowState(a.id, widgets.indexOf(a)).z -
      windowState(b.id, widgets.indexOf(b)).z,
  );
  return (
    <div
      className={`oi-root scene-home ${narrow ? "oi-narrow" : ""}`}
      data-photo={
        saved.scene.background.startsWith("https://") ||
        saved.scene.background.startsWith("data:")
      }
      style={{ backgroundImage: backdrop }}
    >
      <div className="scene-landscape" aria-hidden="true">
        <div className="scene-stars" />
        <div className="scene-moon" />
        <div className="scene-ridge scene-ridge-far" />
        <div className="scene-ridge scene-ridge-near" />
      </div>
      <div className="scene-greeting">
        <h1>{greeting}, Joe.</h1>
        <p>
          {dateLabel}
          <span>·</span>
          {clock}
          <span>·</span>
          {saved.scene.title}
        </p>
      </div>
      <div className="oi-toolbar">
        <div className="oi-spaces" role="group" aria-label="Workspace">
          {SPACES.map((s) => (
            <button
              key={s}
              className={space === s ? "active" : ""}
              onClick={() => setSaved((prev) => ({ ...prev, space: s }))}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="oi-toolbar-actions">
          <button
            onClick={() => {
              setShowWidgets(true);
              setShowScenes(false);
            }}
          >
            <Layers3 size={15} /> Widgets
          </button>
          <button
            onClick={() => {
              setShowScenes(true);
              setShowWidgets(false);
            }}
          >
            <Image size={15} /> Backgrounds
          </button>
        </div>
      </div>
      <div className="oi-scene-credit">
        {saved.scene.title}
        {saved.scene.credit ? ` · ${saved.scene.credit}` : ""}
      </div>
      <div
        className="oi-stage"
        ref={stageRef}
        aria-label={`${space} workspace`}
        style={
          narrow
            ? undefined
            : {
                minHeight: Math.max(
                  Math.max(410, window.innerHeight - 390),
                  ...widgets.map((widget, index) => {
                    const w = windowState(widget.id, index);
                    return w.closed || w.minimized
                      ? 0
                      : bounded(w).y + bounded(w).height + 20;
                  }),
                ),
              }
        }
      >
        {(narrow ? ordered : widgets).map((widget) => {
          const index = widgets.indexOf(widget),
            w = windowState(widget.id, index);
          if (w.closed || w.minimized) return null;
          const pos = narrow
            ? {}
            : w.expanded
              ? {
                  left: 10,
                  top: -155,
                  width: Math.max(300, canvasWidth - 20),
                  height: Math.max(
                    300,
                    Math.min(850, window.innerHeight - 190),
                  ),
                  zIndex: ordered.indexOf(widget) + 1,
                }
              : {
                  left: bounded(w).x,
                  top: bounded(w).y,
                  width: bounded(w).width,
                  height: bounded(w).height,
                  zIndex: ordered.indexOf(widget) + 1,
                };
          const mode =
            w.expanded || (!narrow && w.width >= 600 && w.height >= 440)
              ? "expanded"
              : "compact";
          return (
            <section
              key={widget.id}
              data-widget-id={widget.id}
              data-content-mode={mode}
              className={`oi-window ${w.expanded ? "oi-expanded" : ""}`}
              style={pos}
              onPointerDown={(event) => {
                if (
                  !(event.target as HTMLElement).closest(
                    "button,input,select,textarea,a",
                  )
                )
                  raise(widget.id, index);
              }}
              aria-label={`${widget.title} widget`}
            >
              <div
                className="oi-window-bar"
                tabIndex={0}
                role="toolbar"
                aria-label={`Move ${widget.title}`}
                onPointerDown={(e) => start(e, widget.id, index, "move")}
                onPointerMove={moving}
                onPointerUp={() => finish()}
                onPointerCancel={() => finish(true)}
                onLostPointerCapture={() => finish()}
                onKeyDown={(e) => {
                  if (!e.key.startsWith("Arrow")) return;
                  e.preventDefault();
                  const d = e.shiftKey ? 30 : 10;
                  if (narrow) {
                    reorder(widget.id, e.key === "ArrowUp" ? -1 : 1);
                    return;
                  }
                  update(
                    widget.id,
                    index,
                    bounded({
                      ...w,
                      x:
                        w.x +
                        (e.key === "ArrowLeft"
                          ? -d
                          : e.key === "ArrowRight"
                            ? d
                            : 0),
                      y:
                        w.y +
                        (e.key === "ArrowUp"
                          ? -d
                          : e.key === "ArrowDown"
                            ? d
                            : 0),
                    }),
                  );
                }}
              >
                <span className="oi-window-title">
                  <widget.icon size={14} aria-hidden="true" />
                  {widget.title}
                </span>
                <div className="oi-window-controls">
                  <button
                    aria-label={`Minimize ${widget.title}`}
                    title="Minimize"
                    onClick={() =>
                      update(widget.id, index, { minimized: true })
                    }
                  >
                    <Minus size={15} />
                  </button>
                  <button
                    aria-label={`${w.expanded ? "Restore" : "Maximize"} ${widget.title}`}
                    title={w.expanded ? "Restore" : "Maximize"}
                    onClick={() => {
                      topZ.current = Math.max(
                        topZ.current,
                        ...Object.values(states).map((state) => state.z),
                      );
                      update(widget.id, index, {
                        expanded: !w.expanded,
                        z: ++topZ.current,
                      });
                    }}
                  >
                    {w.expanded ? (
                      <Minimize2 size={14} />
                    ) : (
                      <Maximize2 size={14} />
                    )}
                  </button>
                  <button
                    aria-label={`Close ${widget.title}`}
                    title="Close"
                    onClick={() =>
                      update(widget.id, index, {
                        closed: true,
                        minimized: false,
                      })
                    }
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
              <div className="oi-window-body">
                {renderContent(widget, {
                  mode,
                  availableWidth: w.expanded
                    ? canvasWidth - 20
                    : bounded(w).width,
                  availableHeight: w.expanded
                    ? Math.min(850, window.innerHeight - 190)
                    : w.height,
                  workspace: space,
                })}
              </div>
              {!narrow && !w.expanded && (
                <div
                  className="oi-resize"
                  role="slider"
                  tabIndex={0}
                  aria-label={`Resize ${widget.title}`}
                  aria-valuemin={170}
                  aria-valuemax={950}
                  aria-valuenow={w.height}
                  onPointerDown={(e) => start(e, widget.id, index, "resize")}
                  onPointerMove={moving}
                  onPointerUp={() => finish()}
                  onPointerCancel={() => finish(true)}
                  onLostPointerCapture={() => finish()}
                  onKeyDown={(e) => {
                    const amount = e.shiftKey ? 40 : 10;
                    if (
                      e.key === "ArrowRight" ||
                      e.key === "ArrowLeft" ||
                      e.key === "ArrowUp" ||
                      e.key === "ArrowDown"
                    ) {
                      e.preventDefault();
                      update(
                        widget.id,
                        index,
                        bounded({
                          ...w,
                          width:
                            w.width +
                            (e.key === "ArrowRight"
                              ? amount
                              : e.key === "ArrowLeft"
                                ? -amount
                                : 0),
                          height:
                            w.height +
                            (e.key === "ArrowDown"
                              ? amount
                              : e.key === "ArrowUp"
                                ? -amount
                                : 0),
                        }),
                      );
                    }
                  }}
                />
              )}
            </section>
          );
        })}
      </div>
      <nav className="scene-tool-dock" aria-label="Home tools">
        {widgets
          .filter(
            (widget, index) =>
              ["priorities", "focus", "spotify", "notes", "ambient"].includes(
                widget.id,
              ) || windowState(widget.id, index).minimized,
          )
          .map((widget) => {
            const index = widgets.indexOf(widget);
            const state = windowState(widget.id, index);
            const open = !state.closed && !state.minimized;
            return (
              <button
                key={widget.id}
                aria-label={`${open ? "Hide" : "Open"} ${widget.title}`}
                aria-pressed={open}
                title={widget.title}
                onClick={() => {
                  topZ.current = Math.max(
                    topZ.current,
                    ...Object.values(states).map((w) => w.z),
                  );
                  update(widget.id, index, {
                    closed: open,
                    minimized: false,
                    z: ++topZ.current,
                  });
                }}
              >
                <widget.icon size={19} />
                <span>{widget.title}</span>
                {state.minimized && <i />}
              </button>
            );
          })}
        <div className="scene-dock-divider" />
        <button
          aria-label="Choose background"
          title="Backgrounds"
          onClick={() => setShowScenes(true)}
        >
          <Image size={19} />
          <span>Backgrounds</span>
        </button>
      </nav>
      {showWidgets && (
        <div
          className="oi-widget-panel"
          role="dialog"
          aria-label="Manage widgets"
        >
          <div className="oi-widget-panel-head">
            <strong>Widgets</strong>
            <button
              aria-label="Close widgets"
              onClick={() => setShowWidgets(false)}
            >
              <X size={16} />
            </button>
          </div>
          <input
            className="oi-widget-search"
            type="search"
            aria-label="Search widgets"
            placeholder="Find a widget"
            value={widgetQuery}
            onChange={(event) => setWidgetQuery(event.target.value)}
          />
          {widgets.map((widget, index) => {
            const w = windowState(widget.id, index);
            if (
              !widget.title
                .toLowerCase()
                .includes(widgetQuery.trim().toLowerCase())
            )
              return null;
            return (
              <div className="oi-widget-entry" key={widget.id}>
                <span>{widget.title}</span>
                <button
                  onClick={() =>
                    update(widget.id, index, {
                      closed: w.closed || w.minimized ? false : true,
                      minimized: false,
                    })
                  }
                >
                  {w.closed || w.minimized ? "Show" : "Hide"}
                </button>
                <button
                  aria-label={`Move ${widget.title} up`}
                  onClick={() => reorder(widget.id, -1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  aria-label={`Move ${widget.title} down`}
                  onClick={() => reorder(widget.id, 1)}
                >
                  <ArrowDown size={14} />
                </button>
              </div>
            );
          })}
          {!widgets.some((widget) =>
            widget.title
              .toLowerCase()
              .includes(widgetQuery.trim().toLowerCase()),
          ) && <p>No matching widgets.</p>}
          <button
            className="oi-reset"
            onClick={() => {
              setLayoutUndo({ space, windows: states });
              setWindows(() =>
                Object.fromEntries(
                  widgets.map((widget, index) => [
                    widget.id,
                    {
                      ...windowState(widget.id, index),
                      closed: true,
                      minimized: false,
                    },
                  ]),
                ),
              );
            }}
          >
            Hide all panels
          </button>
          {layoutUndo?.space === space && (
            <button
              className="oi-reset"
              onClick={() => {
                setWindows(() => layoutUndo.windows);
                setLayoutUndo(null);
              }}
            >
              Undo layout change
            </button>
          )}
          <button
            className="oi-reset"
            onClick={() => {
              setLayoutUndo({ space, windows: states });
              setWindows(() => ({}));
            }}
          >
            <RotateCcw size={14} /> Reset {space} layout
          </button>
        </div>
      )}
      {showScenes && (
        <ScenePicker
          current={saved.scene}
          onSelect={(scene) => setSaved((prev) => ({ ...prev, scene }))}
          onClose={() => setShowScenes(false)}
        />
      )}
      <span className="oi-sr-only">{dateLabel}</span>
    </div>
  );
}
