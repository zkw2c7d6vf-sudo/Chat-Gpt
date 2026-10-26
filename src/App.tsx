import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Clapperboard,
  PlusCircle,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Command,
  ExternalLink,
  FileText,
  Folder,
  Grid2X2,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  Mail,
  Mic,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  SkipForward,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  Moon,
  Target,
  ShoppingBag,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from "lucide-react";
import type {
  CalendarEvent,
  Connections,
  Dashboard,
  DriveFile,
  Mail as MailMessage,
  Task,
} from "./data";
import {
  eventDate,
  eventOnDay,
  defaultConnections,
  demoEmails,
  demoEvents,
  demoFiles,
  initialTasks,
  buildHandoff,
  sameDay,
  shortTime,
} from "./data";

import WeatherPanel from "./WeatherPanel";
import CalendarConnect from "./CalendarConnect";

import { useVoice } from "./useVoice";
import { MediaCenter, MediaSummary } from "./media/MediaCenter";
import ShoppingScout from "./ShoppingScout";
import BackupPanel from "./BackupPanel";
import CommandCenter, { QuickCapture, proposeTasks } from "./CommandCenter";
import FinancePanel from "./FinancePanel";

type View =
  | "overview"
  | "calendar"
  | "inbox"
  | "files"
  | "media"
  | "shopping"
  | "finance";
type Modal =
  "connections" | "search" | "notifications" | "assistantSettings" | null;
type Detail =
  | { type: "email"; item: MailMessage }
  | { type: "file"; item: DriveFile }
  | { type: "event"; item: CalendarEvent }
  | null;
type Soundscape =
  "off" | "rain" | "roof" | "window" | "storm" | "snow" | "hail";
