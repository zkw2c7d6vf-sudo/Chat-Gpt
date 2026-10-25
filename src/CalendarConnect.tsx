import { useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarDays,
  Check,
  FileUp,
  Link2,
  LoaderCircle,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import "./widgets.css";
export type CalendarConnectProps = {
  connected: boolean;
  source?: string | null;
  feedName?: string;
  onChanged: () => void;
};
export default function CalendarConnect({
  connected,
  source,
  feedName,
  onChanged,
}: CalendarConnectProps) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  async function request(path: string, body?: unknown) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(path, {
        method: path.endsWith("disconnect") ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error ||
            "Your calendar could not be connected. Please try again.",
        );
      setUrl("");
      setSuccess(
        path.endsWith("disconnect")
          ? "Calendar feed disconnected."
          : "Calendar added. Your upcoming events are ready.",
      );
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't connect this calendar. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function connect(event: FormEvent) {
    event.preventDefault();
    const value = url.trim();
    if (!/^(https?:|webcal:)\/\//i.test(value)) {
      setError("Paste a full HTTPS or webcal calendar subscription link.");
      setSuccess("");
      return;
    }
    void request("/api/calendar/feed", { url: value });
  }
  async function importFile(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Choose a calendar file smaller than 2 MB.");
      return;
    }
    if (!/\.ics$/i.test(file.name)) {
      setError("Choose an .ics calendar export file.");
      return;
    }
    try {
      const content = await file.text();
      if (!content.includes("BEGIN:VCALENDAR")) {
        setError(
          "This file doesn't look like an .ics calendar. Try exporting it again.",
        );
        return;
      }
      await request("/api/calendar/import", { content });
    } catch {
      setError("Couldn't read that calendar file. Please try another export.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <section className="calendar-connect" aria-label="Calendar feed connection">
      <div className="calendar-connect-heading">
        <span className="calendar-connect-icon">
          <CalendarDays size={22} />
        </span>
        <div>
          <h3>Your calendar. No extra hoops.</h3>
          <p>
            Use a private calendar link or import an .ics file. No Google Cloud
            setup or credit card.
          </p>
        </div>
      </div>
      {connected && (
        <div className="calendar-connected-status">
          <Check size={14} />
          <span>
            {source === "ics"
              ? `${feedName || "Your calendar"} is connected`
              : "Google Calendar is connected. Add a feed to use it instead."}
          </span>
          {source === "ics" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void request("/api/calendar/disconnect")}
            >
              <Unplug size={12} />
              Disconnect feed
            </button>
          )}
        </div>
      )}
      <form onSubmit={connect} className="calendar-feed-form">
        <label htmlFor="calendar-feed-url">
          Private calendar subscription link
        </label>
        <div>
          <Link2 size={16} />
          <input
            id="calendar-feed-url"
            aria-label="Private calendar feed URL"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://…/calendar.ics or webcal://…"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setError("");
              setSuccess("");
            }}
            disabled={busy}
            maxLength={4096}
          />
          <button type="submit" disabled={busy || !url.trim()}>
            {busy ? (
              <LoaderCircle size={14} className="spin" />
            ) : (
              <Link2 size={13} />
            )}
            Connect calendar
          </button>
        </div>
      </form>
      <div className="calendar-import-row">
        <span>Prefer a file?</span>
        <input
          ref={fileRef}
          aria-label="Import ICS calendar file"
          type="file"
          accept=".ics,text/calendar"
          onChange={(event) => void importFile(event.target.files?.[0])}
          disabled={busy}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <FileUp size={14} />
          Import .ics file
        </button>
        <small>A one-time snapshot; import again to refresh.</small>
      </div>
      {error && (
        <p className="calendar-feed-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="calendar-feed-success" role="status">
          <Check size={13} />
          {success}
        </p>
      )}
      <div className="calendar-feed-privacy">
        <ShieldCheck size={15} />
        <p>
          Your private feed link acts like a password. It stays on your server,
          is never shown after saving, and should not be shared in chat.
          Calendar feeds are read-only and may refresh less frequently than your
          calendar app.
        </p>
      </div>
      <details className="calendar-feed-help">
        <summary>Where do I find my calendar link?</summary>
        <p>
          <strong>Google Calendar:</strong> On a computer, open Calendar →
          Settings → your calendar → Integrate calendar → Secret address in iCal
          format. This does not use Google Cloud or require a free trial.
        </p>
        <p>
          <strong>Apple Calendar:</strong> A public iCloud subscription link
          works, but making a calendar public shares its contents with anyone
          who has that link. For a private alternative, use File → Export →
          Export and import the .ics file here.
        </p>
        <p>
          <strong>Outlook:</strong> Settings → Calendar → Shared calendars →
          Publish a calendar → copy the ICS link. Only publish details you
          intend to share.
        </p>
      </details>
    </section>
  );
}
