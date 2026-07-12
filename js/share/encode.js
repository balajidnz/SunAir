// @ts-check
/**
 * UTF-8-safe base64url codec for the shareable message in the URL hash.
 *
 * `btoa` throws on any character outside Latin-1, so a message containing an
 * emoji or Tamil text would crash the encoder. Everything here exists to make
 * that impossible.
 */

/** Longest hash we will even look at, before attempting to decode it. */
const MAX_HASH = 4000;

/** Message cap, in code points. Enforced on both encode and decode. */
export const MAX_MESSAGE = 280;

/**
 * @typedef {object} Payload
 * @property {1} v
 * @property {string} msg
 * @property {string} [from]
 * @property {string} [to]
 */

const toB64url = (/** @type {string} */ s) =>
  s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromB64url = (/** @type {string} */ s) =>
  s.replace(/-/g, '+').replace(/_/g, '/');

const LF = 10;           // newline — kept; the ending renders with `pre-wrap`
const SPACE = 32;
const DEL = 127;
const C1_END = 159;
const BIDI_FMT_LO = 0x202a; // LRE RLE PDF LRO RLO
const BIDI_FMT_HI = 0x202e;
const BIDI_ISO_LO = 0x2066; // LRI RLI FSI PDI
const BIDI_ISO_HI = 0x2069;

/**
 * Drop control characters and bidi overrides, then cap the length.
 *
 * Iterating code points (rather than regex + `.slice`) does two jobs at once:
 * it avoids source-level escape sequences, and it means the 280 cap can never
 * cut an emoji in half by splitting a surrogate pair.
 *
 * Bidi characters are stripped because a lone U+202E in the message would
 * reverse the rendering of the ending text.
 *
 * @param {string} s
 * @returns {string}
 */
function sanitize(s) {
  /** @type {string[]} */
  const out = [];

  for (const ch of s) {
    if (out.length >= MAX_MESSAGE) break;

    const c = /** @type {number} */ (ch.codePointAt(0));
    if (c === LF) { out.push(ch); continue; }
    if (c < SPACE) continue;
    if (c >= DEL && c <= C1_END) continue;
    if (c >= BIDI_FMT_LO && c <= BIDI_FMT_HI) continue;
    if (c >= BIDI_ISO_LO && c <= BIDI_ISO_HI) continue;

    out.push(ch);
  }

  return out.join('');
}

/**
 * @param {Payload} payload
 * @returns {string} base64url, safe to drop straight into a URL fragment
 */
export function encode(payload) {
  const clean = { ...payload, msg: sanitize(payload.msg) };
  const bytes = new TextEncoder().encode(JSON.stringify(clean));

  // Build the binary string with a loop, not spread: String.fromCharCode(...bytes)
  // overflows the call stack on long inputs.
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);

  return toB64url(btoa(bin));
}

/**
 * Decode a URL fragment back into a payload. Never throws — malformed, hostile
 * or oversized input yields null, and the caller falls back to the default
 * message.
 *
 * @param {string} hash e.g. `#m=abc123`, or the bare `abc123`
 * @returns {Payload | null}
 */
export function decode(hash) {
  try {
    if (!hash || hash.length > MAX_HASH) return null;

    const raw = hash.replace(/^#/, '');
    const m = /(?:^|&)m=([A-Za-z0-9\-_]+)/.exec(raw);
    if (!m) return null;

    const bin = atob(fromB64url(m[1]));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));

    // fatal:true so malformed UTF-8 throws rather than silently yielding U+FFFD.
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const obj = JSON.parse(json);

    if (obj?.v !== 1 || typeof obj.msg !== 'string') return null;

    // Re-sanitize after decode. The URL is attacker-controlled; never trust
    // that it was produced by our own encoder.
    return {
      v: 1,
      msg: sanitize(obj.msg),
      ...(typeof obj.from === 'string' ? { from: sanitize(obj.from) } : {}),
      ...(typeof obj.to === 'string' ? { to: sanitize(obj.to) } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * @param {string} msg
 * @param {{from?: string, to?: string}} [who]
 * @returns {string} the full shareable URL
 */
export function buildLink(msg, who = {}) {
  const base = location.origin + location.pathname;
  return `${base}#m=${encode({ v: 1, msg, ...who })}`;
}
