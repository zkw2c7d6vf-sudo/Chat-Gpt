export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string;
  meetingUrl?: string;
  url?: string;
  allDay?: boolean;
  color?: string;
};
export type Mail = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  time: string;
  unread: boolean;
  important: boolean;
  url?: string;
};
export type DriveFile = {
  id: string;
  name: string;
  type: string;
  modifiedAt: string;
  owner: string;
  url?: string;
  thumbnailUrl?: string;
};
export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  url: string;
  device: string;
};
export type Dashboard = {
  calendar: CalendarEvent[];
  emails: Mail[];
  files: DriveFile[];
  spotify: Track | null;
  errors: { service: string; message: string }[];
  updatedAt: string;
};
export type Connections = {
  google: { configured: boolean; connected: boolean; authUrl: string };
  spotify: { configured: boolean; connected: boolean; authUrl: string };
  assistant: { configured: boolean; transcription?: boolean };
  calendar?: { connected: boolean; source: string | null; feedName?: string };
};
export type Task = {
  id: string;
  title: string;
  done: boolean;
  source?: "build" | "assistant" | "you";
  dueDate?: string;
  priority?: "high" | "normal" | "low";
};
const today = new Date();
export function atDay(hour: number, minute = 0, dayOffset = 0) {
  const date = new Date(today);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}
export const demoEvents: CalendarEvent[] = [
  {
    id: "e1",
    title: "A little time for yourself",
    start: atDay(9),
    end: atDay(9, 30),
    location: "Morning ritual",
    color: "green",
  },
  {
    id: "e2",
    title: "Design catch-up",
    start: atDay(10, 30),
    end: atDay(11, 15),
    location: "Google Meet",
    meetingUrl: "https://meet.google.com/",
    color: "blue",
  },
  {
    id: "e3",
    title: "Make something great",
    start: atDay(13),
    end: atDay(14, 30),
    location: "Focus time · Do not disturb",
    color: "violet",
  },
  {
    id: "e4",
    title: "Coffee with Jamie",
    start: atDay(15, 30),
    end: atDay(16, 15),
    location: "The little café on the corner",
    color: "orange",
  },
  {
    id: "e5",
    title: "Weekly reset",
    start: atDay(10, 0, 1),
    end: atDay(10, 30, 1),
    location: "Plan the week ahead",
    color: "green",
  },
  {
    id: "e6",
    title: "Project sync",
    start: atDay(11, 0, 2),
    end: atDay(12, 0, 2),
    location: "Google Meet",
    color: "blue",
  },
  {
    id: "e7",
    title: "Space to think",
    start: atDay(14, 0, 3),
    end: atDay(15, 0, 3),
    location: "Focus time",
    color: "violet",
  },
];
export const demoEmails: Mail[] = [
  {
    id: "m1",
    from: "Jamie Chen",
    subject: "A few ideas for our next chapter",
    snippet:
      "Hey! I put together a small collection of ideas. There’s something exciting in here — take a look when you have a moment. Let’s talk over coffee.",
    time: atDay(9, 42),
    unread: true,
    important: true,
  },
  {
    id: "m2",
    from: "Notion",
    subject: "Your week, beautifully organized",
    snippet:
      "A fresh start is a good time to make space for what matters. Here’s your weekly workspace digest, with the pages you visited most.",
    time: atDay(8, 15),
    unread: true,
    important: true,
  },
  {
    id: "m3",
    from: "Alex Morgan",
    subject: "The weekend plan ☀️",
    snippet:
      "A walk, a good coffee, and absolutely no agenda. Sound like your kind of Sunday? Meet at the usual spot at 11.",
    time: atDay(7, 50),
    unread: false,
    important: true,
  },
  {
    id: "m4",
    from: "The Creative Independent",
    subject: "On making time for the good stuff",
    snippet:
      "This week: a conversation about curiosity, starting before you’re ready, and finding your own rhythm.",
    time: atDay(7),
    unread: false,
    important: false,
  },
];
export const demoFiles: DriveFile[] = [
  {
    id: "f1",
    name: "A few big ideas",
    type: "document",
    modifiedAt: atDay(9, 30),
    owner: "You",
  },
  {
    id: "f2",
    name: "Life, lately",
    type: "folder",
    modifiedAt: atDay(8, 10),
    owner: "You",
  },
  {
    id: "f3",
    name: "The next adventure",
    type: "spreadsheet",
    modifiedAt: atDay(15, 0, -1),
    owner: "You",
  },
  {
    id: "f4",
    name: "Moodboard 2026",
    type: "presentation",
    modifiedAt: atDay(12, 0, -1),
    owner: "Jamie Chen",
  },
];
export const initialTasks: Task[] = [
  {
    id: "v2-secret",
    title: "Confirm the Spotify secret shared in chat was reset",
    done: false,
    source: "build",
  },
  {
    id: "v2-calendar",
    title: "Add your private calendar link or import an .ics file",
    done: false,
    source: "build",
  },
  {
    id: "v2-voice",
    title: "Try dictation on your Mac and check microphone access",
    done: false,
    source: "build",
  },
  {
    id: "v2-ai",
    title: "Set up optional OpenAI API access for full conversations",
    done: false,
    source: "build",
  },
  {
    id: "v2-weather",
    title: "Check Buffalo weather and try a different city",
    done: false,
    source: "build",
  },
  {
    id: "v2-mail",
    title: "Choose whether to connect inbox and Drive later",
    done: false,
    source: "build",
  },
  { id: "v2-spotify", title: "Connect Spotify", done: true, source: "build" },
];
export const buildHandoff =
  "Orbit V4.3 for Joe: local-first navy dashboard with a compact Today brief, integrated calendar and task planner, seven-day forecast, weather location and units in Settings, and a separate private manual finance panel. Preserve existing Spotify, ICS, Google, weather, media, shopping, focus, assistant, and backup behavior. Finance entries are included only in explicit Orbit backups; Orbit does not connect to banks. No fake integration data, silent external actions, or required paid services.";
export const defaultConnections: Connections = {
  google: { configured: false, connected: false, authUrl: "/api/auth/google" },
  spotify: {
    configured: false,
    connected: false,
    authUrl: "/api/auth/spotify",
  },
  assistant: { configured: false },
};
export const shortTime = (date: string) =>
  new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
export const sameDay = (a: Date, b: Date) =>
  a.toDateString() === b.toDateString();

export const eventDate = (value: string) =>
  new Date(value.length === 10 ? `${value}T12:00:00` : value);

export function eventOnDay(event: CalendarEvent, date: Date) {
  const parse = (value: string) =>
    new Date(value.length === 10 ? `${value}T00:00:00` : value);
  const start = parse(event.start),
    end = parse(event.end);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  return (
    start < next &&
    (end > day || (start.getTime() === end.getTime() && sameDay(start, day)))
  );
}
