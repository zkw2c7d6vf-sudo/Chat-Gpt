import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Pause,
  Play,
  RotateCcw,
  Target,
  Volume2,
} from "lucide-react";
import { downloadCsv } from "./exports";
import { localDay } from "./local";
import type { FocusController, Soundscape } from "./focus";

function soundEngine(kind: Exclude<Soundscape, "off">, volume: number) {
  const Constructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Constructor)
    throw new Error("Focus sound is unavailable in this browser.");
  const context = new Constructor();
  const buffer = context.createBuffer(
    1,
    context.sampleRate * 3,
    context.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  let brown = 0;
  for (let index = 0; index < samples.length; index++) {
    const noise = Math.random() * 2 - 1;
    brown = (brown + 0.02 * noise) / 1.02;
    samples[index] =
      kind === "storm" || kind === "snow"
        ? brown * 3.5
        : noise *
          (kind === "hail"
            ? 0.15 + 0.85 * Math.pow(Math.sin(index / 1100), 8)
            : 0.42);
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = context.createBiquadFilter();
  const config: Record<
    Exclude<Soundscape, "off">,
    [BiquadFilterType, number]
  > = {
    rain: ["bandpass", 1550],
    roof: ["lowpass", 920],
    window: ["highpass", 2350],
    storm: ["lowpass", 720],
    snow: ["lowpass", 360],
    hail: ["highpass", 3900],
  };
  [filter.type, filter.frequency.value] = config[kind];
  filter.Q.value = 0.5;
  const gain = context.createGain();
  gain.gain.value = (volume / 100) * 0.18;
  source.connect(filter).connect(gain).connect(context.destination);
  source.start();
  return { context, gain };
}
export function FocusAudio({ focus }: { focus: FocusController }) {
  const { settings, focusing, setSoundError: setError } = focus;
  const engine = useRef<ReturnType<typeof soundEngine> | null>(null);
  useEffect(() => {
    if (!focusing || !focus.audioArmed || settings.sound === "off") return;
    let active = true;
    try {
      const audio = soundEngine(settings.sound, settings.volume);
      engine.current = audio;
      void audio.context.resume().catch(() => {
        if (active)
          setError(
            "Your browser paused audio. Pause and resume focus to retry.",
          );
      });
      setError("");
      return () => {
        active = false;
        engine.current = null;
        void audio.context.close().catch(() => {});
      };
    } catch {
      setError("Focus sound is unavailable. The timer will keep running.");
    }
  }, [focusing, focus.audioArmed, settings.sound]);
  useEffect(() => {
    if (engine.current)
      engine.current.gain.gain.setTargetAtTime(
        (settings.volume / 100) * 0.18,
        engine.current.context.currentTime,
        0.08,
      );
  }, [settings.volume]);
  return null;
}
export default function FocusPanel({
  focus,
  compact = false,
}: {
  focus: FocusController;
  compact?: boolean;
}) {
  const { settings, session, remaining, focusing } = focus;
  const [custom, setCustom] = useState(
    ![5, 10, 25, 50].includes(settings.minutes),
  );
  const todayMinutes = focus.todayHistory.reduce(
    (total, item) => total + item.minutes,
    0,
  );
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekMinutes = focus.history
    .filter(
      (item) => localDay(new Date(item.completedAt)) >= localDay(weekStart),
    )
    .reduce((total, item) => total + item.minutes, 0);
  return (
    <section
      className={`card focus-card ${focusing ? "focus-active" : ""}`}
      aria-label="Focus timer"
    >
      <div className="focus-heading">
        <span>
          <Target size={17} />
          Focus timer
        </span>
        <div className="duration-control">
          <select
            aria-label="Focus duration"
            value={custom ? "custom" : String(settings.minutes)}
            onChange={(event) => {
              setCustom(event.target.value === "custom");
              if (event.target.value !== "custom")
                focus.changeMinutes(Number(event.target.value));
            }}
          >
            {[5, 10, 25, 50].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
          <ChevronDown size={11} />
          {custom && (
            <input
              aria-label="Custom focus minutes"
              type="number"
              min="1"
              max="1440"
              value={settings.minutes}
              onChange={(event) =>
                focus.changeMinutes(Number(event.target.value))
              }
            />
          )}
        </div>
      </div>
      {!compact && (
        <input
          className="focus-intention"
          aria-label="Focus intention"
          placeholder="What are you working on?"
          value={settings.label}
          maxLength={200}
          onChange={(event) =>
            focus.setSettings((current) => ({
              ...current,
              label: event.target.value,
            }))
          }
        />
      )}
      <div className="focus-content">
        <div className="timer-ring" role="timer" aria-label="Time remaining">
          <svg viewBox="0 0 92 92" aria-hidden="true">
            <circle cx="46" cy="46" r="40" className="ring-track" />
            <circle
              cx="46"
              cy="46"
              r="40"
              className="ring-progress"
              strokeDasharray={251.3}
              strokeDashoffset={
                251.3 * (1 - remaining / (session.minutes * 60))
              }
            />
          </svg>
          <span>
            {String(Math.floor(remaining / 60)).padStart(2, "0")}
            <small>:</small>
            {String(remaining % 60).padStart(2, "0")}
          </span>
        </div>
        <div className="focus-copy">
          <h3>
            {focusing
              ? "One thing at a time."
              : remaining === 0
                ? "Session complete."
                : "Ready to focus?"}
          </h3>
          <p>
            {focusing
              ? "Your timer keeps its place on reload."
              : "Choose a duration and start."}
          </p>
          <div className="focus-buttons">
            <button
              className="focus-start"
              onClick={focusing ? focus.pause : focus.start}
            >
              {focusing ? <Pause size={12} /> : <Play size={12} />}
              {focusing
                ? "Pause session"
                : remaining > 0 && remaining < session.minutes * 60
                  ? "Resume focus"
                  : "Start focus"}
            </button>
            {(focusing || remaining < session.minutes * 60) && (
              <button
                className="icon-button"
                aria-label="Reset focus timer"
                onClick={focus.reset}
              >
                <RotateCcw size={13} />
              </button>
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
        <span>
          {settings.sound === "off" ? "QUIET" : settings.sound.toUpperCase()}
        </span>
      </div>
      {!compact && (
        <>
          <div className="focus-sound-row">
            <label className="soundscape-select">
              <Volume2 size={13} />
              <span>Focus sound</span>
              <select
                aria-label="Focus sound"
                value={settings.sound}
                onChange={(event) =>
                  focus.setSettings((current) => ({
                    ...current,
                    sound: event.target.value as Soundscape,
                  }))
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
            </label>
          </div>
          {settings.sound !== "off" && (
            <label className="focus-volume">
              Volume
              <input
                aria-label="Focus volume"
                type="range"
                min="0"
                max="100"
                value={settings.volume}
                onChange={(event) =>
                  focus.setSettings((current) => ({
                    ...current,
                    volume: Number(event.target.value),
                  }))
                }
              />
              <span>{settings.volume}%</span>
            </label>
          )}
          {focusing && settings.sound !== "off" && !focus.audioArmed && (
            <button className="text-button" onClick={focus.armAudio}>
              Resume focus sound
            </button>
          )}
          {focus.soundError && (
            <p className="focus-sound-error" role="status">
              {focus.soundError}
            </p>
          )}
          <div className="focus-stats">
            <span>
              <strong>{todayMinutes}</strong> min today
            </span>
            <span>
              <strong>{focus.todayHistory.length}</strong> sessions
            </span>
            <span>
              <strong>{weekMinutes}</strong> min in 7 days
            </span>
          </div>
          {focus.history.length > 0 && (
            <details className="focus-history">
              <summary>Recent sessions</summary>
              <button
                onClick={() =>
                  downloadCsv("orbit-focus-sessions.csv", [
                    ["Completed", "Intention", "Minutes"],
                    ...focus.history.map((item) => [
                      item.completedAt,
                      item.label,
                      item.minutes,
                    ]),
                  ])
                }
              >
                Export sessions CSV
              </button>
              {focus.history.slice(0, 20).map((item) => (
                <div key={item.id}>
                  <span>
                    {item.label || "Focus session"}
                    <small>
                      {new Date(item.completedAt).toLocaleDateString()}
                    </small>
                  </span>
                  <strong>{item.minutes} min</strong>
                </div>
              ))}
            </details>
          )}
        </>
      )}
    </section>
  );
}
