import { useRef, useState } from "react";
import {
  ArchiveRestore,
  Check,
  Download,
  FileJson,
  FolderLock,
  LoaderCircle,
  Upload,
  X,
} from "lucide-react";
import type { DashboardBackup } from "./backup";
import {
  applyBackup,
  createBackup,
  MAX_BACKUP_BYTES,
  parseBackup,
  previewBackup,
} from "./backup";
import "./backup.css";

export default function BackupPanel() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<DashboardBackup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const summary = pending ? previewBackup(pending) : null;
  const exportData = () => {
    setError("");
    setSuccess("");
    try {
      const backup = createBackup(localStorage);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(backup, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `orbit-dashboard-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSuccess("Backup prepared for download. Store it somewhere private.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t export this browser’s dashboard data.",
      );
    }
  };
  const inspectFile = async (file: File | undefined) => {
    setError("");
    setSuccess("");
    setPending(null);
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setError("Choose an Orbit backup smaller than 2 MiB.");
      return;
    }
    setBusy(true);
    try {
      setPending(parseBackup(await file.text()));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This backup could not be read.",
      );
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const restore = () => {
    if (!pending || busy) return;
    setBusy(true);
    setError("");
    try {
      applyBackup(pending, localStorage);
      setSuccess("Backup restored. Reloading your dashboard…");
      window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The backup could not be restored.",
      );
      setBusy(false);
    }
  };
  return (
    <section className="backup-panel" aria-label="Dashboard backup and restore">
      <div className="backup-heading">
        <span>
          <FolderLock size={20} />
        </span>
        <div>
          <h3>A little peace of mind.</h3>
          <p>
            Back up your tasks, life goals, notes, conversations, and
            preferences, Education Center records, and focus history.
          </p>
        </div>
      </div>
      <div className="backup-boundary">
        <FileJson size={15} />
        <p>
          Downloads contain your private dashboard text. Account credentials,
          calendar links, delivery tracking links, and media-library files or
          metadata are excluded.
        </p>
      </div>
      <div className="backup-actions">
        <button type="button" onClick={exportData} disabled={busy}>
          <Download size={14} />
          Export dashboard
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
        >
          {busy ? (
            <LoaderCircle size={14} className="spin" />
          ) : (
            <Upload size={14} />
          )}
          Choose backup
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          aria-label="Choose dashboard backup file"
          onChange={(event) => void inspectFile(event.target.files?.[0])}
        />
      </div>
      {pending && summary && (
        <div className="backup-preview">
          <div className="backup-preview-heading">
            <span>
              <ArchiveRestore size={15} />
              Review before restoring
            </span>
            <button
              type="button"
              aria-label="Cancel backup restore"
              onClick={() => setPending(null)}
              disabled={busy}
            >
              <X size={15} />
            </button>
          </div>
          <p>
            Backup from{" "}
            {new Date(pending.createdAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            .
          </p>
          <dl>
            <div>
              <dt>Education records</dt>
              <dd>{summary.educationCount}</dd>
            </div>
            <div>
              <dt>Focus sessions</dt>
              <dd>{summary.focusCount}</dd>
            </div>
            <div>
              <dt>Tasks</dt>
              <dd>{summary.taskCount}</dd>
            </div>
            <div>
              <dt>Messages</dt>
              <dd>{summary.messageCount}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{summary.hasNotes ? "Included" : "Not included"}</dd>
            </div>
            <div>
              <dt>Weather</dt>
              <dd>{summary.weatherLocation || "Not included"}</dd>
            </div>
            <div>
              <dt>Life entries</dt>
              <dd>{summary.entryCount}</dd>
            </div>
            <div>
              <dt>Pending proposals</dt>
              <dd>{summary.proposalCount}</dd>
            </div>
          </dl>
          <p className="backup-confirm-copy">
            Restoring replaces only the {summary.settingsCount} saved dashboard
            sections in this file. Your other browser data and connected-account
            sessions stay in place. The dashboard reloads afterward.
          </p>
          <button
            type="button"
            className="backup-restore-button"
            onClick={restore}
            disabled={busy}
          >
            {busy ? (
              <LoaderCircle size={14} className="spin" />
            ) : (
              <ArchiveRestore size={14} />
            )}
            Replace included data & restore
          </button>
        </div>
      )}
      {error && (
        <p className="backup-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="backup-success" role="status">
          <Check size={14} />
          {success}
        </p>
      )}
    </section>
  );
}
