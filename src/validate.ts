
import type { DetailsObj } from "./interfaces/interfaces.js";

/**
 * Form validation. The only validation in the app, kept here so generateBcmr stays
 * purely a builder.
 *
 * The contract the rest of the app depends on is just the two exports below, and
 * `FieldIssue`. Nothing outside this file knows how a rule is expressed, so swapping
 * the implementation (for a schema library, say) means rewriting `validateDetails`
 * and leaving its signature alone.
 *
 * Everything here guards the same thing: the output's hash is what a BCMR
 * publication commits to on-chain, so a value that is merely wrong rather than
 * missing still ends up committed, and correcting it costs another authchain
 * transaction.
 */

export interface FieldIssue {
  field: string;
  message: string;
}

/** An authbase is a 32-byte transaction hash, so the key of `identities` is 64 hex characters. */
const HEX64 = /^[0-9a-fA-F]{64}$/;

/** The spec's rule for a token symbol. */
const SYMBOL = /^[-A-Z0-9]+$/;

/**
 * The spec asks for a protocol prefix and says clients need only support https and
 * ipfs, though any scheme may be specified. So this checks that a scheme is present
 * rather than allow-listing two: what it is really catching is a bare CID or a bare
 * domain pasted into a URI field, which no client can resolve.
 */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** A file extension appended after a dot, so it must not carry one of its own. */
const EXTENSION = /^[a-z0-9]+$/i;

function integerIn(value: string, min: number, max: number): boolean {
  return /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max;
}

export function validateDetails(details: DetailsObj): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const add = (field: string, message: string) => issues.push({ field, message });

  if (!details.tokenId) add("tokenId", "Required.");
  else if (!HEX64.test(details.tokenId)) {
    add("tokenId", "Must be exactly 64 hex characters: this becomes the identity's key in the registry.");
  }

  if (!details.tokenName) add("tokenName", "Required.");
  if (!details.tokenDescription) add("tokenDescription", "Required.");

  if (!details.tokenSymbol) add("tokenSymbol", "Required.");
  else if (!SYMBOL.test(details.tokenSymbol)) {
    add("tokenSymbol", "Capital letters, numbers and dashes only.");
  }

  if (details.tokenDecimals && !integerIn(details.tokenDecimals, 0, 18)) {
    add("tokenDecimals", "A whole number from 0 to 18.");
  }

  if (details.iconUri && !HAS_SCHEME.test(details.iconUri)) {
    add("iconUri", "Needs a scheme, for example https://... or ipfs://... A bare CID or domain will not resolve.");
  }
  if (details.webUrl && !HAS_SCHEME.test(details.webUrl)) {
    add("webUrl", "Needs a scheme, for example https://...");
  }

  if (details.hasNftFields) {
    if (!details.numberNFTs) add("numberNFTs", "Required.");
    else if (!integerIn(details.numberNFTs, 1, 100000)) add("numberNFTs", "A whole number, at least 1.");

    if (!details.startingNumber) add("startingNumber", "Required.");
    else if (!integerIn(details.startingNumber, 1, 1000000000)) {
      // 0 would make the first NFT a negative VM number, which the spec discourages
      add("startingNumber", "A whole number, at least 1.");
    }

    if (!details.nftName) add("nftName", "Required.");

    if (details.nftIconUri && !HAS_SCHEME.test(details.nftIconUri)) {
      add("nftIconUri", "Needs a scheme, for example ipfs://... A bare CID will not resolve.");
    }
    if (details.nftIconType && !EXTENSION.test(details.nftIconType)) {
      add("nftIconType", "Just the extension, with no dot: png, svg, jpg.");
    }
  }

  details.listLinks.forEach(([key, value], index) => {
    if (value && !HAS_SCHEME.test(value)) {
      add(`listLinks.${index}`, "Needs a scheme: the full URL, not a handle or a CID.");
    }
    if (value && !key) add(`listLinks.${index}`, "Pick what this link is.");
  });

  return issues
}

export function validInputs(details: DetailsObj): boolean {
  return validateDetails(details).length === 0
}
