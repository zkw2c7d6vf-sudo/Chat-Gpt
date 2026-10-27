import { useEffect, useRef } from "react";
export function useDialogFocus(open: boolean, close: () => void) {
  const ref = useRef<HTMLElement>(null),
    callback = useRef(close);
  callback.current = close;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement;
    ref.current
      ?.querySelector<HTMLElement>("input,button,textarea,select")
      ?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") callback.current();
      if (event.key !== "Tab") return;
      const controls = [
        ...(ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
        ) || []),
      ].filter((element) => element.getClientRects().length);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [open]);
  return ref;
}
