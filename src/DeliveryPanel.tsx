import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowUpRight,
  Bike,
  Check,
  Clock3,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import "./delivery.css";

const DELIVERY_KEY = "orbit-delivery-v3";
const statuses = ["ordered", "preparing", "on-the-way", "delivered"] as const;
type DeliveryStatus = (typeof statuses)[number];
type Delivery = {
  label: string;
  url: string;
  status: DeliveryStatus;
  eta: string;
  updatedAt: string;
};
const labels: Record<DeliveryStatus, string> = {
  ordered: "Ordered",
  preparing: "Preparing",
  "on-the-way": "On the way",
  delivered: "Delivered",
};

/** A consumer tracking link stays in this browser; it is never sent to Orbit's API. */
export function normalizeDoorDashUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(
      "Paste the HTTPS tracking or order-page link from DoorDash.",
    );
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !(host === "doordash.com" || host.endsWith(".doordash.com"))
  ) {
    throw new Error(
      "Use a secure doordash.com order link without a username, password, or custom port.",
    );
  }
  if (url.href.length > 4096)
    throw new Error(
      "That link is too long. Copy the order-page link directly from DoorDash.",
    );
  return url.href;
}
function savedDelivery(): Delivery | null {
  try {
    const data: unknown = JSON.parse(
      localStorage.getItem(DELIVERY_KEY) || "null",
    );
    if (!data || typeof data !== "object") return null;
    const item = data as Partial<Delivery>;
    if (
      typeof item.label !== "string" ||
      !item.label.trim() ||
      item.label.length > 100 ||
      typeof item.url !== "string" ||
      !statuses.includes(item.status as DeliveryStatus) ||
      typeof item.eta !== "string" ||
      (item.eta && !Number.isFinite(new Date(item.eta).getTime())) ||
      typeof item.updatedAt !== "string" ||
      !Number.isFinite(new Date(item.updatedAt).getTime())
    )
      return null;
    return {
      label: item.label,
      url: normalizeDoorDashUrl(item.url),
      status: item.status as DeliveryStatus,
      eta: item.eta,
      updatedAt: item.updatedAt,
    };
  } catch {
    return null;
  }
}
function localDateTime(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function remaining(eta: string, now: number): string {
  if (!eta) return "Add your estimated arrival";
  const minutes = Math.ceil((new Date(eta).getTime() - now) / 60000);
  if (minutes <= 0) return "Past your estimate — check DoorDash";
  if (minutes === 1) return "About 1 minute to your estimate";
  if (minutes < 60) return `About ${minutes} minutes to your estimate`;
  const hours = Math.floor(minutes / 60),
    rest = minutes % 60;
  return `About ${hours}h${rest ? ` ${rest}m` : ""} to your estimate`;
}

export default function DeliveryPanel() {
  const [delivery, setDelivery] = useState<Delivery | null>(savedDelivery);
  const [editor, setEditor] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<DeliveryStatus>("ordered");
  const [eta, setEta] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const dialog = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    setEditor(false);
    setConfirmClear(false);
    setError("");
    setUrl("");
  }, []);

  useEffect(() => {
    if (!delivery || delivery.status === "delivered") return;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [delivery]);
  useEffect(() => {
    const update = () => setDelivery(savedDelivery());
    const storage = (event: StorageEvent) => {
      if (event.key === DELIVERY_KEY || event.key === null) update();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("orbit-delivery-change", update);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("orbit-delivery-change", update);
    };
  }, []);
  useEffect(() => {
    if (!editor && !confirmClear) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>("input,button")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key === "Tab") {
        const controls = dialog.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]",
        );
        if (!controls?.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      previous?.focus();
    };
  }, [editor, confirmClear, close]);

  function persist(next: Delivery | null): boolean {
    try {
      if (next) localStorage.setItem(DELIVERY_KEY, JSON.stringify(next));
      else localStorage.removeItem(DELIVERY_KEY);
      setDelivery(next);
      setNow(Date.now());
      setError("");
      window.dispatchEvent(new Event("orbit-delivery-change"));
      return true;
    } catch {
      setError(
        "This browser couldn’t save your delivery. Free up site storage or allow local storage, then try again.",
      );
      return false;
    }
  }
  function openEditor() {
    setLabel(delivery?.label || "");
    setUrl(delivery?.url || "");
    setStatus(delivery?.status || "ordered");
    setEta(localDateTime(delivery?.eta || ""));
    setError("");
    setEditor(true);
  }
  function save(event: FormEvent) {
    event.preventDefault();
    try {
      const cleanLabel = label.replace(/[\u0000-\u001f\u007f]/g, "").trim();
      if (!cleanLabel || cleanLabel.length > 100)
        throw new Error(
          "Give the delivery a restaurant or order label, up to 100 characters.",
        );
      const cleanUrl = normalizeDoorDashUrl(url);
      const etaDate = eta ? new Date(eta) : null;
      if (etaDate && !Number.isFinite(etaDate.getTime()))
        throw new Error(
          "Choose a valid estimated date and time, or leave it blank.",
        );
      if (etaDate && etaDate.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000)
        throw new Error(
          "Choose an arrival estimate within the next seven days.",
        );
      if (
        persist({
          label: cleanLabel,
          url: cleanUrl,
          status,
          eta: etaDate?.toISOString() || "",
          updatedAt: new Date().toISOString(),
        })
      )
        close();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This delivery could not be saved. Please check the details.",
      );
    }
  }
  const stage = delivery ? statuses.indexOf(delivery.status) : -1;
  const stale =
    delivery &&
    now - new Date(delivery.updatedAt).getTime() > 24 * 60 * 60 * 1000;

  return (
    <section className="card delivery-card" aria-label="Tonight’s delivery">
      <div className="delivery-card-heading">
        <h2>
          <ShoppingBag size={18} />
          Dinner, in your orbit
        </h2>
        <span className="delivery-manual-badge">Manual status</span>
      </div>
      {delivery ? (
        <>
          <div className="delivery-order">
            <span
              className={`delivery-order-icon ${delivery.status === "delivered" ? "complete" : ""}`}
            >
              {delivery.status === "delivered" ? (
                <Check size={23} />
              ) : delivery.status === "on-the-way" ? (
                <Bike size={23} />
              ) : (
                <Utensils size={22} />
              )}
            </span>
            <div>
              <h3>{delivery.label}</h3>
              <p>
                {labels[delivery.status]}
                <span>· Updated by you</span>
              </p>
            </div>
            <button
              type="button"
              className="delivery-icon-button"
              aria-label="Edit delivery"
              onClick={openEditor}
            >
              <Pencil size={16} />
            </button>
          </div>
          <div
            className="delivery-stages"
            aria-label="Update manual delivery status"
          >
            {statuses.map((value, index) => (
              <button
                key={value}
                type="button"
                className={index <= stage ? "reached" : ""}
                aria-pressed={delivery.status === value}
                aria-label={`Set status ${labels[value]}`}
                onClick={() =>
                  persist({
                    ...delivery,
                    status: value,
                    updatedAt: new Date().toISOString(),
                  })
                }
              >
                <i>
                  {index < stage ||
                  (index === stage && value === "delivered") ? (
                    <Check size={9} />
                  ) : null}
                </i>
                <span>{labels[value]}</span>
              </button>
            ))}
          </div>
          {delivery.status !== "delivered" && (
            <div className="delivery-estimate">
              <Clock3 size={15} />
              <div>
                <strong>{remaining(delivery.eta, now)}</strong>
                <span>
                  {delivery.eta
                    ? `Your estimate: ${new Date(delivery.eta).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                    : "An estimate you enter, not DoorDash’s live ETA."}
                </span>
              </div>
            </div>
          )}
          {stale && (
            <p className="delivery-stale">
              This is a saved order from an earlier day. Check DoorDash before
              relying on its status.
            </p>
          )}
          <a
            className="delivery-tracking-link"
            href={delivery.url}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            Open live tracking in DoorDash <ArrowUpRight size={15} />
          </a>
          <div className="delivery-footer">
            <span>
              <MapPin size={11} />
              Live map opens in DoorDash
            </span>
            <button
              type="button"
              onClick={() => {
                setError("");
                setConfirmClear(true);
              }}
            >
              <Trash2 size={12} />
              Clear order
            </button>
          </div>
        </>
      ) : (
        <div className="delivery-empty">
          <span className="delivery-empty-icon">
            <Bike size={24} />
          </span>
          <div>
            <h3>A movie. A good meal. A little downtime.</h3>
            <p>
              Keep tonight’s order link and your arrival estimate beside your
              watch list.
            </p>
            <button
              type="button"
              className="delivery-add-button"
              onClick={openEditor}
            >
              <Plus size={14} />
              Add DoorDash tracking <ArrowUpRight size={13} />
            </button>
          </div>
        </div>
      )}
      <p className="delivery-privacy">
        DoorDash isn’t connected to Orbit. Status and arrival estimates are
        entered by you; no automatic order updates.
      </p>
      {error && !editor && !confirmClear && (
        <p role="alert" className="delivery-error">
          {error}
        </p>
      )}
      {(editor || confirmClear) && (
        <div className="delivery-dialog-backdrop" onClick={close}>
          <div
            className="delivery-dialog"
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label={
              confirmClear ? "Clear saved delivery" : "Tonight’s delivery"
            }
            onClick={(event) => event.stopPropagation()}
          >
            <div className="delivery-dialog-heading">
              <div>
                <span>DINNER & A MOVIE</span>
                <h2>
                  {confirmClear
                    ? "Clear this saved order?"
                    : "Tonight’s delivery"}
                </h2>
              </div>
              <button
                type="button"
                className="delivery-icon-button"
                aria-label="Close delivery dialog"
                onClick={close}
              >
                <X size={20} />
              </button>
            </div>
            {confirmClear ? (
              <>
                <p className="delivery-dialog-intro">
                  This removes the saved tracking link and manual status from
                  this browser. It won’t cancel or change your DoorDash order.
                </p>
                <div className="delivery-confirm-actions">
                  <button type="button" onClick={close}>
                    Keep order
                  </button>
                  <button
                    type="button"
                    className="delivery-clear-confirm"
                    onClick={() => {
                      if (persist(null)) close();
                    }}
                  >
                    Clear saved order
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="delivery-dialog-intro">
                  Copy your order or tracking page’s HTTPS link from DoorDash.
                  Orbit keeps the link on this device and opens the live map in
                  DoorDash.
                </p>
                <form className="delivery-form" onSubmit={save}>
                  <label>
                    Restaurant or order label
                    <input
                      aria-label="Restaurant or order label"
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      placeholder="Tonight’s dinner"
                      maxLength={100}
                      required
                    />
                  </label>
                  <label>
                    DoorDash tracking link
                    <input
                      aria-label="DoorDash tracking link"
                      type="password"
                      autoComplete="off"
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      placeholder="https://www.doordash.com/…"
                      maxLength={4096}
                      spellCheck={false}
                      required
                    />
                    <small>
                      A private link can reveal your order. Don’t share it in
                      chat.
                    </small>
                  </label>
                  <div className="delivery-form-row">
                    <label>
                      Delivery status
                      <select
                        aria-label="Delivery status"
                        value={status}
                        onChange={(event) =>
                          setStatus(event.target.value as DeliveryStatus)
                        }
                      >
                        {statuses.map((value) => (
                          <option key={value} value={value}>
                            {labels[value]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Estimated arrival
                      <input
                        aria-label="Estimated arrival"
                        type="datetime-local"
                        value={eta}
                        onChange={(event) => setEta(event.target.value)}
                      />
                      <small>Optional. Your local date and time.</small>
                    </label>
                  </div>
                  {error && (
                    <p role="alert" className="delivery-error">
                      {error}
                    </p>
                  )}
                  <div className="delivery-form-note">
                    <ExternalLink size={15} />
                    <p>
                      There’s no automatic account connection here. Update the
                      stage yourself and open DoorDash for its live driver
                      location and ETA.
                    </p>
                  </div>
                  <button type="submit" className="delivery-save-button">
                    Save delivery <Check size={14} />
                  </button>
                </form>
              </>
            )}
            {confirmClear && error && (
              <p role="alert" className="delivery-error">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
