import { describe, it, expect } from "vitest";
import {
  parseRegistry, currentSnapshot, isSpecTimestamp, unorderableKeys,
  nextVersion, applyUpdate, prefillFrom, prefillAll, detectNftShape,
} from "../src/updateBcmr";
import { generateBcmr } from "../src/generateBcmr";
import type { DetailsObj } from "../src/interfaces/interfaces";
import type { Registry } from "../src/interfaces/bcmr-v2.schema";

/* eslint-disable @typescript-eslint/no-explicit-any */

const A = "a".repeat(64);
const B = "b".repeat(64);
const NOW = "2026-09-09T12:00:00.000Z";

/** a registry carrying plenty this app does not model, which an update must not drop */
function existing(): any {
  return {
    $schema: "https://cashtokens.org/bcmr-v2.schema.json",
    version: { major: 1, minor: 4, patch: 2 },
    latestRevision: "2026-01-01T00:00:00.000Z",
    registryIdentity: { name: "ACME Registry", description: "kept" },
    license: "CC0-1.0",
    tags: { collectable: { name: "Collectable" } },
    locales: { es: { identities: {} } },
    extensions: { custom: "kept" },
    identities: {
      [A]: {
        "2025-01-01T00:00:00.000Z": { name: "Old", description: "first" },
        "2026-01-01T00:00:00.000Z": {
          name: "DogeCash",
          description: "current",
          tags: ["collectable"],
          token: {
            category: A, symbol: "DOGE", decimals: 2,
            nfts: { description: "kept", parse: { types: { "": { name: "#0" } } } },
          },
          uris: { icon: "https://old.example/i.png", web: "https://old.example", twitter: "https://x.com/old" },
          extensions: { snapshotExt: "kept" },
        },
      },
      [B]: { "2026-01-01T00:00:00.000Z": { name: "Other identity", description: "untouched" } },
    },
  };
}

function loaded(): Registry {
  const parsed = parseRegistry(JSON.stringify(existing()));
  if ("error" in parsed) throw new Error(parsed.error);
  return parsed.registry;
}

/** what the form would generate for identity A, with the icon deliberately left blank */
function fresh(over: Partial<DetailsObj> = {}): Registry {
  return generateBcmr({
    date: NOW,
    registryIdentityName: "ignored", registryIdentityDescription: "ignored",
    registryIdentityAuthbase: "", hasToken: true,
    tokenId: A, tokenName: "DogeCash v2", tokenDescription: "updated",
    tokenSymbol: "DOGE", iconUri: "", tokenDecimals: "",
    hasNftFields: false, nftCollectionDescription: "", numberNFTs: "",
    numbering: "vm-numbers", startingNumber: "1", commitmentOffset: "",
    nftName: "", nftDescription: "", nftIconUri: "", nftIconType: "png",
    hasNftImages: false, webUrl: "https://new.example", listLinks: [],
    ...over,
  });
}

describe("parsing a registry", () => {
  it("accepts one it can update", () => {
    expect(parseRegistry(JSON.stringify(existing()))).toHaveProperty("registry");
  });

  it("rejects text that is not json", () => {
    expect(parseRegistry("{nope")).toHaveProperty("error");
  });

  it("rejects a missing version, which it has to bump", () => {
    expect(parseRegistry(JSON.stringify({ latestRevision: NOW }))).toHaveProperty("error");
  });

  it("rejects a missing latestRevision", () => {
    expect(parseRegistry(JSON.stringify({ version: { major: 1, minor: 0, patch: 0 } }))).toHaveProperty("error");
  });
});

describe("spec timestamps", () => {
  it("accepts the exact 24 character form", () => {
    expect(isSpecTimestamp("2026-01-01T00:00:00.000Z")).toBe(true);
  });

  it("rejects shapes that would sort wrong", () => {
    expect(isSpecTimestamp("2026-1-05T00:00:00.000Z")).toBe(false);
    expect(isSpecTimestamp("2026-01-01")).toBe(false);
    expect(isSpecTimestamp("2026-01-01T00:00:00Z")).toBe(false);
  });

  it("rejects an impossible date the shape allows", () => {
    expect(isSpecTimestamp("2026-13-01T00:00:00.000Z")).toBe(false);
  });
});

describe("choosing the current snapshot", () => {
  it("takes the latest one not after now", () => {
    const history: any = {
      "2025-01-01T00:00:00.000Z": { name: "old" },
      "2026-01-01T00:00:00.000Z": { name: "current" },
      "2027-01-01T00:00:00.000Z": { name: "future" },
    };
    expect(currentSnapshot(history, NOW)?.name).toBe("current");
  });

  it("leaves a key that cannot be ordered out of the decision", () => {
    // "2026-1-05..." sorts after "2026-01-01..." yet is still <= now, so the old code
    // picked it and merged onto the wrong snapshot
    const history: any = {
      "2026-01-01T00:00:00.000Z": { name: "current" },
      "2026-1-05T00:00:00.000Z": { name: "malformed" },
    };
    expect(currentSnapshot(history, "2026-11-01T00:00:00.000Z")?.name).toBe("current");
    expect(unorderableKeys(history)).toEqual(["2026-1-05T00:00:00.000Z"]);
  });

  it("has nothing to return when every key is unusable", () => {
    expect(currentSnapshot({ latest: { name: "x" } } as any, NOW)).toBeUndefined();
  });
});

