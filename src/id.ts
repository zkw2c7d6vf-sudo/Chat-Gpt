/** UUIDs for local record identity, including HTTP LAN origins without crypto.randomUUID. */
export function newId(): string {
  const provider = globalThis.crypto;
  if (typeof provider?.randomUUID === "function") return provider.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof provider?.getRandomValues === "function") provider.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
