/**
 * Encode a string as utf-8.
 * @param {string | Uint8Array} v The string to encode
 */
export function encode(v: string | Uint8Array): Uint8Array {
  if (typeof v !== "string") return v;
  return new TextEncoder().encode(v);
}
/**
 * Decodes a Uint8Array into a string
 * @param {Uint8Array} v The Uint8Array to decode
 */
export function decode(v: Uint8Array): string {
  return new TextDecoder().decode(v);
}
/**
 * Reads a pointer from a pointer array
 * @param v The pointer object
 */
export function readPointer(v: Deno.PointerValue): Uint8Array {
  const ptr = new Deno.UnsafePointerView(
    v as unknown as NonNullable<Deno.PointerValue>,
  );
  const lengthBe = new Uint8Array(4);
  const view = new DataView(lengthBe.buffer);
  ptr.copyInto(lengthBe, 0);
  const buf = new Uint8Array(view.getUint32(0));
  ptr.copyInto(buf, 4);
  return buf;
}

//Add a suite of IP parsing utilities
export function parseIP(ip: string): string {
  if (ip.includes(":")) {
    return ip.split(":")[0];
  }
  return ip;
}

export function validIp(ip: string) {
  const regex =
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return regex.test(ip);
}
export function validPort(port: number) {
  const regex =
    /^([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/;
  return regex.test(port.toString());
}
export function validHostname(hostname: string) {
  const regex =
    /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;
  return regex.test(hostname);
}

export function validHostPort(host: string) {
  const [hostname, port] = host.split(":");
  if (!validHostname(hostname)) return false;
  if (!validPort(parseInt(port))) return false;
  return true;
}

export function isJson(str: string) {
  try {
    JSON.parse(str);
  } catch {
    return false;
  }
  return true;
}