describe("the version bump", () => {
  it("adds a snapshot, so minor rises and patch resets", () => {
    expect(nextVersion(loaded())).toEqual({ major: 1, minor: 5, patch: 0 });
  });
});

describe("applying an update", () => {
  const base = loaded();
  const version = nextVersion(base);
  const out = applyUpdate(base, fresh(), A, NOW, version) as any;
  const snapshot = out.identities[A][NOW];

  it("adds a snapshot rather than replacing the history", () => {
    expect(Object.keys(out.identities[A])).toHaveLength(3);
    expect(out.identities[A]["2025-01-01T00:00:00.000Z"].name).toBe("Old");
  });

  it("leaves identities it was not pointed at alone", () => {
    expect(out.identities[B]["2026-01-01T00:00:00.000Z"].name).toBe("Other identity");
  });

  it("carries through registry fields the form does not model", () => {
    expect(out.tags.collectable.name).toBe("Collectable");
    expect(out.locales.es).toBeDefined();
    expect(out.license).toBe("CC0-1.0");
    expect(out.extensions.custom).toBe("kept");
  });

  it("carries through snapshot fields the form does not model", () => {
    expect(snapshot.tags).toEqual(["collectable"]);
    expect(snapshot.extensions.snapshotExt).toBe("kept");
    expect(snapshot.token.nfts.parse.types[""].name).toBe("#0");
  });

  it("takes the new values the form does model", () => {
    expect(snapshot.name).toBe("DogeCash v2");
    expect(snapshot.uris.web).toBe("https://new.example");
  });

  it("treats an empty field as leave alone, not erase", () => {
    expect(snapshot.uris.icon).toBe("https://old.example/i.png");
    expect(snapshot.token.decimals).toBe(2);
  });

  it("keeps a uri the form has no field for", () => {
    expect(snapshot.uris.twitter).toBe("https://x.com/old");
  });

  it("sets the revision and the version it was given", () => {
    expect(out.latestRevision).toBe(NOW);
    expect(out.version).toEqual({ major: 1, minor: 5, patch: 0 });
  });

  it("adds an identity the file did not have", () => {
    const C = "c".repeat(64);
    const added = applyUpdate(base, fresh({ tokenId: C, tokenName: "New" }), C, NOW, version) as any;
    expect(added.identities[C][NOW].name).toBe("New");
    expect(Object.keys(added.identities)).toHaveLength(3);
  });
});

describe("prefilling from a loaded registry", () => {
  const base = loaded();

  it("reads the current snapshot of the first identity", () => {
    const prefill = prefillFrom(base, NOW);
    expect(prefill?.name).toBe("DogeCash");
    expect(prefill?.decimals).toBe("2");
    expect(prefill?.hasToken).toBe(true);
  });

  it("separates the uris the form has fields for from the rest", () => {
    const prefill = prefillFrom(base, NOW);
    expect(prefill?.iconUri).toBe("https://old.example/i.png");
    expect(prefill?.listLinks).toEqual([["twitter", "https://x.com/old"]]);
  });

  it("returns one per identity, in the order the registry lists them", () => {
    expect(prefillAll(base, NOW).map((p) => p.authbase)).toEqual([A, B]);
  });

  it("reports an identity that carries no token", () => {
    expect(prefillAll(base, NOW)[1].hasToken).toBe(false);
  });
});

describe("detecting how a collection is numbered", () => {
  it("reads vm-numbers once a value needs more than one byte", () => {
    const shape = detectNftShape({ "": {}, "01": {}, "8000": {} })!;
    expect(shape.numbering).toBe("vm-numbers");
    expect(shape.ambiguous).toBe(false);
  });

  it("reads hex when a bare byte is too large to be a vm number", () => {
    expect(detectNftShape({ "01": {}, "80": {}, "ff": {} })!.numbering).toBe("hex");
  });

  it("calls a short run ambiguous, since both schemes agree there", () => {
    expect(detectNftShape({ "01": {}, "02": {}, "03": {} })!.ambiguous).toBe(true);
  });

  it("reads the range and the count", () => {
    const shape = detectNftShape({ "01": {}, "02": {}, "03": {} })!;
    expect([shape.first, shape.last, shape.count]).toEqual([1, 3, 3]);
    expect(shape.contiguous).toBe(true);
  });

  it("derives the offset when every name agrees on it", () => {
    const types = {
      "": { name: "item 1" },
      "01": { name: "item 2" },
      "02": { name: "item 3" },
    };
    expect(detectNftShape(types)!.offset).toBe(-1);
  });

  it("declines to guess an offset when the names disagree", () => {
    const types = { "01": { name: "series one #1" }, "65": { name: "series two #1" } };
    expect(detectNftShape(types)!.offset).toBeNull();
  });

  it("flags a collection whose numbers skip, which this app cannot reproduce", () => {
    const shape = detectNftShape({ "01": {}, "02": {}, "28": {} })!;
    expect(shape.contiguous).toBe(false);
    expect([shape.first, shape.last, shape.count]).toEqual([1, 40, 3]);
  });

  it("has nothing to report for an empty collection", () => {
    expect(detectNftShape({})).toBeUndefined();
  });
});
