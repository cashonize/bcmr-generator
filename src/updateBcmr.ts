
import { hexToBin, vmNumberToBigInt } from "@bitauth/libauth";
import type { Registry, IdentitySnapshot, IdentityHistory } from "./interfaces/bcmr-v2.schema.js";

/**
 * Updating an existing registry, rather than writing a fresh one.
 *
 * The rule everything here follows: anything this app does not model is carried
 * through untouched. A registry may hold tags, locales, chains, extensions,
 * other identities and older snapshots, and an update that dropped any of them
 * would be published on-chain by its hash before anyone noticed.
 */

export type ParseResult = { registry: Registry } | { error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validated only as far as this file writes to it. Everything else is passed
 * through, so a stricter check here would reject registries we can update fine.
 */
export function parseRegistry(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: "That is not valid JSON." };
  }
  if (!isPlainObject(parsed)) return { error: "A registry must be a JSON object." };

  const version = parsed.version;
  if (!isPlainObject(version) || ["major", "minor", "patch"].some((k) => typeof version[k] !== "number")) {
    return { error: "Missing a version with numeric major, minor and patch." };
  }
  if (typeof parsed.latestRevision !== "string") {
    return { error: "Missing latestRevision." };
  }
  if (parsed.identities !== undefined && !isPlainObject(parsed.identities)) {
    return { error: "identities must be an object keyed by authbase." };
  }
  for (const history of Object.values(parsed.identities ?? {})) {
    if (!isPlainObject(history)) return { error: "Each identity must be an object keyed by timestamp." };
  }
  return { registry: parsed as unknown as Registry };
}

/**
 * The spec's timestamp: exactly what Date.toISOString() produces. The regex fixes the
 * shape and Date.parse rejects an impossible date the shape allows, like month 13.
 */
const SPEC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isSpecTimestamp(key: string): boolean {
  return SPEC_TIMESTAMP.test(key) && !Number.isNaN(Date.parse(key))
}

/** Snapshot keys that cannot be ordered, so cannot be reasoned about below. */
export function unorderableKeys(history: IdentityHistory): string[] {
  return Object.keys(history).filter((k) => !isSpecTimestamp(k))
}

/**
 * The spec's current snapshot: the latest one not after now. Sorting relies on ISO
 * timestamps ordering chronologically, which only holds for the exact zero-padded form, so
 * a key not in that form is left out of the ordering rather than sorting into the wrong
 * place. Those keys are still carried through to the output untouched.
 */
export function currentSnapshot(history: IdentityHistory, now: string): IdentitySnapshot | undefined {
  const key = Object.keys(history).filter((k) => isSpecTimestamp(k) && k <= now).sort().pop();
  return key ? history[key] : undefined;
}

/** generateBcmr always writes icon and web, empty string included; an empty one must not erase a real one. */
function withoutEmpty(uris: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(uris ?? {}).filter(([, value]) => value !== ""));
}

/**
 * The new snapshot starts from the previous one, so fields the form does not
 * model (tags, migrated, extensions, an existing nfts block) survive, and the
 * form overwrites only what it owns.
 */
function mergeSnapshot(prev: IdentitySnapshot, fresh: IdentitySnapshot): IdentitySnapshot {
  const merged: IdentitySnapshot = { ...prev, ...fresh };
  if (prev.token ?? fresh.token) {
    merged.token = { ...prev.token, ...fresh.token } as IdentitySnapshot["token"];
  }
  const uris = { ...prev.uris, ...withoutEmpty(fresh.uris) };
  if (Object.keys(uris).length) merged.uris = uris;
  return merged;
}

/**
 * The spec's rule for what this app does: adding a snapshot is a minor, which
 * resets the patch. Offered as the default rather than applied silently, since a
 * change this app cannot see, an identity removed by hand, is a major.
 */
export function nextVersion(base: Registry): Registry["version"] {
  return { major: base.version.major, minor: base.version.minor + 1, patch: 0 };
}

/**
 * Adds the generated snapshot to the loaded registry under `date`, keeping every
 * identity and every earlier snapshot.
 */
export function applyUpdate(
  base: Registry,
  fresh: Registry,
  authbase: string,
  date: string,
  version: Registry["version"],
): Registry {
  const freshSnapshot = fresh.identities?.[authbase]?.[date];
  if (!freshSnapshot) throw new Error("Error in generated snapshot");

  const prevHistory: IdentityHistory = base.identities?.[authbase] ?? {};
  const prev = currentSnapshot(prevHistory, date);

  return {
    ...base,
    version,
    latestRevision: date,
    identities: {
      ...base.identities,
      [authbase]: { ...prevHistory, [date]: prev ? mergeSnapshot(prev, freshSnapshot) : freshSnapshot },
    },
  };
}