type SoundEngine = {
  kind: Exclude<Soundscape, "off">;
  context: AudioContext;
  source: AudioBufferSourceNode;
  gain: GainNode;
  start: () => void;
  stop: () => void;
};
function makeSoundEngine(kind: Exclude<Soundscape, "off">): SoundEngine | null {
  const AudioContextConstructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextConstructor) return null;
  const context = new AudioContextConstructor();
  const buffer = context.createBuffer(
    1,
    context.sampleRate * 2,
    context.sampleRate,
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++)
    data[i] = (Math.random() * 2 - 1) * 0.42;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = context.createBiquadFilter();
  const settings: Record<
    Exclude<Soundscape, "off">,
    [BiquadFilterType, number, number, number]
  > = {
    rain: ["bandpass", 1550, 0.55, 0.055],
    roof: ["lowpass", 920, 0.7, 0.07],
    window: ["highpass", 2350, 0.45, 0.045],
    storm: ["bandpass", 720, 0.35, 0.075],
    snow: ["lowpass", 360, 0.5, 0.035],
    hail: ["highpass", 3900, 0.5, 0.05],
  };
  const [type, frequency, q, volume] = settings[kind];
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = context.createGain();
  gain.gain.value = volume;
  source.connect(filter).connect(gain).connect(context.destination);
  let started = false;
  return {
    kind,
    context,
    source,
    gain,
    start: () => {
      if (!started) {
        source.start();
        started = true;
      }
      void context.resume();
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.linearRampToValueAtTime(volume, context.currentTime + 0.25);
    },
    stop: () => {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.2);
      void context.suspend();
    },
  };
}
function stored<T>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : initial;
  } catch {
    return initial;
  }
}
function loadTasks(): Task[] {
  const old = stored<Task[]>("orbit-tasks", []);
  const valid = Array.isArray(old)
    ? old.filter(
        (t) =>
          t &&
          typeof t.id === "string" &&
          typeof t.title === "string" &&
          typeof t.done === "boolean",
      )
    : [];
  if (stored("orbit-seed-v2", false)) return upgradeTasks(valid);
  const placeholders = new Set([
    "Make space for a little creativity",
    "Plan the next little adventure",
    "Drink water. Take a breath.",
  ]);
  const current = valid.filter(
    (t) => !(["t1", "t2", "t3"].includes(t.id) && placeholders.has(t.title)),
  );
  const known = new Set(current.map((t) => t.id));
  const result = [...current, ...initialTasks.filter((t) => !known.has(t.id))];
  localStorage.setItem("orbit-tasks", JSON.stringify(result));
  localStorage.setItem("orbit-seed-v2", "true");
  return upgradeTasks(result);
}
function upgradeTasks(tasks: Task[]): Task[] {
  if (stored("orbit-seed-v3", false)) return tasks;
  const extras: Task[] = [
    {
      id: "v3-media",
      title: "Add a personal movie or episode to Media Center",
      done: false,
      source: "build",
    },
    {
      id: "v3-backup",
      title: "Export a local dashboard backup after upgrading",
      done: false,
      source: "build",
    },
  ];
  const next = [
    ...tasks,
    ...extras.filter((t) => !tasks.some((x) => x.id === t.id)),
  ];
  localStorage.setItem("orbit-tasks", JSON.stringify(next));
  localStorage.setItem("orbit-seed-v3", "true");
  return next;
}
function SpotifyIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.3a.75.75 0 0 1-1 .25c-2.8-1.7-6.3-2.1-10.5-1.1a.75.75 0 1 1-.35-1.46c4.6-1.1 8.5-.65 11.6 1.3.35.2.46.65.25 1Zm1.5-3.4a.94.94 0 0 1-1.3.3c-3.2-2-8-2.6-11.75-1.45a.94.94 0 0 1-.55-1.8c4.3-1.3 9.6-.65 13.3 1.65.45.27.58.85.3 1.3Zm.1-3.6C15.3 8 9 7.8 5.4 8.9a1.13 1.13 0 0 1-.65-2.15c4.2-1.3 11.2-1.05 15.5 1.5a1.13 1.13 0 0 1-1.15 1.95Z" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.82-1.76-5.6-4.12H3.05v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.5 3.82 1.5l2.87-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.35 2.59C7.18 7.72 9.4 5.96 12 5.96Z"
      />
    </svg>
  );
}
function DriveIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#6fc799" d="m9 3 6 0 7 12h-6Z" />
      <path fill="#f0cb69" d="m9 3 6 12-3 6L2 15Z" />
      <path fill="#76a1f4" d="M2 15h20l-3.5 6h-13Z" />
    </svg>
  );
}
function OrbitLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 64 64" aria-hidden="true">
      <circle
        cx="32"
        cy="32"
        r="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
      />
      <ellipse
        cx="32"
        cy="32"
        rx="28"
        ry="11"
        transform="rotate(-38 32 32)"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      <circle cx="54" cy="16" r="4" fill="#c8eea0" />
    </svg>
  );
}
function IconButton({
  label,
  children,
  onClick,
  className = "",
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function SampleTag() {
  return <span className="sample-tag">SAMPLE</span>;
}
function CardHeader({
  icon,
  title,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  action?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="card-header">
      <h2>
        <span className="section-icon">{icon}</span>
        {title}
      </h2>
      <div className="header-actions">
        {children}
        {action && (
          <IconButton label={`View ${title.toLowerCase()}`} onClick={action}>
            <ArrowUpRight size={17} />
          </IconButton>
        )}
      </div>
    </div>
  );
}
function ModalShell({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const focusable = ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,textarea,a[href],select",
        );
        if (!focusable?.length) return;
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    const el = ref.current?.querySelector<HTMLElement>("input,button");
    el?.focus();
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2>{title}</h2>
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const [mediaId, setMediaId] = useState<string>();
  const [modal, setModal] = useState<Modal>(null);
  const [detail, setDetail] = useState<Detail>(null);
  const [connections, setConnections] =
    useState<Connections>(defaultConnections);
  const [live, setLive] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [mailTab, setMailTab] = useState<"important" | "all">("important");
  const [read, setRead] = useState<string[]>(() => stored("orbit-read", []));
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [notes, setNotes] = useState(() => stored("orbit-notes", ""));
  const [taskTab, setTaskTab] = useState("tasks");
  const [taskInput, setTaskInput] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState<Task["priority"]>("normal");
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [customFocusMinutes, setCustomFocusMinutes] = useState("");
  const [customFocusMode, setCustomFocusMode] = useState(false);
  const [remaining, setRemaining] = useState(25 * 60);
  const [focusing, setFocusing] = useState(false);
  const [soundscape, setSoundscape] = useState<Soundscape>(() =>
    ((value) =>
      ["off", "rain", "roof", "window", "storm", "snow", "hail"].includes(value)
        ? (value as Soundscape)
        : "off")(stored("orbit-focus-sound-v2", "off")),
  );
  const [soundError, setSoundError] = useState("");
  const soundEngine = useRef<SoundEngine | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [voice, setVoice] = useState(() =>
    stored("orbit-spoken-replies", true),
  );
  const [demoMode, setDemoMode] = useState(() => stored("orbit-demo", false));
  const [trackNextSteps, setTrackNextSteps] = useState(() =>
    stored("orbit-track-steps", true),
  );
  const [weatherSummary, setWeatherSummary] = useState("");
  const [weatherTemp, setWeatherTemp] = useState<{
    temperature: number;
    unit: "fahrenheit" | "celsius";
    description: string;
    location: string;
  } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >(() =>
    stored("orbit-messages", [
      {
        role: "assistant",
        content:
          "Hey Joseph. Ready when you are. Tell me what’s on your mind, plan your day, or keep our Orbit build moving. Use the mic to dictate, then review and send.",
      },
    ]),
  );
  const chatEnd = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<HTMLElement>(null);
  const onTranscript = useCallback(
    (text: string) =>
      setChatInput((current) =>
        [current.trim(), text.trim()].filter(Boolean).join(" "),
      ),
    [],
  );
  const dictation = useVoice({
    onTranscript,
    aiConfigured: connections.assistant.configured,
  });
  const { listening, transcribing } = dictation;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/connections");
      if (!r.ok) throw new Error();
      const c: Connections = await r.json();
      setConnections(c);
      const d = await fetch("/api/dashboard");
      if (d.ok) setLive(await d.json());
      else notify("Couldn’t refresh your services. Please try again.");
    } catch {
      notify(
        "The API is unavailable. Check that npm run dev is running, then refresh.",
      );
    } finally {
      setLoading(false);
    }
  }, [notify]);
  useEffect(() => {
    void refresh();
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "connected") {
      notify(
        `${params.get("connection") === "google" ? "Google" : "Spotify"} connected. Welcome to your space.`,
      );
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.has("status") || params.has("error")) {
      notify(
        "Connection couldn’t be completed. Please try again in Connections.",
      );
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refresh, notify]);
  useEffect(() => {
    if (
      !connections.google.connected &&
      !connections.spotify.connected &&
      !connections.calendar?.connected
    )
      return;
    const id = setInterval(
      () => {
        if (document.visibilityState === "visible") void refresh();
      },
      connections.spotify.connected ? 30000 : 60000,
    );
    return () => clearInterval(id);
  }, [
    connections.google.connected,
    connections.spotify.connected,
    connections.calendar?.connected,
    refresh,
  ]);
  useEffect(() => {
    localStorage.setItem("orbit-tasks", JSON.stringify(tasks));
  }, [tasks]);
  useEffect(() => {
    localStorage.setItem("orbit-notes", JSON.stringify(notes));
  }, [notes]);
  useEffect(() => {
    localStorage.setItem("orbit-read", JSON.stringify(read));
  }, [read]);
  useEffect(() => {
    if (!focusing) return;
    const until = Date.now() + remaining * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setFocusing(false);
        notify("A little more progress. Your focus session is complete.");
      }
    }, 500);
    return () => clearInterval(id);
  }, [focusing, focusMinutes]);
  useEffect(() => {
    localStorage.setItem("orbit-focus-sound-v2", JSON.stringify(soundscape));
    if (focusing && soundscape !== "off") {
      if (soundEngine.current?.kind !== soundscape) {
        void soundEngine.current?.context.close();
        soundEngine.current = makeSoundEngine(soundscape);
      }
      if (!soundEngine.current) {
        setSoundError("Focus sound is unavailable in this browser.");
      } else {
        soundEngine.current.start();
        setSoundError("");
      }
    } else {
      soundEngine.current?.stop();
    }
  }, [focusing, soundscape]);
  useEffect(
    () => () => {
      void soundEngine.current?.context.close();
      soundEngine.current = null;
    },
    [],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "k"
      ) {
        dictation.stop();
        setChatOpen(false);
        setModal(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        dictation.stop();
        setChatOpen(false);
        setModal((m) => (m === "search" ? null : "search"));
      }
      if (e.key === "Escape") {
        dictation.stop();
        setChatOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dictation.stop]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatBusy]);
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!chatOpen) return;
    const previous = document.activeElement as HTMLElement;
    conversationRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = conversationRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled),input:not(:disabled),a[href]",
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
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [chatOpen]);
  useEffect(() => {
    localStorage.setItem("orbit-messages", JSON.stringify(messages.slice(-40)));
  }, [messages]);
  useEffect(() => {
    localStorage.setItem("orbit-spoken-replies", JSON.stringify(voice));
  }, [voice]);
  useEffect(() => {
    localStorage.setItem("orbit-demo", JSON.stringify(demoMode));
  }, [demoMode]);
  useEffect(() => {
    localStorage.setItem("orbit-track-steps", JSON.stringify(trackNextSteps));
  }, [trackNextSteps]);
  const googleLive = connections.google.connected;
  const calendarLive = connections.calendar?.connected || googleLive;
  const events = calendarLive
    ? live?.calendar || []
    : demoMode
      ? demoEvents
      : [];
  const emails = (
    googleLive ? live?.emails || [] : demoMode ? demoEmails : []
  ).map((m) => ({
    ...m,
    unread: m.unread && !read.includes(m.id),
  }));
  const files = googleLive ? live?.files || [] : demoMode ? demoFiles : [];
  const track = live?.spotify || null;
  const todayEvents = events.filter((e) => eventOnDay(e, new Date()));
  const agenda = events.filter((e) => eventOnDay(e, selectedDate));
  const important = emails.filter((e) => e.important);
  const done = tasks.filter((t) => t.done).length;
  const progress = remaining / (focusMinutes * 60);
  const dateLabel = new Date(now).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const today = new Date(now);
  const hour = today.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const timeOfDay = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const TimeOfDayIcon = hour < 12 ? Sunrise : hour < 18 ? Sun : Moon;
  const openMail = (item: MailMessage) => {
    setDetail({ type: "email", item });
    setRead((r) => [...new Set([...r, item.id])]);
  };
  const navigate = (v: View) => {
    setView(v);
    setQuery("");
    setSelectedDate(new Date());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const connect = (provider: "google" | "spotify") => {
    if (!connections[provider].configured) {
      notify(
        `Set up ${provider === "google" ? "Google" : "Spotify"} OAuth in your .env file first. See the connection instructions below.`,
      );
      return;
    }
    window.location.assign(connections[provider].authUrl);
  };
  const disconnect = async (provider: "google" | "spotify") => {
    try {
      const r = await fetch(`/api/disconnect/${provider}`, { method: "POST" });
      if (!r.ok) throw new Error();
      notify("Account disconnected. Your local notes and tasks are safe.");
      await refresh();
    } catch {
      notify("Couldn’t disconnect. Please try again.");
    }
  };
  const playback = async (action: "toggle" | "next" | "previous") => {
    if (!connections.spotify.connected) {
      setModal("connections");
      return;
    }
    try {
      const path =
        action === "toggle"
          ? "/api/spotify/playback"
          : `/api/spotify/${action}`;
      const response = await fetch(path, {
        method: action === "toggle" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body:
          action === "toggle"
            ? JSON.stringify({ playing: !track?.isPlaying })
            : undefined,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Open Spotify on a device first.");
      }
      await refresh();
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Spotify couldn’t update playback.",
      );
    }
  };
  const addTask = (e?: FormEvent) => {
    e?.preventDefault();
    if (!taskInput.trim()) return;
    setTasks((t) => [
      {
        id: crypto.randomUUID(),
        title: taskInput.trim(),
        done: false,
        dueDate: taskDueDate || undefined,
        priority: taskPriority,
      },
      ...t,
    ]);
    setTaskInput("");
    setTaskDueDate("");
  };
  const startFocus = () => {
    if (remaining === 0) setRemaining(focusMinutes * 60);
    setFocusing(true);
    notify("Your focus session is on. One thing at a time.");
  };
  const say = (text: string) => {
    if (voice && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.98;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };
  const askAssistant = async (input: string) => {
    const text = input.trim();
    if (!text || chatBusy) return;
    setChatInput("");
    setChatOpen(true);
    const history = [...messages, { role: "user" as const, content: text }];
    setMessages(history);
    setChatBusy(true);
    let answer = "";
    try {
      if (/^add (a )?task[: ]/i.test(text)) {
        const title = text.replace(/^add (a )?task[: ]+/i, "").trim();
        if (!title) {
          answer =
            "What would you like to add? Try “Add task: Book a dentist appointment”.";
        } else {
          setTasks((t) => [
            ...t,
            { id: crypto.randomUUID(), title, done: false },
          ]);
          answer = `Added “${title}” to your little to-dos.`;
        }
      } else if (/^(complete|finish|done) task[: ]/i.test(text)) {
        const title = text
          .replace(/^(complete|finish|done) task[: ]+/i, "")
          .trim();
        const match =
          tasks.find((t) => t.title.toLowerCase() === title.toLowerCase()) ||
          tasks.find(
            (t) =>
              title.length > 5 &&
              t.title.toLowerCase().includes(title.toLowerCase()),
          );
        if (match) {
          setTasks((current) =>
            current.map((t) => (t.id === match.id ? { ...t, done: true } : t)),
          );
          answer = `Marked “${match.title}” complete.`;
        } else
          answer =
            "I couldn’t find that task. Use “Complete task: …” followed by its title.";
      } else if (/^(start|begin|resume) (a |the )?(focus|timer)/i.test(text)) {
        startFocus();
        answer = `Your ${focusMinutes}-minute focus timer is running. Take a breath, choose one thing, and give it your attention. You’ve got this.`;
      } else if (/^(pause|stop) (a |the |my )?(focus|timer)/i.test(text)) {
        setFocusing(false);
        answer =
          "Your focus timer is paused. Take your time — it’ll be here when you’re ready.";
      } else if (connections.assistant.configured) {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            messages: history.slice(-12),
            context: {
              dataMode: demoMode ? "sample-unconnected-services" : "personal",
              buildHandoff,
              calendarConnected: calendarLive,
              googleConnected: googleLive,
              weather: weatherSummary,
              trackNextSteps,
              events: todayEvents,
              tasks,
              emails: important.map(({ from, subject }) => ({ from, subject })),
            },
          }),
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error ||
              "The AI service is unavailable. Try a dashboard command.",
          );
        if (trackNextSteps && Array.isArray(body.suggestedTasks)) {
          const suggestions = body.suggestedTasks
            .filter(
              (x: unknown): x is string =>
                typeof x === "string" && x.trim().length > 0,
            )
            .slice(0, 3);
          proposeTasks(
            suggestions.filter(
              (title: string) =>
                !tasks.some(
                  (t) =>
                    t.title.trim().toLowerCase() === title.trim().toLowerCase(),
                ),
            ),
          );
        }
        answer =
          body.reply ||
          body.message ||
          body.content ||
          "I couldn’t generate a response. Please try again.";
      } else if (/weather|forecast|temperature/i.test(text)) {
        answer =
          weatherSummary ||
          "The weather panel is loading or unavailable. Check the forecast card, or choose Retry there.";
      } else if (/build|version 2|roadmap/i.test(text)) {
        answer = `Our next steps: ${tasks
          .filter((t) => !t.done)
          .map((t) => t.title)
          .join(
            ". ",
          )}. Spotify is already connected on your Mac. I have a handoff from this build, but not background access to ChatGPT. Connect an OpenAI API key for open-ended conversations.`;
      } else if (/focus|concentrate|timer/.test(text.toLowerCase())) {
        startFocus();
        answer = `Your ${focusMinutes}-minute focus timer is running. Take a breath, choose one thing, and give it your attention. You’ve got this.`;
      } else if (/^add (a )?task[: ]/i.test(text)) {
        const title = text.replace(/^add (a )?task[: ]+/i, "");
        setTasks((t) => [
          ...t,
          { id: crypto.randomUUID(), title, done: false },
        ]);
        answer = `Added “${title}” to your little to-dos.`;
      } else if (/mail|inbox|email/.test(text.toLowerCase())) {
        navigate("inbox");
        answer = important.length
          ? `${googleLive ? "" : "In the sample inbox, "}${important.length} emails are marked important. ${important
              .slice(0, 3)
              .map((m) => `${m.from}: “${m.subject}”`)
              .join(". ")}. You can open them in your inbox.`
          : "No important emails are loaded.";
      } else if (/file|drive|document/.test(text.toLowerCase())) {
        navigate("files");
        answer = `Here are your ${googleLive ? "" : demoMode ? "sample " : "currently loaded "}recent files. ${files
          .slice(0, 3)
          .map((f) => f.name)
          .join(", ")}. Select one to see its details.`;
      } else if (/task|to.do/.test(text.toLowerCase())) {
        answer = `You have ${tasks.length - done} things left on your list. ${tasks
          .filter((t) => !t.done)
          .map((t) => t.title)
          .join(". ")}. Want to add something? Type “Add task: …”.`;
      } else {
        answer = `${!calendarLive ? (demoMode ? "You’re viewing a sample day. " : "Your calendar isn’t connected yet. Add an ICS link in Connections. ") : ""}${todayEvents.length ? `You have ${todayEvents.length} events today: ${todayEvents.map((e) => `${e.title} at ${shortTime(e.start)}`).join(", ")}.` : calendarLive ? "No events are loaded for today." : ""} ${connections.assistant.configured ? "" : "I’m your local dashboard guide until an OpenAI API key is configured. I can track tasks, summarize this build, and start focus sessions. Use Assistant settings to enable full conversations."}`;
      }
    } catch (e) {
      answer =
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.";
    } finally {
      setChatBusy(false);
    }
    setMessages((m) => [...m, { role: "assistant", content: answer }]);
    say(answer);
  };
  const startListening = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setChatOpen(true);
    if (listening) dictation.stop();
    else void dictation.start();
  };
  const closeModal = useCallback(() => {
    setModal(null);
    setQuery("");
  }, []);
  const closeDetail = useCallback(() => setDetail(null), []);

  const calendarPanel = (expanded = false) => (
    <section
      className={`card calendar-card ${expanded ? "expanded-card" : ""}`}
    >
      <CardHeader
        icon={<CalendarDays size={18} />}
        title="Schedule"
        action={() => navigate("calendar")}
      >
        {!calendarLive && demoMode ? (
          <SampleTag />
        ) : calendarLive ? (
          <span className="source-badge">
            {connections.calendar?.source === "ics" ? "ICS" : "LIVE"}
          </span>
        ) : null}
      </CardHeader>
      <div className="calendar-month">
        <span>
          {selectedDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </span>
        <div>
          <IconButton
            label="Previous week"
            onClick={() =>
              setSelectedDate(
                (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7),
              )
            }
          >
            <ChevronLeft size={16} />
          </IconButton>
          <IconButton
            label="Next week"
            onClick={() =>
              setSelectedDate(
                (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7),
              )
            }
          >
            <ChevronRight size={16} />
          </IconButton>
        </div>
      </div>
      <div className="week-strip">
        {Array.from({ length: 7 }, (_, i) => {
          const date = new Date(selectedDate);
          const offset = (date.getDay() + 6) % 7;
          date.setDate(date.getDate() - offset + i);
          return (
            <button
              key={i}
              className={`week-day ${sameDay(date, selectedDate) ? "selected" : ""} ${sameDay(date, today) ? "is-today" : ""}`}
              onClick={() => setSelectedDate(date)}
            >
              <span>
                {date
                  .toLocaleDateString("en-US", { weekday: "short" })
                  .slice(0, 1)}
              </span>
              <strong>{date.getDate()}</strong>
              <i
                className={
                  events.some((e) => eventOnDay(e, date)) ? "has-events" : ""
                }
              />
            </button>
          );
        })}
      </div>
      <div className="agenda-caption">
        <span>
          {sameDay(selectedDate, today)
            ? "TODAY’S SCHEDULE"
            : selectedDate
                .toLocaleDateString("en-US", { weekday: "long" })
                .toUpperCase()}
        </span>
        <span>{agenda.length} events</span>
      </div>
      <div className="agenda-list">
        {agenda.length ? (
          agenda.slice(0, expanded ? 20 : 4).map((event, i) => (
            <button
              className="agenda-event"
              key={event.id}
              onClick={() => setDetail({ type: "event", item: event })}
            >
              <div className="event-time">
                {event.allDay
                  ? "All day"
                  : shortTime(event.start)
                      .replace(" AM", "")
                      .replace(" PM", "")}
                <span>
                  {event.allDay
                    ? ""
                    : new Date(event.start).getHours() < 12
                      ? "AM"
                      : "PM"}
                </span>
              </div>
              <span
                className={`event-line ${event.color || ["blue", "violet", "green", "orange"][i % 4]}`}
              />
              <div className="event-info">
                <strong>{event.title}</strong>
                <span>
                  {event.meetingUrl ? (
                    <span className="meet-symbol">▰</span>
                  ) : (
                    <span className="mini-dot" />
                  )}
                  {event.location || "Personal calendar"}
                </span>
              </div>
              <ChevronRight size={14} className="event-chevron" />
            </button>
          ))
        ) : (
          <div className="empty-state">
            <Sun size={27} />
            <strong>
              {calendarLive || demoMode
                ? "No events scheduled."
                : "Calendar not connected"}
            </strong>
            <p>
              {calendarLive || demoMode
                ? "No events on this day."
                : "Add an ICS link or import a calendar file."}
            </p>
            {!calendarLive && !demoMode && (
              <button
                className="text-button"
                onClick={() => setModal("connections")}
              >
                Add your calendar
                <ArrowUpRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      <button
        className="card-footer-link"
        onClick={() =>
          expanded ? setSelectedDate(new Date()) : navigate("calendar")
        }
      >
        {expanded ? "Back to today" : "Open calendar"}
        <ArrowRight size={14} />
      </button>
    </section>
  );
  const inboxPanel = (expanded = false) => (
    <section className={`card inbox-card ${expanded ? "expanded-card" : ""}`}>
      <CardHeader
        icon={<Mail size={18} />}
        title="Inbox"
        action={() => navigate("inbox")}
      >
        {!googleLive && demoMode && <SampleTag />}
      </CardHeader>
      <div className="mail-tabs">
        <button
          className={mailTab === "important" ? "active" : ""}
          onClick={() => setMailTab("important")}
        >
          <Sparkles size={13} />
          Important<span>{important.length}</span>
        </button>
        <button
          className={mailTab === "all" ? "active" : ""}
          onClick={() => setMailTab("all")}
        >
          All mail<span>{emails.length}</span>
        </button>
      </div>
      <div className="mail-list">
        {(mailTab === "important" ? important : emails)
          .slice(0, expanded ? 30 : 3)
          .map((email, i) => (
            <button
              className={`mail-item ${email.unread ? "unread" : ""}`}
              key={email.id}
              onClick={() => openMail(email)}
            >
              <span className={`avatar avatar-${i % 4}`}>
                {email.from
                  .replace(/<.*>/, "")
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span className="mail-content">
                <span className="mail-top">
                  <strong>{email.from.replace(/<.*>/, "").trim()}</strong>
                  <time>{shortTime(email.time)}</time>
                </span>
                <span className="mail-subject">{email.subject}</span>
                <span className="mail-preview">{email.snippet}</span>
              </span>
              {email.unread && <i className="unread-dot" />}
            </button>
          ))}
        {(mailTab === "important" ? important : emails).length === 0 && (
          <div className="empty-state">
            <CheckCheck size={28} />
            <strong>
              {googleLive || demoMode
                ? "All caught up."
                : "Email not connected"}
            </strong>
            <p>
              {googleLive || demoMode
                ? `No ${mailTab === "important" ? "important " : ""}emails to show.`
                : "Email isn’t connected. Open Gmail directly, or add optional Google access later."}
            </p>
          </div>
        )}
      </div>
      <div className="inbox-insight">
        <span className="insight-star">
          <Sparkles size={14} />
        </span>
        <p>
          {important.length
            ? "Important mail"
            : googleLive || demoMode
              ? "No important mail"
              : "An ICS calendar does not grant email access."}
        </p>
      </div>
      <button
        className="card-footer-link"
        onClick={() =>
          expanded
            ? window.open(
                "https://mail.google.com/",
                "_blank",
                "noopener,noreferrer",
              )
            : navigate("inbox")
        }
      >
        {expanded ? "Open Gmail" : "View your inbox"}
        <ArrowRight size={14} />
      </button>
    </section>
  );
  const filesPanel = (expanded = false) => (
    <section className={`card files-card ${expanded ? "expanded-card" : ""}`}>
      <CardHeader
        icon={<DriveIcon />}
        title="Recent files"
        action={() => navigate("files")}
      >
        {!googleLive && demoMode && <SampleTag />}
      </CardHeader>
      <div className="files-subhead">
        <span>RECENT IN DRIVE</span>
        <span>
          Last opened <ChevronDown size={12} />
        </span>
      </div>
      <div className={`file-grid ${expanded ? "expanded-files" : ""}`}>
        {files.slice(0, expanded ? 30 : 4).map((file, i) => (
          <button
            key={file.id}
            className={`file-tile tile-${file.type}`}
            onClick={() => setDetail({ type: "file", item: file })}
          >
            <div className={`file-art art-${i % 4}`}>
              {file.type === "folder" ? (
                <Folder size={35} strokeWidth={1.2} />
              ) : file.type === "spreadsheet" ? (
                <Grid2X2 size={33} strokeWidth={1.3} />
              ) : file.type === "presentation" ? (
                <div className="mini-moodboard">
                  <i />
                  <i />
                  <i />
                </div>
              ) : (
                <div className="mini-doc">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              )}
              <span className="file-art-more">
                <MoreHorizontal size={16} />
              </span>
            </div>
            <div className="file-name">
              <span className={`file-type-icon ${file.type}`}>
                {file.type === "folder" ? (
                  <Folder size={13} />
                ) : file.type === "spreadsheet" ? (
                  <Grid2X2 size={13} />
                ) : (
                  <FileText size={13} />
                )}
              </span>
              <strong>{file.name}</strong>
            </div>
            <div className="file-meta">
              {sameDay(new Date(file.modifiedAt), today) ? "Today" : "Recently"}
              <span>·</span>
              {file.owner || "You"}
            </div>
          </button>
        ))}
      </div>
      {files.length === 0 && (
        <div className="empty-state">
          <Folder size={28} />
          <strong>No connected files</strong>
          <p>
            Drive isn’t connected. You can still open Drive directly; calendar
            feeds don’t grant file access.
          </p>
        </div>
      )}
      <button
        className="card-footer-link"
        onClick={() =>
          expanded
            ? window.open(
                "https://drive.google.com/",
                "_blank",
                "noopener,noreferrer",
              )
            : navigate("files")
        }
      >
        {expanded ? "Open Google Drive" : "All files in Drive"}
        <ArrowRight size={14} />
      </button>
    </section>
  );
  const musicPanel = () => (
    <section className="card music-card">
      <CardHeader icon={<SpotifyIcon size={18} />} title="Spotify">
        {!connections.spotify.connected && (
          <span className="spotify-label">Spotify</span>
        )}
      </CardHeader>
      <div className="track-row">
        <div className={`album-art ${track?.coverUrl ? "with-image" : ""}`}>
          {track?.coverUrl ? (
            <img src={track.coverUrl} alt={`${track.album} album cover`} />
          ) : (
            <>
              <div className="album-mountain" />
              <span>
                DEEP
                <br />
                FOCUS
              </span>
            </>
          )}
        </div>
        <div className="track-info">
          <span className="micro-label">
            {track ? "NOW PLAYING" : "SPOTIFY PLAYLIST"}
          </span>
          <h3>{track?.title || "Deep Focus"}</h3>
          <p>{track?.artist || "Ambient sounds. Clear thoughts."}</p>
          {track ? (
            <span className="track-device">
              <i />
              {track.device || "Spotify"}
            </span>
          ) : (
            <span className="playlist-label">Connect to control playback</span>
          )}
        </div>
      </div>
      <div className="music-progress">
        <span
          style={{
            width: track
              ? `${(track.progressMs / track.durationMs) * 100}%`
              : "0%",
          }}
        />
      </div>
      <div className="player-controls">
        <span className="track-timestamp">
          {track
            ? `${Math.floor(track.progressMs / 60000)}:${String(Math.floor(track.progressMs / 1000) % 60).padStart(2, "0")}`
            : "—:—"}
        </span>
        <div>
          <IconButton
            label="Open Spotify"
            onClick={() =>
              window.open(
                track?.url || "https://open.spotify.com/",
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            <ExternalLink size={14} />
          </IconButton>
          <IconButton
            label={track?.isPlaying ? "Pause Spotify" : "Play Spotify"}
            className="play-button"
            onClick={() => void playback("toggle")}
          >
            {track?.isPlaying ? (
              <Pause size={17} fill="currentColor" />
            ) : (
              <Play size={17} fill="currentColor" />
            )}
          </IconButton>
          <IconButton label="Next track" onClick={() => void playback("next")}>
            <SkipForward size={16} />
          </IconButton>
        </div>
        <span className="track-timestamp">
          {track
            ? `${Math.floor(track.durationMs / 60000)}:${String(Math.floor(track.durationMs / 1000) % 60).padStart(2, "0")}`
            : "—:—"}
        </span>
      </div>
      {!connections.spotify.connected && (
        <button
          className="spotify-connect"
          onClick={() => setModal("connections")}
        >
          <Link2 size={12} /> Connect your Spotify <ArrowUpRight size={12} />
        </button>
      )}
      {connections.spotify.connected && !track && (
        <p className="music-empty">Start a song on Spotify to see it here.</p>
      )}
    </section>
  );
  const focusPanel = () => (
    <section className={`card focus-card ${focusing ? "focus-active" : ""}`}>
      <div className="focus-heading">
        <span>
          <Target size={17} />
          Focus timer
        </span>
        <div className="duration-control">
          <select
            aria-label="Focus duration"
            value={customFocusMode ? "custom" : String(focusMinutes)}
            onChange={(event) => {
              if (event.target.value === "custom") {
                setCustomFocusMode(true);
                setCustomFocusMinutes(String(focusMinutes));
                return;
              }
              const minutes = Number(event.target.value);
              setCustomFocusMode(false);
              setFocusMinutes(minutes);
              setRemaining(minutes * 60);
              setFocusing(false);
            }}
          >
            <option value="5">5 min</option>
            <option value="10">10 min</option>
            <option value="25">25 min</option>
            <option value="50">50 min</option>
            <option value="custom">Custom</option>
          </select>
          <ChevronDown size={11} />
          {customFocusMode && (
            <input
              aria-label="Custom focus minutes"
              type="number"
              min="1"
              max="1440"
              value={customFocusMinutes || focusMinutes}
              onChange={(event) => {
                setCustomFocusMinutes(event.target.value);
                const minutes = Math.min(
                  1440,
                  Math.max(1, Number(event.target.value) || 1),
                );
                setFocusMinutes(minutes);
                setRemaining(minutes * 60);
                setFocusing(false);
              }}
            />
          )}
        </div>
      </div>
      <div className="focus-content">
        <div className="timer-ring">
          <svg viewBox="0 0 92 92">
            <circle cx="46" cy="46" r="40" className="ring-track" />
            <circle
              cx="46"
              cy="46"
              r="40"
              className="ring-progress"
              strokeDasharray={251.3}
              strokeDashoffset={251.3 * (1 - progress)}
            />
          </svg>
          <span>
            {Math.floor(remaining / 60)
              .toString()
              .padStart(2, "0")}
            <small>:</small>
            {(remaining % 60).toString().padStart(2, "0")}
          </span>
        </div>
        <div className="focus-copy">
          <h3>
            {focusing
              ? "One thing at a time."
              : remaining === 0
                ? "Beautifully done."
                : "Ready to focus?"}
          </h3>
          <p>{focusing ? "Session in progress." : "Choose a time to begin."}</p>
          <div className="focus-buttons">
            <button
              className="focus-start"
              onClick={() => {
                if (remaining === 0) setRemaining(focusMinutes * 60);
                setFocusing(!focusing);
              }}
            >
              {focusing ? (
                <Pause size={12} />
              ) : (
                <Play size={12} fill="currentColor" />
              )}
              {focusing
                ? "Pause session"
                : remaining < focusMinutes * 60 && remaining > 0
                  ? "Resume focus"
                  : "Start focus"}
            </button>
            {remaining < focusMinutes * 60 && (
              <IconButton
                label="Reset focus timer"
                onClick={() => {
                  setFocusing(false);
                  setRemaining(focusMinutes * 60);
                }}
              >
                <RotateCcw size={13} />
              </IconButton>
            )}
          </div>
        </div>
      </div>
      <div
        className={`rain-box ${focusing ? "rain-active" : ""}`}
        aria-hidden="true"
      >
        <div className="rain-drop-field">
          {Array.from({ length: 48 }, (_, index) => (
            <i key={index} />
          ))}
        </div>
        <span>{soundscape === "off" ? "QUIET" : soundscape.toUpperCase()}</span>
      </div>
      <div className="focus-sound-row">
        <label className="soundscape-select">
          <Volume2 size={13} />
          <span>Focus sound</span>
          <select
            aria-label="Focus sound"
            value={soundscape}
            onChange={(event) =>
              setSoundscape(event.target.value as Soundscape)
            }
          >
            <option value="off">Quiet</option>
            <option value="rain">Steady rain</option>
            <option value="roof">Rain on roof</option>
            <option value="window">Rain on window</option>
            <option value="storm">Distant storm</option>
            <option value="snow">Soft snow</option>
            <option value="hail">Hail</option>
          </select>
          <ChevronDown size={11} />
        </label>
        <span>{soundscape === "off" ? "Sound off" : "During session"}</span>
      </div>
      {soundError && (
        <p className="focus-sound-error" role="status">
          {soundError}
        </p>
      )}
    </section>
  );
  const tasksPanel = () => (
    <section className="card tasks-card">
      <div className="card-header">
        <div className="task-tabs">
          <button
            className={taskTab === "tasks" ? "active" : ""}
            onClick={() => setTaskTab("tasks")}
          >
            <CheckCheck size={17} />
            Tasks<span>{tasks.length - done}</span>
          </button>
          <button
            className={taskTab === "notes" ? "active" : ""}
            onClick={() => setTaskTab("notes")}
          >
            Notes
          </button>
        </div>
        <span className="local-badge">PRIVATE</span>
      </div>
      {taskTab === "tasks" ? (
        <>
          <div className="task-provenance">
            <span>
              <Sparkles size={12} />
              Build & personal tasks
            </span>
            <span>
              {done}/{tasks.length} done
            </span>
          </div>
          <div className="task-list">
            {[...tasks]
              .sort((a, b) => Number(a.done) - Number(b.done))
              .map((task) => (
                <div
                  key={task.id}
                  className={`task-row ${task.done ? "done" : ""}`}
                >
                  <button
                    className="task-toggle"
                    onClick={() =>
                      setTasks((t) =>
                        t.map((x) =>
                          x.id === task.id ? { ...x, done: !x.done } : x,
                        ),
                      )
                    }
                    aria-label={`${task.done ? "Uncomplete" : "Complete"} ${task.title}`}
                  >
                    {task.done && <Check size={12} />}
                  </button>
                  <span>
                    {task.title}
                    {(task.dueDate ||
                      (task.priority && task.priority !== "normal")) && (
                      <small className="task-planner-meta">
                        {task.dueDate
                          ? `Due ${new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                          : ""}
                        {task.priority && task.priority !== "normal"
                          ? ` · ${task.priority} priority`
                          : ""}
                      </small>
                    )}
                    {task.source && (
                      <small className="task-source">
                        {task.source === "build" ? "OUR BUILD" : "ORBIT"}
                      </small>
                    )}
                  </span>
                  <IconButton
                    label={`Delete ${task.title}`}
                    className="task-delete"
                    onClick={() =>
                      setTasks((t) => t.filter((x) => x.id !== task.id))
                    }
                  >
                    <X size={13} />
                  </IconButton>
                </div>
              ))}
          </div>
          <form className="add-task" onSubmit={addTask}>
            <Plus size={15} />
            <input
              aria-label="Add a little to-do"
              placeholder="Add a next step…"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              maxLength={200}
            />
            <input
              aria-label="Task due date"
              type="date"
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
            />
            <select
              aria-label="Task priority"
              value={taskPriority}
              onChange={(e) =>
                setTaskPriority(e.target.value as Task["priority"])
              }
            >
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
            {taskInput.trim() && (
              <IconButton label="Save task" onClick={() => addTask()}>
                <ArrowUpRight size={15} />
              </IconButton>
            )}
          </form>
        </>
      ) : (
        <div className="notes-area">
          <textarea
            aria-label="Private notes"
            placeholder="A thought, an idea, something to remember…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <span>
            <Check size={11} /> Saved on this device
          </span>
        </div>
      )}
    </section>
  );

  return (
    <div className="app-shell orbit-v2 orbit-v3 orbit-v31">
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          aria-label="Orbit home"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <OrbitLogo />
          <span className="sidebar-wordmark">
            orbit<span>PERSONAL / 4.3</span>
          </span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <div className="nav-group">
          {[
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "calendar", label: "Planner", icon: CalendarDays },
            { id: "inbox", label: "Inbox", icon: Mail },
            { id: "files", label: "Files", icon: Folder },
            { id: "media", label: "Media Center", icon: Clapperboard },
            { id: "shopping", label: "Shopping Scout", icon: ShoppingBag },
            { id: "finance", label: "Finances", icon: Wallet },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              onClick={() => navigate(id as View)}
              aria-current={view === id ? "page" : undefined}
              aria-label={label}
              title={label}
            >
              <Icon size={21} />
              {view === id && <span />}
              <span className="nav-text">{label}</span>
              <span className="nav-tooltip">{label}</span>
            </button>
          ))}
        </div>
        <div className="nav-divider" />
        <button
          className={`nav-item ${chatOpen ? "active" : ""}`}
          onClick={() => setChatOpen(!chatOpen)}
          aria-label="Orbit assistant"
          title="Orbit assistant"
        >
          <AudioLines size={22} />
          <span className="nav-text">Assistant</span>
        </button>
        <div className="sidebar-bottom">
          <button
            className="profile-avatar"
            onClick={() => setModal("connections")}
            aria-label="Settings and connections"
            title="Joe profile and settings"
          >
            J<span />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="wordmark" onClick={() => navigate("overview")}>
            <span className="header-section">
              {view === "overview"
                ? "Overview"
                : view === "media"
                  ? "Media Center"
                  : view === "shopping"
                    ? "Shopping Scout"
                    : view === "finance"
                      ? "Finances"
                      : view[0].toUpperCase() + view.slice(1)}
            </span>
          </div>
          <div className="topbar-right">
            <button
              className="quick-capture-top"
              aria-label="Quick capture"
              title="Quick capture (Ctrl/Cmd + Shift + K)"
              onClick={() =>
                window.dispatchEvent(new Event("orbit:quickcapture"))
              }
            >
              <PlusCircle size={16} />
              <span>Capture</span>
            </button>
            <button
              className="global-search"
              onClick={() => setModal("search")}
            >
              <Search size={15} />
              <span>Find anything…</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="sync-status"
              onClick={() => setModal("connections")}
            >
              <i className={googleLive ? "live" : ""} />
              {demoMode
                ? "Sample mode"
                : googleLive || connections.spotify.connected || calendarLive
                  ? "Connected"
                  : "Connect accounts"}
            </button>
            <span className="topbar-divider" />
            <IconButton
              label="Notifications"
              onClick={() => setModal("notifications")}
            >
              <Bell size={18} />
              {live?.errors?.length ? <i className="notification-dot" /> : null}
            </IconButton>
            <button
              className="topbar-avatar"
              onClick={() => setModal("connections")}
              aria-label="Profile and connections"
            >
              J
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                JOE’S DASHBOARD <span className="heading-separator">/</span>{" "}
                {view === "overview"
                  ? "OVERVIEW"
                  : view === "media"
                    ? "MEDIA CENTER"
                    : view === "shopping"
                      ? "SHOPPING SCOUT"
                      : view.toUpperCase()}
              </div>
              <h1>
                {view === "overview"
                  ? `${greeting}, Joe.`
                  : view === "calendar"
                    ? "Your schedule."
                    : view === "inbox"
                      ? "Your inbox."
                      : view === "media"
                        ? "Media Center."
                        : view === "shopping"
                          ? "Shopping Scout."
                          : view === "finance"
                            ? "Your finances."
                            : "Your files."}
                <span className="heading-dot">.</span>
              </h1>
            </div>
            <div className="date-weather">
              <div className="today-date">
                <CalendarDays size={15} />
                {dateLabel}
              </div>
              <time
                className="local-clock"
                dateTime={today.toISOString()}
                aria-label={`${timeOfDay}, ${today.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}`}
              >
                <TimeOfDayIcon aria-hidden="true" />
                {today.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>
            </div>
          </div>
          {live?.errors?.length ? (
            <div className="service-warning">
              <Bell size={14} />
              <span>
                {live.errors[0].service}: {live.errors[0].message}
              </span>
              <button onClick={() => void refresh()}>Retry</button>
            </div>
          ) : null}
          {view === "overview" ? (
            <>
              <div className="v2-status-strip">
                <span>
                  <i className="live-dot" />
                  TODAY
                </span>
                {calendarLive && (
                  <span>{`${todayEvents.length} events today`}</span>
                )}
                <span>{tasks.length - done} open tasks</span>
                <button onClick={() => setModal("connections")}>
                  Profile & settings <ArrowUpRight size={12} />
                </button>
              </div>
              <section className="card daily-brief">
                <span className="eyebrow">YOUR DAY</span>
                <strong>
                  {todayEvents.length
                    ? `Next: ${todayEvents[0].title} · ${shortTime(todayEvents[0].start)}`
                    : "No upcoming calendar events"}
                </strong>
                <span>{tasks.filter((t) => !t.done).length} open tasks</span>
                <span className="today-priorities">
                  {tasks
                    .filter((t) => !t.done)
                    .sort(
                      (a, b) =>
                        ({ high: 0, normal: 1, low: 2 })[
                          a.priority || "normal"
                        ] -
                        { high: 0, normal: 1, low: 2 }[b.priority || "normal"],
                    )
                    .slice(0, 3)
                    .map((task) => task.title)
                    .join(" · ")}
                </span>
                {weatherTemp && (
                  <strong className="today-temperature">
                    {weatherTemp.temperature}°
                    {weatherTemp.unit === "fahrenheit" ? "F" : "C"}
                    <small>
                      {weatherTemp.location} · {weatherTemp.description}
                    </small>
                  </strong>
                )}
              </section>
              <div className="v2-primary">
                <div className="essentials-column">
                  {calendarPanel()}
                  {inboxPanel()}
                </div>
                <div className="priorities-column">
                  {tasksPanel()}
                  {focusPanel()}
                </div>
                <div className="atmosphere-column">
                  <WeatherPanel
                    onWeather={setWeatherSummary}
                    onTemperature={setWeatherTemp}
                  />
                  {musicPanel()}
                </div>
              </div>
              <CommandCenter
                tasks={tasks}
                onAddTask={(title) =>
                  setTasks((current) =>
                    current.some(
                      (t) => t.title.toLowerCase() === title.toLowerCase(),
                    )
                      ? current
                      : [
                          ...current,
                          {
                            id: crypto.randomUUID(),
                            title,
                            done: false,
                            source: "assistant",
                          },
                        ],
                  )
                }
              />
              <div className="tonight-heading">
                After hours
                <span>MEDIA</span>
              </div>
              <div className="tonight-grid">
                <MediaSummary
                  onOpen={(id) => {
                    setMediaId(id);
                    navigate("media");
                  }}
                />
              </div>
              <ShoppingScout />
              <div className="v2-files" id="bottom-widgets">
                {filesPanel()}
              </div>
            </>
          ) : view === "calendar" ? (
            <div className="workspace-grid">
              <div>{calendarPanel(true)}</div>
              <div className="workspace-aside">
                {tasksPanel()}
                {focusPanel()}
                <section className="card gentle-card">
                  <Sparkles size={20} />
                  <h3>A calendar with breathing room.</h3>
                  <p>
                    {calendarLive
                      ? `Your calendar, read-only and in one place. Source: ${connections.calendar?.source === "ics" ? "ICS feed / import" : "Google"}.`
                      : "Use a private ICS feed or import an .ics file. Your calendar doesn’t need a Google Cloud project."}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setModal("connections")}
                  >
                    {calendarLive ? "Manage connection" : "Add calendar feed"}
                    <ArrowUpRight size={14} />
                  </button>
                </section>
              </div>
            </div>
          ) : view === "inbox" ? (
            <div className="workspace-grid">
              <div>{inboxPanel(true)}</div>
              <div className="workspace-aside">
                {tasksPanel()}
                <section className="card gentle-card">
                  <Mail size={20} />
                  <h3>Your attention is a good thing.</h3>
                  <p>
                    Keep it for the people and conversations that matter. Orbit
                    reads email summaries; it never sends or deletes your mail.
                  </p>
                </section>
              </div>
            </div>
          ) : view === "media" ? (
            <MediaCenter
              initialMediaId={mediaId}
              onOpened={() => setMediaId(undefined)}
            />
          ) : view === "shopping" ? (
            <ShoppingScout />
          ) : view === "finance" ? (
            <FinancePanel />
          ) : (
            <>
              {filesPanel(true)}
              <div className="files-note">
                <Link2 size={14} />
                {googleLive
                  ? "Your recent files are synced from Google Drive."
                  : "A glimpse of what’s possible. Connect Google Drive to see your own files."}
                <button onClick={() => setModal("connections")}>
                  Profile & settings
                  <ArrowUpRight size={12} />
                </button>
              </div>
            </>
          )}
          <footer className="page-footer">
            <span>
              <OrbitLogo />
              Orbit 4.3 <span>·</span> Joe
            </span>
            <span>
              {loading ? (
                <>
                  <LoaderCircle className="spin" size={11} /> Syncing your orbit
                </>
              ) : googleLive ? (
                <>
                  <i className="live-dot" /> Synced with Google
                </>
              ) : (
                <>
                  {demoMode ? "Sample content" : "Private space"} <span>·</span>{" "}
                  {calendarLive ? "Calendar connected" : "Local dashboard"}
                </>
              )}
              <button
                onClick={() => void refresh()}
                aria-label="Refresh dashboard"
              >
                <RotateCcw size={12} />
              </button>
            </span>
          </footer>
        </main>
      </div>
      {chatOpen && (
        <div
          className="conversation-backdrop"
          onClick={() => {
            dictation.stop();
            setChatOpen(false);
          }}
        >
          <section
            ref={conversationRef}
            className="chat-panel v2-conversation"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Orbit assistant"
          >
            <div className="chat-heading">
              <span className="chat-avatar">
                <AudioLines size={21} />
              </span>
              <div>
                <h2>A conversation with Orbit</h2>
                <span>
                  <i />
                  {speaking
                    ? "Speaking"
                    : connections.assistant.configured
                      ? "AI assistant"
                      : "Local guide · Enable AI for full conversations"}
                </span>
              </div>
              <IconButton
                label={voice ? "Mute spoken replies" : "Enable spoken replies"}
                onClick={() => {
                  setVoice(!voice);
                  if (voice) {
                    window.speechSynthesis?.cancel();
                    setSpeaking(false);
                  }
                }}
              >
                {voice ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </IconButton>
              <IconButton
                label="Close assistant"
                onClick={() => {
                  dictation.stop();
                  setChatOpen(false);
                }}
              >
                <X size={17} />
              </IconButton>
            </div>
            <div className="conversation-context">
              <span>
                <CheckCheck size={13} /> Our build handoff is loaded
              </span>
              <button
                onClick={() => {
                  setMessages([
                    {
                      role: "assistant",
                      content:
                        "A fresh conversation. Our build handoff and your next steps are still here.",
                    },
                  ]);
                  window.speechSynthesis?.cancel();
                  setSpeaking(false);
                }}
              >
                Clear conversation
              </button>
            </div>
            <div className="chat-messages">
              {messages.map((message, i) => (
                <div className={`chat-message ${message.role}`} key={i}>
                  {message.role === "assistant" && <Sparkles size={14} />}
                  <p>{message.content}</p>
                </div>
              ))}
              {chatBusy && (
                <div className="chat-thinking">
                  <i />
                  <i />
                  <i />
                </div>
              )}
              <div ref={chatEnd} />
            </div>
            {messages.length < 3 && (
              <div className="chat-prompts">
                {["What’s my day looking like?", "Start a focus session"].map(
                  (q) => (
                    <button key={q} onClick={() => void askAssistant(q)}>
                      {q}
                      <ArrowUpRight size={12} />
                    </button>
                  ),
                )}
              </div>
            )}
            {dictation.error && (
              <div className="dictation-error" role="alert">
                <span>{dictation.error}</span>
                <button
                  onClick={dictation.clearError}
                  aria-label="Dismiss microphone error"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {(listening || transcribing || dictation.interim) && (
              <div className="dictation-status" role="status">
                {transcribing ? (
                  <LoaderCircle size={14} className="spin" />
                ) : (
                  <AudioLines size={14} />
                )}
                <span>
                  {transcribing
                    ? "Transcribing your recording…"
                    : dictation.interim ||
                      "Listening. Speak naturally, then stop when you’re done."}
                </span>
                <button onClick={dictation.stop} disabled={transcribing}>
                  Stop
                </button>
              </div>
            )}
            <form
              className="chat-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void askAssistant(chatInput);
              }}
            >
              <input
                aria-label="Message Orbit"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={listening ? "Listening…" : "What’s on your mind?"}
                maxLength={2000}
              />
              <IconButton
                label={listening ? "Stop microphone" : "Use microphone"}
                className={listening ? "mic-active" : ""}
                onClick={startListening}
              >
                <Mic size={17} />
              </IconButton>
              <button
                type="submit"
                className="send-button"
                disabled={
                  !chatInput.trim() || chatBusy || listening || transcribing
                }
                aria-label="Send message"
              >
                <ArrowUpRight size={17} />
              </button>
            </form>
            <div className="voice-options">
              <span>Dictation fills your draft. Send when you’re ready.</span>
              {dictation.canRecord && connections.assistant.configured && (
                <button
                  disabled={listening || transcribing}
                  onClick={() => void dictation.startRecording()}
                >
                  Use audio transcription
                </button>
              )}
            </div>
            <div className="chat-disclaimer">
              {connections.assistant.configured
                ? "OpenAI API · Separate from ChatGPT. Audio transcription sends recordings to OpenAI."
                : "Browser dictation may use your browser’s speech service. Full AI needs a separate API key."}
            </div>
          </section>
        </div>
      )}
      {modal === "connections" && (
        <ModalShell
          title="Joe’s profile & settings"
          eyebrow="YOUR ORBIT"
          onClose={closeModal}
          wide
        >
          <div className="profile-settings-card">
            <span className="profile-settings-avatar">J</span>
            <div>
              <strong>Joe</strong>
              <span>Personal dashboard · private space</span>
            </div>
            <small>Orbit 4.3</small>
          </div>
          <p className="modal-intro">
            Connections, local preferences, assistant settings, and backups in
            one place.
          </p>
          <WeatherPanel settingsOnly />
          <CalendarConnect
            connected={Boolean(connections.calendar?.connected)}
            source={connections.calendar?.source}
            feedName={connections.calendar?.feedName}
            onChanged={() => void refresh()}
          />
          <div className="connection-list">
            {(["google", "spotify"] as const).map((provider) => (
              <div className="connection-card" key={provider}>
                <span className={`provider-icon ${provider}`}>
                  {provider === "google" ? (
                    <GoogleIcon />
                  ) : (
                    <SpotifyIcon size={25} />
                  )}
                </span>
                <div className="connection-info">
                  <h3>
                    {provider === "google" ? "Google Workspace" : "Spotify"}
                    {connections[provider].connected && (
                      <span className="connected-badge">
                        <Check size={10} /> Connected
                      </span>
                    )}
                  </h3>
                  <p>
                    {provider === "google"
                      ? "Optional: Gmail & Drive, plus Google Calendar."
                      : "Your music. The perfect backdrop to your day."}
                  </p>
                  <span>
                    {provider === "google"
                      ? "Read-only access. Your content stays yours."
                      : "Playback controls require Spotify Premium."}
                  </span>
                </div>
                <button
                  className={
                    connections[provider].connected
                      ? "disconnect-button"
                      : "connect-button"
                  }
                  onClick={() =>
                    connections[provider].connected
                      ? void disconnect(provider)
                      : connect(provider)
                  }
                >
                  {connections[provider].connected ? (
                    "Disconnect"
                  ) : (
                    <>
                      Connect
                      <ArrowUpRight size={13} />
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
          {(!connections.google.configured ||
            !connections.spotify.configured) && (
            <div className="setup-notice">
              <Settings2 size={17} />
              <div>
                <strong>A one-time setup, then it’s all yours.</strong>
                <p>
                  Calendar feeds and weather need no OAuth client or trial. For
                  optional Spotify / Google access, add its OAuth client
                  credentials to your server’s <code>.env</code> file and
                  restart. The README has the steps and exact callback URLs.
                  Credentials stay on your server.
                </p>
                <div className="setup-providers">
                  {!connections.google.configured && (
                    <span>Google · Setup needed</span>
                  )}
                  {!connections.spotify.configured && (
                    <span>Spotify · Setup needed</span>
                  )}
                </div>
              </div>
            </div>
          )}
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
            />
            <span>
              Show sample content for unconnected services
              <small>
                Off by default. Your data and sample data are labeled
                separately.
              </small>
            </span>
          </label>
          <button
            className="text-button"
            onClick={() => setModal("assistantSettings")}
          >
            Assistant & voice settings
            <ArrowUpRight size={14} />
          </button>
          <BackupPanel />
          <div className="privacy-note">
            <span>
              <CheckCheck size={15} /> Designed for your own private space
            </span>
            <p>
              Tasks and notes are saved in this browser. Connected accounts use
              a private server token store. Your calendar feed link is private
              too. Disconnected services stay empty unless you enable sample
              mode.
            </p>
          </div>
        </ModalShell>
      )}
      {modal === "assistantSettings" && (
        <ModalShell
          title="Assistant settings"
          eyebrow="ASSISTANT & VOICE"
          onClose={closeModal}
          wide
        >
          <div className="assistant-settings-intro">
            <AudioLines size={26} />
            <p>
              Orbit carries a handoff from our build and remembers conversations
              saved in this browser. It can’t read your ChatGPT account or this
              chat in the background.
            </p>
          </div>
          <div className="ai-setup-card">
            <h3>
              {connections.assistant.configured
                ? "OpenAI is connected"
                : "Enable full conversations"}
            </h3>
            <p>
              {connections.assistant.configured
                ? "Your server is configured for OpenAI conversations and recorded-audio transcription."
                : "Add ORBIT_AI_KEY (or OPENAI_API_KEY) to your private .env file, then restart Orbit. Use an API key from platform.openai.com; ChatGPT subscriptions do not include API usage."}
            </p>
            <code>ORBIT_AI_KEY=your-private-api-key</code>
            <p>
              Never paste the key into this chat or your dashboard conversation.
              Questions, recent website messages, and dashboard context are sent
              to OpenAI when AI is enabled.
            </p>
          </div>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={trackNextSteps}
              onChange={(e) => setTrackNextSteps(e.target.checked)}
            />
            <span>
              Review next steps as we talk
              <small>
                Queue up to three concrete AI-suggested actions per reply for
                your approval before adding them to your to-dos. Reversible,
                local to this browser; review or delete anytime.
              </small>
            </span>
          </label>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={voice}
              onChange={(e) => {
                setVoice(e.target.checked);
                if (!e.target.checked) {
                  window.speechSynthesis?.cancel();
                  setSpeaking(false);
                }
              }}
            />
            <span>
              Read replies aloud
              <small>Uses your browser’s available voices.</small>
            </span>
          </label>
          <div className="voice-help">
            <Mic size={18} />
            <div>
              <strong>Microphone not working?</strong>
              <p>
                Allow microphone access for this site in your browser and in
                macOS System Settings → Privacy & Security → Microphone. Chrome
                or Safari on a local address / HTTPS works best. Native speech
                services need an internet connection. With an API key, “Use
                audio transcription” provides an alternate recording path.
              </p>
            </div>
          </div>
          <a
            className="text-button"
            href="https://chatgpt.com/"
            target="_blank"
            rel="noreferrer"
          >
            Open ChatGPT for this account’s conversations
            <ExternalLink size={13} />
          </a>
        </ModalShell>
      )}
      <QuickCapture
        onTask={(title) =>
          setTasks((current) => [
            ...current,
            { id: crypto.randomUUID(), title, done: false, source: "you" },
          ])
        }
        onNote={(text) =>
          setNotes((current) => (current ? `${current}\n\n${text}` : text))
        }
      />
      {modal === "search" && (
        <ModalShell
          title="What are you looking for?"
          eyebrow="SEARCH"
          onClose={closeModal}
          wide
        >
          <div className="search-field">
            <Search size={20} />
            <input
              placeholder="Search events, emails, files, or to-dos…"
              aria-label="Search everything"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>ESC</kbd>
          </div>
          <div className="search-results">
            {!query.trim() ? (
              <>
                <div className="search-section-label">JUMP TO</div>
                {[
                  {
                    label: "Your calendar",
                    icon: CalendarDays,
                    target: "calendar",
                  },
                  { label: "Important emails", icon: Mail, target: "inbox" },
                  { label: "Recent files", icon: Folder, target: "files" },
                  {
                    label: "Media Center",
                    icon: Clapperboard,
                    target: "media",
                  },
                ].map(({ label, icon: Icon, target }) => (
                  <button
                    className="search-result"
                    key={target}
                    onClick={() => {
                      navigate(target as View);
                      closeModal();
                    }}
                  >
                    <span className="search-result-icon">
                      <Icon size={18} />
                    </span>
                    <span>{label}</span>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </>
            ) : (
              <>
                {events
                  .filter((e) =>
                    e.title.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((e) => (
                    <button
                      className="search-result"
                      key={e.id}
                      onClick={() => {
                        closeModal();
                        setDetail({ type: "event", item: e });
                      }}
                    >
                      <CalendarDays size={18} />
                      <div>
                        <strong>{e.title}</strong>
                        <small>Calendar · {shortTime(e.start)}</small>
                      </div>
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                {emails
                  .filter((e) =>
                    `${e.subject} ${e.from}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((e) => (
                    <button
                      className="search-result"
                      key={e.id}
                      onClick={() => {
                        closeModal();
                        openMail(e);
                      }}
                    >
                      <Mail size={18} />
                      <div>
                        <strong>{e.subject}</strong>
                        <small>{e.from}</small>
                      </div>
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                {files
                  .filter((f) =>
                    f.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((f) => (
                    <button
                      className="search-result"
                      key={f.id}
                      onClick={() => {
                        closeModal();
                        setDetail({ type: "file", item: f });
                      }}
                    >
                      <Folder size={18} />
                      <div>
                        <strong>{f.name}</strong>
                        <small>Google Drive</small>
                      </div>
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                {tasks
                  .filter((t) =>
                    t.title.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((t) => (
                    <button
                      className="search-result"
                      key={t.id}
                      onClick={() => {
                        setTaskTab("tasks");
                        navigate("overview");
                        closeModal();
                        setTimeout(
                          () =>
                            document
                              .getElementById("bottom-widgets")
                              ?.scrollIntoView({ behavior: "smooth" }),
                          50,
                        );
                      }}
                    >
                      <CheckCheck size={18} />
                      <div>
                        <strong>{t.title}</strong>
                        <small>{t.done ? "Completed" : "To-do"}</small>
                      </div>
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                {![
                  ...events.map((e) => e.title),
                  ...emails.map((e) => e.subject + " " + e.from),
                  ...files.map((f) => f.name),
                  ...tasks.map((t) => t.title),
                ].some((t) =>
                  t.toLowerCase().includes(query.toLowerCase()),
                ) && (
                  <div className="empty-state">
                    <Search size={26} />
                    <strong>No matches, just yet.</strong>
                    <p>Try a name, a file, or something on your calendar.</p>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="search-hint">
            <Command size={12} /> K to find your way, anytime.
          </div>
        </ModalShell>
      )}
      {modal === "notifications" && (
        <ModalShell
          title="Notifications"
          eyebrow="YOUR UPDATES"
          onClose={closeModal}
        >
          <div className="notification-item">
            <span className="metric-icon metric-blue">
              <Sparkles size={20} />
            </span>
            <div>
              <h3>Welcome to your personal space.</h3>
              <p>
                Your calendar, inbox, files, and music have a new home. Connect
                your accounts to make it yours.
              </p>
              <button
                className="text-button"
                onClick={() => setModal("connections")}
              >
                Connect your world
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
          {live?.errors.map((error, i) => (
            <div key={i} className="notification-item">
              <Bell size={20} />
              <div>
                <h3>{error.service} needs a little attention</h3>
                <p>{error.message}</p>
              </div>
            </div>
          ))}
          {remaining === 0 && (
            <div className="notification-item">
              <CheckCheck size={22} />
              <div>
                <h3>That’s a little win.</h3>
                <p>
                  Your focus session is complete. Stretch, breathe, and enjoy a
                  break.
                </p>
              </div>
            </div>
          )}
        </ModalShell>
      )}
      {detail && (
        <ModalShell
          title={
            detail.type === "email"
              ? detail.item.subject
              : detail.type === "file"
                ? detail.item.name
                : detail.item.title
          }
          eyebrow={
            detail.type === "email"
              ? "YOUR INBOX"
              : detail.type === "file"
                ? "YOUR FILES"
                : "YOUR CALENDAR"
          }
          onClose={closeDetail}
        >
          {(detail.type === "event" ? !calendarLive : !googleLive) &&
            demoMode && (
              <div className="detail-sample">
                <SampleTag />
                <span>A glimpse of your connected dashboard</span>
              </div>
            )}
          {detail.type === "email" ? (
            <>
              <div className="email-detail-from">
                <span className="avatar avatar-0">{detail.item.from[0]}</span>
                <div>
                  <strong>{detail.item.from}</strong>
                  <span>
                    {new Date(detail.item.time).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                {detail.item.important && (
                  <span className="important-badge">
                    <Star size={12} /> Important
                  </span>
                )}
              </div>
              <div className="email-body">
                {detail.item.snippet ||
                  "Open this email in Gmail to read the full message."}
              </div>
              {detail.item.url ? (
                <a
                  className="primary-button detail-action"
                  href={detail.item.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read in Gmail
                  <ExternalLink size={14} />
                </a>
              ) : (
                <button
                  className="primary-button detail-action"
                  onClick={() => {
                    setDetail(null);
                    setModal("connections");
                  }}
                >
                  Connect your inbox
                  <ArrowUpRight size={14} />
                </button>
              )}
              <p className="detail-caption">
                {googleLive
                  ? "This is a message summary. Open Gmail for the full conversation."
                  : "This is sample content. Your emails will appear after connecting Google."}
              </p>
            </>
          ) : detail.type === "event" ? (
            <>
              <div className="event-detail-meta">
                <span>
                  <CalendarDays size={18} />
                  {eventDate(detail.item.start).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <span>
                  <Clock3 size={18} />
                  {detail.item.allDay
                    ? "All day"
                    : `${shortTime(detail.item.start)} – ${shortTime(detail.item.end)}`}
                </span>
                <span>
                  <Target size={18} />
                  {detail.item.location || "Personal calendar"}
                </span>
              </div>
              {calendarLive && detail.item.meetingUrl ? (
                <a
                  className="primary-button detail-action"
                  href={detail.item.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Join meeting
                  <ArrowUpRight size={15} />
                </a>
              ) : calendarLive && detail.item.url ? (
                <a
                  className="primary-button detail-action"
                  href={detail.item.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open event
                  <ArrowUpRight size={15} />
                </a>
              ) : (
                <button
                  className="primary-button detail-action"
                  onClick={() => {
                    setDetail(null);
                    setModal("connections");
                  }}
                >
                  {calendarLive
                    ? "Manage calendar connection"
                    : "Connect your calendar"}
                  <ArrowUpRight size={15} />
                </button>
              )}
            </>
          ) : (
            <>
              <div className="file-detail-preview">
                <span className={`file-type-icon ${detail.item.type}`}>
                  {detail.item.type === "folder" ? (
                    <Folder size={50} />
                  ) : (
                    <FileText size={50} />
                  )}
                </span>
              </div>
              <div className="file-detail-meta">
                <span>
                  Type<strong>{detail.item.type}</strong>
                </span>
                <span>
                  Owner<strong>{detail.item.owner || "You"}</strong>
                </span>
                <span>
                  Last modified
                  <strong>
                    {new Date(detail.item.modifiedAt).toLocaleDateString()}
                  </strong>
                </span>
              </div>
              {detail.item.url ? (
                <a
                  className="primary-button detail-action"
                  href={detail.item.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Google Drive
                  <ExternalLink size={14} />
                </a>
              ) : (
                <button
                  className="primary-button detail-action"
                  onClick={() => {
                    setDetail(null);
                    setModal("connections");
                  }}
                >
                  Connect Google Drive
                  <ArrowUpRight size={14} />
                </button>
              )}
            </>
          )}
        </ModalShell>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>
            <Sparkles size={17} />
          </span>
          <p>{toast}</p>
          <IconButton label="Dismiss notification" onClick={() => setToast("")}>
            <X size={15} />
          </IconButton>
        </div>
      )}
    </div>
  );
}
