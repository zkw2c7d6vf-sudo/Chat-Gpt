import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Image, Layers3, Maximize2, Minimize2, Minus, RotateCcw, Search, Upload, X } from "lucide-react";

export type HomeWidget = { id: string; title: string; content: ReactNode; width?: number; height?: number };
type Geometry = { x: number; y: number; width: number; height: number };
type WindowState = Geometry & { closed: boolean; minimized: boolean; expanded: boolean; z: number };
type Scene = { id: string; title: string; category: string; background: string; thumbnail?: string; credit?: string };
type HomeState = { version: 1; space: string; scene: Scene; spaces: Record<string, Record<string, WindowState>> };
const KEY = "orbit-immersive-home-v1";
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
  id: `preset-${title.toLowerCase().replace(/\s+/g, "-")}`, title, category,
  background: `radial-gradient(ellipse at 74% 28%, ${b}b5, transparent 52%), radial-gradient(ellipse at 10% 88%, ${c}, transparent 65%), linear-gradient(145deg, ${a}, ${c})`,
}));
const DEFAULT_SCENE = PRESETS[0];
const DEFAULT_GEOMETRIES: Record<string, Geometry> = {
  upnext: { x: 18, y: 20, width: 330, height: 190 },
  priorities: { x: 18, y: 228, width: 330, height: 390 },
  focus: { x: 370, y: 20, width: 340, height: 330 },
  spotify: { x: 370, y: 370, width: 340, height: 260 },
  weather: { x: 732, y: 20, width: 350, height: 325 },
  email: { x: 732, y: 364, width: 350, height: 360 },
  continue: { x: 18, y: 640, width: 330, height: 250 },
  notes: { x: 370, y: 650, width: 340, height: 265 },
  calendar: { x: 732, y: 744, width: 350, height: 350 },
  ambient: { x: 18, y: 912, width: 330, height: 220 },
  files: { x: 370, y: 937, width: 340, height: 240 },
};
const defaultWindow = (id: string, index: number): WindowState => ({
  ...(DEFAULT_GEOMETRIES[id] || { x: 24 + (index % 3) * 355, y: 28 + Math.floor(index / 3) * 285, width: 332, height: 260 }),
  closed: false, minimized: false, expanded: false, z: index + 1,
});
function readState(): HomeState {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    if (value?.version === 1 && value.spaces && value.scene && typeof value.space === "string") return value;
  } catch { /* local storage unavailable */ }
  return { version: 1, space: "Today", scene: DEFAULT_SCENE, spaces: {} };
}
function safePhoto(url: unknown): url is string {
  return typeof url === "string" && /^https:\/\/(?:upload\.wikimedia\.org|commons\.wikimedia\.org)\//.test(url);
}
function plain(text: unknown) { return String(text || "").replace(/<[^>]*>/g, "").slice(0, 120); }
function ScenePicker({ current, onSelect, onClose }: { current: Scene; onSelect: (scene: Scene) => void; onClose: () => void }) {
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
    setLoading(true); setError("");
    const params = new URLSearchParams({ action: "query", format: "json", origin: "*", generator: "search", gsrnamespace: "6", gsrsearch: `filetype:bitmap ${photoSearch || "landscape nature"}`, gsrlimit: "24", gsroffset: String(offset), prop: "imageinfo", iiprop: "url|mime|extmetadata", iiurlwidth: "1200" });
    fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error("Scene search unavailable"); return r.json(); })
      .then(data => {
        if (!alive) return;
        const items: Scene[] = Object.values(data.query?.pages || {}).flatMap((p: any) => {
          const info = p.imageinfo?.[0];
          if (!info || !["image/jpeg", "image/png", "image/webp"].includes(info.mime)) return [];
          const url = info.thumburl || info.url;
          if (!safePhoto(url)) return [];
          const credit = plain(info.extmetadata?.Artist?.value || "Wikimedia Commons");
          return [{ id: `commons-${p.pageid}`, title: plain(p.title).replace(/^File:/, "").replace(/\.(jpe?g|png|webp)$/i, "").replace(/[_-]+/g, " "), category: "Community photos", background: url, thumbnail: url, credit }];
        });
        setPhotos(prev => offset === 0 ? items : [...prev, ...items.filter(item => !prev.some(p => p.id === item.id))]);
        setMore(Boolean(data.continue));
      }).catch(e => { if (alive && e.name !== "AbortError") setError("Could not load online scenes. Local scenes remain available."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; controller.abort(); };
  }, [tab, photoSearch, offset]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const updateQuery = (value: string) => {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPhotoSearch(value.trim() || "landscape nature"); setOffset(0); }, 400);
  };
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);
  const filtered = tab === "presets" ? PRESETS.filter(s => (category === "All" || category === s.category) && `${s.title} ${s.category}`.toLowerCase().includes(query.toLowerCase())) : photos;
  const upload = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 1_500_000) { setError("Choose a PNG, JPEG, or WebP image smaller than 1.5 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") { try { onSelect({ id: "custom", title: file.name, category: "My images", background: reader.result }); onClose(); } catch { setError("Could not save this image."); } } };
    reader.readAsDataURL(file);
  };
  return <div className="oi-modal-backdrop" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="Background library" className="oi-scene-modal">
      <div className="oi-modal-title"><div><h2>Backgrounds</h2><span>Search and select a scene</span></div><button aria-label="Close backgrounds" onClick={onClose}><X size={19}/></button></div>
      <div className="oi-scene-top"><div className="oi-scene-search"><Search size={17}/><input aria-label="Search backgrounds" placeholder="Search mountains, beaches, cities…" value={query} onChange={e => updateQuery(e.target.value)} /></div>
        <button onClick={() => uploadRef.current?.click()}><Upload size={16}/> My image</button><input ref={uploadRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e => upload(e.target.files?.[0])} /></div>
      <div className="oi-scene-tabs"><button className={tab === "photos" ? "active" : ""} onClick={() => { setTab("photos"); setOffset(0); }}>Search photos</button><button className={tab === "presets" ? "active" : ""} onClick={() => setTab("presets")}>Built-in scenes ({PRESETS.length})</button></div>
      {tab === "presets" && <div className="oi-scene-categories">{["All", "Nature", "Coast", "City", "Space", "Minimal"].map(c => <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}</button>)}</div>}
      {error && <p className="oi-scene-error" role="status">{error}</p>}
      <div className="oi-scene-grid">{filtered.map(s => <button className={`oi-scene-option ${current.id === s.id ? "selected" : ""}`} key={s.id} onClick={() => { onSelect(s); onClose(); }}>
        <span className="oi-scene-thumb" style={s.thumbnail ? { backgroundImage: `linear-gradient(#06101b22,#06101b22),url("${s.thumbnail}")` } : { background: s.background }}/><span className="oi-scene-name">{s.title}</span>{current.id === s.id && <Check size={16} className="oi-scene-check" />}</button>)}</div>
      {tab === "photos" && <div className="oi-scenes-bottom">{loading ? "Loading photos…" : more ? <button onClick={() => setOffset(o => o + 24)}>Load more photos <ChevronDown size={15}/></button> : !photos.length ? "Try a different search or choose built-in scenes." : ""}<small>Photos: Wikimedia Commons · External imagery and licenses belong to their contributors</small></div>}
    </section>
  </div>;
}