export interface Prefill {
  authbase: string;
  identityCount: number;
  snapshotCount: number;
  name: string;
  description: string;
  symbol: string;
  decimals: string;
  iconUri: string;
  webUrl: string;
  listLinks: [string, string][];
  keepsNfts: boolean;
  /** whether the identity being updated already carries a token, which cannot be undone */
  hasToken: boolean;
  /** how its existing NFT collection is numbered, so extending it can match */
  nftShape?: NftShape;
  /** snapshots whose key is not a spec timestamp, so left out of the ordering */
  unorderable: number;
}

/**
 * Fills the form from the identity's current snapshot. The first identity is the
 * starting point; editing the TokenId field aims the update at another one, and
 * the rest are kept either way.
 */
export function prefillFrom(registry: Registry, now: string, authbase?: string): Prefill | undefined {
  authbase ??= Object.keys(registry.identities ?? {})[0];
  if (!authbase) return undefined;
  const history = registry.identities?.[authbase] ?? {};
  const snapshot = currentSnapshot(history, now);
  if (!snapshot) return undefined;

  const uris = snapshot.uris ?? {};
  return {
    authbase,
    identityCount: Object.keys(registry.identities ?? {}).length,
    snapshotCount: Object.keys(history).length,
    name: snapshot.name ?? "",
    description: snapshot.description ?? "",
    symbol: snapshot.token?.symbol ?? "",
    decimals: snapshot.token?.decimals !== undefined ? String(snapshot.token.decimals) : "",
    iconUri: uris.icon ?? "",
    webUrl: uris.web ?? "",
    listLinks: Object.entries(uris).filter(([key]) => key !== "icon" && key !== "web"),
    keepsNfts: Boolean(snapshot.token?.nfts),
    hasToken: Boolean(snapshot.token),
    nftShape: snapshot.token?.nfts ? detectNftShape(snapshot.token.nfts.parse.types) : undefined,
    unorderable: unorderableKeys(history).length,
  };
}

/** One prefill per identity in the file, in the order the registry lists them. */
export function prefillAll(registry: Registry, now: string): Prefill[] {
  return Object.keys(registry.identities ?? {})
    .map((authbase) => prefillFrom(registry, now, authbase))
    .filter((p): p is Prefill => p !== undefined)
}

/**
 * What an existing NFT collection was numbered with, so extending it does not silently
 * use different commitments than the ones already minted.
 *
 * `offset` is null when it cannot be derived: the names have to carry a number and the gap
 * between it and the commitment has to be the same for every entry.
 */
export interface NftShape {
  numbering: "vm-numbers" | "hex";
  /** true when both schemes would encode these numbers identically, so the choice is moot */
  ambiguous: boolean;
  first: number;
  last: number;
  count: number;
  /** false when the numbers skip, which this app cannot reproduce */
  contiguous: boolean;
  offset: number | null;
}

function decodeHex(key: string): number {
  return key === "" ? NaN : parseInt(key, 16)
}

function decodeVm(key: string): number {
  const value = vmNumberToBigInt(hexToBin(key));
  return typeof value === "bigint" ? Number(value) : NaN
}

export function detectNftShape(types: Record<string, { name?: string }>): NftShape | undefined {
  const keys = Object.keys(types);
  if (!keys.length) return undefined

  // A bare byte of 0x80 or more cannot be a VM number, which would append a 00 to keep it
  // positive, so it is big-endian hex. An empty commitment is VM zero, which hex writes 00.
  const mustBeHex = keys.some((k) => k.length === 2 && parseInt(k, 16) >= 0x80);
  const mustBeVm = keys.some((k) => k === "" || k.length > 2);
  const numbering: NftShape["numbering"] = mustBeHex && !mustBeVm ? "hex" : "vm-numbers";
  const ambiguous = !mustBeHex && !mustBeVm;

  const decode = numbering === "hex" ? decodeHex : decodeVm;
  const numbers = keys.map(decode);
  if (numbers.some((n) => Number.isNaN(n))) return undefined
  numbers.sort((a, b) => a - b);

  const first = numbers[0];
  const last = numbers[numbers.length - 1];

  // the same gap between every name's number and its commitment, or nothing
  let offset: number | null = null;
  const gaps = keys.map((key) => {
    const digits = types[key].name?.match(/(\d+)(?!.*\d)/);
    if (!digits) return null
    return decode(key) - Number(digits[1])
  });
  if (gaps.every((g) => g !== null) && new Set(gaps).size === 1) offset = gaps[0] as number;

  return {
    numbering, ambiguous, first, last,
    count: numbers.length,
    contiguous: numbers.length === last - first + 1,
    offset,
  }
}
