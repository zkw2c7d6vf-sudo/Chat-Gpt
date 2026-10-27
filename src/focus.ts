import { newId } from "./id.ts";
import { useCallback, useEffect, useState } from "react";
import { localDay, readLocal, writeLocal } from "./local.ts";

export type Soundscape =
  "off" | "rain" | "roof" | "window" | "storm" | "snow" | "hail";
export type FocusSettings = {
  minutes: number;
  sound: Soundscape;
  volume: number;
  label: string;
};
export type FocusSession = {
  id: string;
  minutes: number;
  remaining: number;
  deadline: number | null;
  label: string;
};
export type FocusRecord = {
  id: string;
  minutes: number;
  label: string;
  completedAt: string;
};
export const sounds = [
  "off",
  "rain",
  "roof",
  "window",
  "storm",
  "snow",
  "hail",
] as const;
const initialSettings: FocusSettings = {
  minutes: 25,
  sound: "off",
  volume: 50,
  label: "",
};

export function focusSeconds(session: FocusSession, now: number): number {
  return session.deadline === null
    ? session.remaining
    : Math.max(0, Math.ceil((session.deadline - now) / 1000));
}
export function validFocusSettings(value: unknown): value is FocusSettings {
  const v = value as FocusSettings;
  return Boolean(
    v &&
    Number.isInteger(v.minutes) &&
    v.minutes >= 1 &&
    v.minutes <= 1440 &&
    sounds.includes(v.sound) &&
    Number.isFinite(v.volume) &&
    v.volume >= 0 &&
    v.volume <= 100 &&
    typeof v.label === "string" &&
    v.label.length <= 200,
  );
}
function fresh(settings: FocusSettings): FocusSession {
  return {
    id: newId(),
    minutes: settings.minutes,
    remaining: settings.minutes * 60,
    deadline: null,
    label: settings.label,
  };
}
function readSettings(): FocusSettings {
  const value = readLocal<unknown>("orbit-focus-settings-v45", null);
  if (validFocusSettings(value)) return value;
  const sound = readLocal<Soundscape>("orbit-focus-sound-v2", "off");
  return { ...initialSettings, sound: sounds.includes(sound) ? sound : "off" };
}
function readHistory(): FocusRecord[] {
  const value = readLocal<FocusRecord[]>("orbit-focus-history-v45", []);
  return Array.isArray(value)
    ? value
        .filter(
          (v) =>
            v &&
            typeof v.id === "string" &&
            Number.isFinite(v.minutes) &&
            v.minutes > 0 &&
            typeof v.label === "string" &&
            Number.isFinite(Date.parse(v.completedAt)),
        )
        .slice(0, 120)
    : [];
}
export function useFocus(onComplete: (message: string) => void) {
  const [settings, setSettings] = useState(readSettings);
  const [session, setSession] = useState<FocusSession>(() => {
    const value = readLocal<FocusSession | null>(
      "orbit-focus-session-v45",
      null,
    );
    return value &&
      typeof value.id === "string" &&
      Number.isInteger(value.minutes) &&
      value.minutes >= 1 &&
      value.minutes <= 1440 &&
      Number.isFinite(value.remaining) &&
      value.remaining >= 0 &&
      value.remaining <= value.minutes * 60 &&
      (value.deadline === null ||
        (Number.isFinite(value.deadline) &&
          value.deadline <= Date.now() + value.minutes * 60000)) &&
      typeof value.label === "string"
      ? value
      : fresh(readSettings());
  });
  const [history, setHistory] = useState(readHistory);
  const [now, setNow] = useState(Date.now());
  const [soundError, setSoundError] = useState("");
  const [audioArmed, setAudioArmed] = useState(false);
  const focusing = session.deadline !== null;
  const remaining = focusSeconds(session, now);
  useEffect(() => {
    writeLocal("orbit-focus-settings-v45", settings);
    writeLocal("orbit-focus-sound-v2", settings.sound);
  }, [settings]);
  useEffect(() => {
    writeLocal("orbit-focus-session-v45", session);
  }, [session]);
  useEffect(() => {
    if (!focusing) return;
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 250);
    window.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", tick);
    };
  }, [focusing]);
  useEffect(() => {
    if (!focusing || remaining !== 0) return;
    const records = readHistory();
    if (!records.some((item) => item.id === session.id)) {
      const next = [
        {
          id: session.id,
          minutes: session.minutes,
          label: session.label,
          completedAt: new Date(session.deadline!).toISOString(),
        },
        ...records,
      ].slice(0, 120);
      if (writeLocal("orbit-focus-history-v45", next)) setHistory(next);
      onComplete("Focus complete. Your session is saved. Time for a break.");
    }
    setSession((current) => ({ ...current, deadline: null, remaining: 0 }));
    setAudioArmed(false);
  }, [focusing, remaining, session, onComplete]);
  const start = useCallback(() => {
    const seconds = focusSeconds(session, Date.now());
    const next = seconds > 0 ? session : fresh(settings);
    setNow(Date.now());
    setSession({
      ...next,
      remaining: seconds || next.remaining,
      deadline: Date.now() + (seconds || next.remaining) * 1000,
      label: settings.label,
    });
    setAudioArmed(true);
  }, [session, settings]);
  const pause = useCallback(() => {
    setSession((current) => ({
      ...current,
      remaining: focusSeconds(current, Date.now()),
      deadline: null,
    }));
    setAudioArmed(false);
  }, []);
  const reset = useCallback(() => {
    setSession(fresh(settings));
    setAudioArmed(false);
  }, [settings]);
  const changeMinutes = (minutes: number) => {
    const next = {
      ...settings,
      minutes: Math.min(1440, Math.max(1, Math.round(minutes || 1))),
    };
    setSettings(next);
    setSession(fresh(next));
    setAudioArmed(false);
  };
  const todayHistory = history.filter(
    (item) => localDay(new Date(item.completedAt)) === localDay(new Date(now)),
  );
  return {
    soundError,
    setSoundError,
    settings,
    setSettings,
    session,
    remaining,
    focusing,
    start,
    pause,
    reset,
    changeMinutes,
    history,
    todayHistory,
    audioArmed,
    armAudio: () => setAudioArmed(true),
  };
}
export type FocusController = ReturnType<typeof useFocus>;