export default function ImmersiveHome({ widgets, dateLabel }: { widgets: HomeWidget[]; dateLabel: string }) {
  const [saved, setSaved] = useState<HomeState>(readState);
  const [showScenes, setShowScenes] = useState(false);
  const [showWidgets, setShowWidgets] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(1150);
  const [narrow, setNarrow] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const topZ = useRef(100);
  const drag = useRef<{ id: string; kind: "move" | "resize"; startX: number; startY: number; geometry: Geometry } | null>(null);
  const space = SPACES.includes(saved.space) ? saved.space : "Today";
  const states = saved.spaces[space] || {};
  const windowState = (id: string, index: number): WindowState => ({ ...defaultWindow(id,index), ...states[id] });
  const setWindows = useCallback((change: (current: Record<string, WindowState>) => Record<string, WindowState>) => {
    setSaved(prev => { const area = prev.space; return { ...prev, spaces: { ...prev.spaces, [area]: change(prev.spaces[area] || {}) } }; });
  }, []);
  const update = (id: string, index: number, patch: Partial<WindowState>) => setWindows(current => ({ ...current, [id]: { ...defaultWindow(id,index), ...current[id], ...patch } }));
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* browser quota or private mode */ } }, [saved]);
  useEffect(() => { const el = stageRef.current; if (!el) return; const ro = new ResizeObserver(entries => { const width = entries[0].contentRect.width; setCanvasWidth(width); setNarrow(width < 1100); }); ro.observe(el); return () => ro.disconnect(); }, []);
  const bounded = (g: Geometry) => ({ ...g, x: Math.max(0, Math.min(g.x, Math.max(0, canvasWidth - 110))), y: Math.max(0, Math.min(g.y, 2500)), width: Math.min(Math.max(265, g.width), Math.max(265, canvasWidth - 12)), height: Math.max(170, Math.min(g.height, 950)) });
  const start = (event: ReactPointerEvent, id: string, index: number, kind: "move" | "resize") => {
    if (event.button !== 0 || narrow) return;
    if (kind === "move" && (event.target as HTMLElement).closest("button,input,select,textarea,a")) return;
    const w = windowState(id,index);
    if (w.expanded) return;
    drag.current = { id, kind, startX: event.clientX, startY: event.clientY, geometry: w };
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  };
  const moving = (event: ReactPointerEvent, index: number) => {
    if (!drag.current) return;
    const { id, kind, startX, startY, geometry } = drag.current;
    const dx = event.clientX - startX, dy = event.clientY - startY;
    const patch = kind === "move" ? bounded({ ...geometry, x: geometry.x + dx, y: geometry.y + dy }) : bounded({ ...geometry, width: geometry.width + dx, height: geometry.height + dy });
    update(id,index,patch);
  };
  const reorder = (id: string, delta: number) => {
    const items = widgets.map((w,i) => ({ id: w.id, order: windowState(w.id,i).z })).sort((a,b) => a.order-b.order);
    const from = items.findIndex(w => w.id === id), to = Math.min(items.length-1,Math.max(0,from+delta));
    if (to===from) return;
    const [target]=items.splice(from,1); items.splice(to,0,target);
    setWindows(current => Object.fromEntries(items.map((w,i) => [w.id,{...defaultWindow(w.id,widgets.findIndex(x=>x.id===w.id)),...current[w.id],z:i+1}])));
  };
  const raise = (id: string, index: number) => update(id,index,{z:++topZ.current});
  const backdrop = saved.scene.background.startsWith("data:") || saved.scene.background.startsWith("https://") ? `linear-gradient(#07122060,#07122060),url("${saved.scene.background.replaceAll('"','')}")` : saved.scene.background;
  const ordered = [...widgets].sort((a,b) => windowState(a.id,widgets.indexOf(a)).z - windowState(b.id,widgets.indexOf(b)).z);
  return <div className={`oi-root ${narrow ? "oi-narrow" : ""}`} style={{ backgroundImage: backdrop }}>
    <div className="oi-toolbar"><div className="oi-spaces" role="group" aria-label="Workspace">{SPACES.map(s => <button key={s} className={space===s ? "active":""} onClick={() => setSaved(prev => ({...prev,space:s}))}>{s}</button>)}</div>
      <div className="oi-toolbar-actions"><button onClick={() => {setShowWidgets(true);setShowScenes(false);}}><Layers3 size={15}/> Widgets</button><button onClick={() => {setShowScenes(true);setShowWidgets(false);}}><Image size={15}/> Backgrounds</button></div></div>
    <div className="oi-scene-credit">{saved.scene.title}{saved.scene.credit ? ` · ${saved.scene.credit}` : ""}</div>
    <div className="oi-stage" ref={stageRef} aria-label={`${space} workspace`}>
      {ordered.map(widget => {
        const index = widgets.indexOf(widget), w = windowState(widget.id,index);
        if (w.closed || w.minimized) return null;
        const pos = narrow ? {} : w.expanded ? {left:10,top:10,width:Math.max(300,canvasWidth-20),height:Math.min(850,window.innerHeight-220),zIndex:1000} : { left: bounded(w).x, top: bounded(w).y, width: bounded(w).width, height: bounded(w).height, zIndex: w.z };
        return <section key={widget.id} className={`oi-window ${w.expanded ? "oi-expanded" : ""}`} style={pos} onPointerDown={event => { if (!(event.target as HTMLElement).closest("button,input,select,textarea,a")) raise(widget.id,index); }} aria-label={`${widget.title} widget`}>
          <div className="oi-window-bar" tabIndex={0} role="toolbar" aria-label={`Move ${widget.title}`} onPointerDown={e => start(e,widget.id,index,"move")} onPointerMove={e => moving(e,index)} onPointerUp={() => drag.current=null} onPointerCancel={() => drag.current=null}
            onKeyDown={e => { if(!e.key.startsWith("Arrow")) return; e.preventDefault(); const d=e.shiftKey?30:10;if(narrow){reorder(widget.id,e.key==="ArrowUp"?-1:1);return;}update(widget.id,index,bounded({...w,x:w.x+(e.key==="ArrowLeft"?-d:e.key==="ArrowRight"?d:0),y:w.y+(e.key==="ArrowUp"?-d:e.key==="ArrowDown"?d:0)})); }}>
            <span className="oi-window-title">{widget.title}</span><div className="oi-window-controls">
              <button aria-label={`Minimize ${widget.title}`} title="Minimize" onClick={() => update(widget.id,index,{minimized:true})}><Minus size={15}/></button>
              <button aria-label={`${w.expanded?"Restore":"Maximize"} ${widget.title}`} title={w.expanded?"Restore":"Maximize"} onClick={() => update(widget.id,index,{expanded:!w.expanded})}>{w.expanded?<Minimize2 size={14}/>:<Maximize2 size={14}/>}</button>
              <button aria-label={`Close ${widget.title}`} title="Close" onClick={() => update(widget.id,index,{closed:true,minimized:false})}><X size={15}/></button>
            </div></div>
          <div className="oi-window-body">{widget.content}</div>
          {!narrow && !w.expanded && <div className="oi-resize" role="slider" tabIndex={0} aria-label={`Resize ${widget.title}`} aria-valuemin={170} aria-valuemax={950} aria-valuenow={w.height} onPointerDown={e => start(e,widget.id,index,"resize")} onPointerMove={e => moving(e,index)} onPointerUp={() => drag.current=null} onPointerCancel={() => drag.current=null} onKeyDown={e => {const amount=e.shiftKey?40:10;if(e.key==="ArrowRight"||e.key==="ArrowLeft"||e.key==="ArrowUp"||e.key==="ArrowDown"){e.preventDefault();update(widget.id,index,bounded({...w,width:w.width+(e.key==="ArrowRight"?amount:e.key==="ArrowLeft"?-amount:0),height:w.height+(e.key==="ArrowDown"?amount:e.key==="ArrowUp"?-amount:0)}));}}}/>}</section>;
      })}
    </div>
    {widgets.some((widget,index)=>windowState(widget.id,index).minimized&&!windowState(widget.id,index).closed) && <div className="oi-dock" aria-label="Minimized widgets">{widgets.filter((widget,index)=>windowState(widget.id,index).minimized&&!windowState(widget.id,index).closed).map(widget => <button key={widget.id} onClick={()=>update(widget.id,widgets.indexOf(widget),{minimized:false,z:++topZ.current})}>{widget.title} <Maximize2 size={12}/></button>)}</div>}
    {showWidgets && <div className="oi-widget-panel" role="dialog" aria-label="Manage widgets"><div className="oi-widget-panel-head"><strong>Widgets</strong><button aria-label="Close widgets" onClick={()=>setShowWidgets(false)}><X size={16}/></button></div>{widgets.map((widget,index)=>{const w=windowState(widget.id,index);return <div className="oi-widget-entry" key={widget.id}><span>{widget.title}</span><button onClick={()=>update(widget.id,index,{closed:!w.closed,minimized:false})}>{w.closed?"Show":"Hide"}</button><button aria-label={`Move ${widget.title} up`} onClick={()=>reorder(widget.id,-1)}><ArrowUp size={14}/></button><button aria-label={`Move ${widget.title} down`} onClick={()=>reorder(widget.id,1)}><ArrowDown size={14}/></button></div>;})}<button className="oi-reset" onClick={()=>setWindows(()=>({}))}><RotateCcw size={14}/> Reset {space} layout</button></div>}
    {showScenes && <ScenePicker current={saved.scene} onSelect={scene=>setSaved(prev=>({...prev,scene}))} onClose={()=>setShowScenes(false)}/>}
    <span className="oi-sr-only">{dateLabel}</span>
  </div>;
}