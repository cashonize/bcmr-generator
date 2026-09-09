import { describe, it, expect } from "vitest";
import { generateBcmr, generateRegistry, nftCommitment, nftNumbers, nftEntry } from "../src/generateBcmr";
import type { DetailsObj } from "../src/interfaces/interfaces";

const DATE = "2026-09-09T12:00:00.000Z";
const ID = "a".repeat(64);

function details(over: Partial<DetailsObj> = {}): DetailsObj {
  return {
    date: DATE,
    registryIdentityName: "bcmr for ABC",
    registryIdentityDescription: "self-published bcmr for ABC",
    registryIdentityAuthbase: "",
    hasToken: true,
    tokenId: ID,
    tokenName: "ABC",
    tokenDescription: "a token",
    tokenSymbol: "ABC",
    iconUri: "https://example.com/icon.png",
    tokenDecimals: "2",
    hasNftFields: false,
    nftCollectionDescription: "",
    numberNFTs: "",
    numbering: "vm-numbers",
    startingNumber: "1",
    commitmentOffset: "",
    nftName: "",
    nftDescription: "",
    nftIconUri: "",
    nftIconType: "png",
    hasNftImages: false,
    webUrl: "https://example.com",
    listLinks: [],
    ...over,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** the snapshot generateBcmr writes for the single identity */
const snapshotOf = (d: DetailsObj): any => (generateBcmr(d) as any).identities[d.tokenId][DATE];

describe("the identity snapshot", () => {
  it("writes the token block for a token identity", () => {
    const token = snapshotOf(details()).token;
    expect(token.category).toBe(ID);
    expect(token.symbol).toBe("ABC");
    expect(token.decimals).toBe(2);
  });

  it("omits the token block entirely for a non-token identity", () => {
    expect(snapshotOf(details({ hasToken: false, tokenSymbol: "" }))).not.toHaveProperty("token");
  });

  it("keeps name, description and uris whether or not there is a token", () => {
    const snapshot = snapshotOf(details({ hasToken: false, tokenSymbol: "" }));
    expect(snapshot.name).toBe("ABC");
    expect(snapshot.uris.icon).toBe("https://example.com/icon.png");
  });

  it("leaves decimals out when the field is blank", () => {
    expect(snapshotOf(details({ tokenDecimals: "" })).token).not.toHaveProperty("decimals");
  });
});

describe("the registry's own identity", () => {
  it("is an inline object by default", () => {
    const registry = generateBcmr(details());
    expect(typeof registry.registryIdentity).toBe("object");
    expect(registry.registryIdentity).toMatchObject({ name: "bcmr for ABC" });
  });

  it("is the authbase string when one is given", () => {
    const authbase = "b".repeat(64);
    expect(generateBcmr(details({ registryIdentityAuthbase: authbase })).registryIdentity).toBe(authbase);
  });
});

describe("nft commitments", () => {
  it("encodes an NFT's own number, with no offset between them", () => {
    expect(nftCommitment(0, "vm-numbers")).toBe("");
    expect(nftCommitment(1, "vm-numbers")).toBe("01");
    expect(nftCommitment(500, "vm-numbers")).toBe("f401");
  });

  it("appends a byte where a bare one would read as negative", () => {
    expect(nftCommitment(128, "vm-numbers")).toBe("8000");
    expect(nftCommitment(127, "vm-numbers")).toBe("7f");
  });

  it("uses big-endian hex in the legacy scheme, for the same numbers", () => {
    expect(nftCommitment(1, "hex")).toBe("01");
    expect(nftCommitment(128, "hex")).toBe("80");
    expect(nftCommitment(500, "hex")).toBe("01f4");
  });
});

describe("nft numbering", () => {
  it("gives an NFT the same number on the chain as in its name", () => {
    const { display, vm } = nftNumbers(details({ startingNumber: "7" }), 3);
    expect(display).toBe(10);
    expect(vm).toBe(10);
  });

  it("shifts only the commitment when an offset is set", () => {
    const { display, vm } = nftNumbers(details({ startingNumber: "1", commitmentOffset: "-1" }), 0);
    expect(display).toBe(1);
    expect(vm).toBe(0);
  });

  it("keeps the offset when the starting number changes", () => {
    const gap = (start: string) => {
      const n = nftNumbers(details({ startingNumber: start, commitmentOffset: "-1" }), 0);
      return n.display - n.vm;
    };
    expect(gap("1")).toBe(1);
    expect(gap("10")).toBe(1);
  });
});

describe("one nft entry", () => {
  const collection = details({
    hasNftFields: true, numberNFTs: "3", startingNumber: "1",
    nftName: "item {i}", nftDescription: "number {i} of {i}",
    nftIconUri: "ipfs://folder", nftIconType: "png", hasNftImages: true,
  });

  it("substitutes every occurrence of the placeholder, not just the first", () => {
    expect(nftEntry(collection, 0).description).toBe("number 1 of 1");
  });

  it("derives both files from the NFT's number", () => {
    const entry = nftEntry(collection, 0);
    expect(entry.icon).toBe("ipfs://folder/1.png");
    expect(entry.image).toBe("ipfs://folder/1-img.png");
  });

  it("has no image at all when high-resolution images are off", () => {
    expect(nftEntry({ ...collection, hasNftImages: false }, 0).image).toBeUndefined();
  });

  it("agrees with what the generator writes, since the preview renders this", () => {
    const entry = nftEntry(collection, 0);
    const types = snapshotOf(collection).token.nfts.parse.types;
    expect(types[entry.commitment].name).toBe(entry.name);
    expect(types[entry.commitment].uris.icon).toBe(entry.icon);
    expect(types[entry.commitment].uris.image).toBe(entry.image);
  });

  it("uses the NFT's number for files and the offset one for commitments", () => {
    const entry = nftEntry({ ...collection, commitmentOffset: "-1" }, 0);
    expect(entry.name).toBe("item 1");
    expect(entry.icon).toBe("ipfs://folder/1.png");
    expect(entry.commitment).toBe("");
  });
});

describe("the nft collection", () => {
  const collection = details({
    hasNftFields: true, numberNFTs: "3", startingNumber: "1", nftName: "item {i}",
    nftIconUri: "ipfs://f", nftIconType: "png",
  });

  it("writes one entry per NFT, keyed by commitment", () => {
    expect(Object.keys(snapshotOf(collection).token.nfts.parse.types)).toEqual(["01", "02", "03"]);
  });

  it("writes the collection description when given", () => {
    const text = "Tickets to the ABC conference.";
    expect(snapshotOf({ ...collection, nftCollectionDescription: text }).token.nfts.description).toBe(text);
  });

  it("omits the collection description when blank, since the spec has it optional", () => {
    expect(snapshotOf(collection).token.nfts).not.toHaveProperty("description");
  });
});

describe("a registry naming several identities", () => {
  const B = "b".repeat(64);
  const C = "c".repeat(64);
  const registry = generateRegistry([
    details(),
    details({ tokenId: B, tokenName: "ACME Corp", hasToken: false, tokenSymbol: "" }),
    details({ tokenId: C, tokenName: "ACME Dapp", hasToken: false, tokenSymbol: "" }),
  ]) as any;

  it("merges every identity into one file", () => {
    expect(Object.keys(registry.identities)).toEqual([ID, B, C]);
  });

  it("keeps each identity's own kind", () => {
    expect(registry.identities[ID][DATE].token.symbol).toBe("ABC");
    expect(registry.identities[B][DATE]).not.toHaveProperty("token");
  });

  it("takes the registry-level fields from the shared half", () => {
    expect(registry.registryIdentity).toMatchObject({ name: "bcmr for ABC" });
  });

  it("still works for a single identity", () => {
    expect(Object.keys((generateRegistry([details()]) as any).identities)).toHaveLength(1);
  });
});
