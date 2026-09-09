import { describe, it, expect } from "vitest";
import { validateDetails, duplicateAuthbaseIndexes } from "../src/validate";
import type { DetailsObj } from "../src/interfaces/interfaces";

const ID = "a".repeat(64);

function details(over: Partial<DetailsObj> = {}): DetailsObj {
  return {
    date: "2026-09-09T12:00:00.000Z",
    registryIdentityName: "bcmr for ABC",
    registryIdentityDescription: "self-published bcmr for ABC",
    registryIdentityAuthbase: "",
    hasToken: true,
    tokenId: ID,
    tokenName: "ABC",
    tokenDescription: "a token",
    tokenSymbol: "ABC",
    iconUri: "",
    tokenDecimals: "",
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
    webUrl: "",
    listLinks: [],
    ...over,
  };
}

/** the fields that complained, so a test can name one without depending on wording */
const fieldsFlaggedBy = (over: Partial<DetailsObj>) =>
  validateDetails(details(over)).map((issue) => issue.field);

describe("the baseline", () => {
  it("passes a filled-in token identity", () => {
    expect(validateDetails(details())).toEqual([]);
  });
});

describe("the authbase", () => {
  it("must be present", () => {
    expect(fieldsFlaggedBy({ tokenId: "" })).toContain("tokenId");
  });

  it("must be 64 hex characters, since it keys the identities map", () => {
    expect(fieldsFlaggedBy({ tokenId: "not-hex" })).toContain("tokenId");
    expect(fieldsFlaggedBy({ tokenId: "a".repeat(63) })).toContain("tokenId");
    expect(fieldsFlaggedBy({ tokenId: "A".repeat(64) })).not.toContain("tokenId");
  });
});

describe("the token fields", () => {
  it("requires a symbol, matching the spec's characters", () => {
    expect(fieldsFlaggedBy({ tokenSymbol: "" })).toContain("tokenSymbol");
    expect(fieldsFlaggedBy({ tokenSymbol: "doge cash" })).toContain("tokenSymbol");
    expect(fieldsFlaggedBy({ tokenSymbol: "DOGE-2" })).not.toContain("tokenSymbol");
  });

  it("holds decimals to the spec's 0 to 18", () => {
    expect(fieldsFlaggedBy({ tokenDecimals: "19" })).toContain("tokenDecimals");
    expect(fieldsFlaggedBy({ tokenDecimals: "1.5" })).toContain("tokenDecimals");
    expect(fieldsFlaggedBy({ tokenDecimals: "18" })).not.toContain("tokenDecimals");
    expect(fieldsFlaggedBy({ tokenDecimals: "" })).not.toContain("tokenDecimals");
  });

  it("asks for none of them when the identity is not a token", () => {
    expect(validateDetails(details({ hasToken: false, tokenSymbol: "", tokenDecimals: "" }))).toEqual([]);
  });
});

describe("uris", () => {
  it("wants a scheme, which is what catches a bare CID or domain", () => {
    expect(fieldsFlaggedBy({ iconUri: "bafybeigdyrztabc" })).toContain("iconUri");
    expect(fieldsFlaggedBy({ webUrl: "example.com" })).toContain("webUrl");
  });

  it("takes any scheme, not only https and ipfs", () => {
    expect(fieldsFlaggedBy({ iconUri: "ipfs://bafy" })).not.toContain("iconUri");
    expect(fieldsFlaggedBy({ iconUri: "https://example.com/i.png" })).not.toContain("iconUri");
    expect(fieldsFlaggedBy({ webUrl: "ar://something" })).not.toContain("webUrl");
  });

  it("checks the extra links too, and says which row", () => {
    const flagged = fieldsFlaggedBy({ listLinks: [["web", "https://ok.example"], ["twitter", "@handle"]] });
    expect(flagged).toContain("listLinks.1");
    expect(flagged).not.toContain("listLinks.0");
  });

  it("wants a row's kind picked once it has a value", () => {
    expect(fieldsFlaggedBy({ listLinks: [["", "https://ok.example"]] })).toContain("listLinks.0");
  });
});

describe("the registry's own authbase", () => {
  it("is optional", () => {
    expect(fieldsFlaggedBy({ registryIdentityAuthbase: "" })).not.toContain("registryIdentityAuthbase");
  });

  it("must be 64 hex when given", () => {
    expect(fieldsFlaggedBy({ registryIdentityAuthbase: "abc" })).toContain("registryIdentityAuthbase");
    expect(fieldsFlaggedBy({ registryIdentityAuthbase: "b".repeat(64) })).not.toContain("registryIdentityAuthbase");
  });
});

describe("an nft collection", () => {
  const collection = (over: Partial<DetailsObj> = {}) => ({
    hasNftFields: true, numberNFTs: "10", startingNumber: "1",
    nftName: "item {i}", nftIconUri: "ipfs://f", nftIconType: "png", ...over,
  });

  it("passes when it is filled in", () => {
    expect(validateDetails(details(collection()))).toEqual([]);
  });

  it("requires a count and a name", () => {
    expect(fieldsFlaggedBy(collection({ numberNFTs: "" }))).toContain("numberNFTs");
    expect(fieldsFlaggedBy(collection({ nftName: "" }))).toContain("nftName");
  });

  it("allows starting at 0, which is the empty commitment", () => {
    expect(fieldsFlaggedBy(collection({ startingNumber: "0" }))).not.toContain("startingNumber");
  });

  it("wants an image type once a folder is given, or every icon ends in a bare dot", () => {
    expect(fieldsFlaggedBy(collection({ nftIconType: "" }))).toContain("nftIconType");
    expect(fieldsFlaggedBy(collection({ nftIconType: ".png" }))).toContain("nftIconType");
  });

  it("takes an offset, but not one that would make the first commitment negative", () => {
    expect(fieldsFlaggedBy(collection({ commitmentOffset: "-1" }))).not.toContain("commitmentOffset");
    expect(fieldsFlaggedBy(collection({ startingNumber: "0", commitmentOffset: "-1" }))).toContain("commitmentOffset");
    expect(fieldsFlaggedBy(collection({ commitmentOffset: "x" }))).toContain("commitmentOffset");
  });

  it("is ignored entirely when the identity has no token", () => {
    expect(validateDetails(details({ ...collection({ numberNFTs: "", nftName: "" }), hasToken: false, tokenSymbol: "" }))).toEqual([]);
  });
});

describe("authbases across identities", () => {
  it("finds nothing when they differ", () => {
    expect(duplicateAuthbaseIndexes([{ tokenId: ID }, { tokenId: "b".repeat(64) }])).toEqual([]);
  });

  it("reports the later of two that would collapse into one entry", () => {
    expect(duplicateAuthbaseIndexes([{ tokenId: ID }, { tokenId: "b".repeat(64) }, { tokenId: ID }])).toEqual([2]);
  });

  it("compares without case, since hex is written either way", () => {
    expect(duplicateAuthbaseIndexes([{ tokenId: ID }, { tokenId: ID.toUpperCase() }])).toEqual([1]);
  });

  it("ignores rows that are still empty", () => {
    expect(duplicateAuthbaseIndexes([{ tokenId: "" }, { tokenId: "" }])).toEqual([]);
  });
});
