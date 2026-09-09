
import { bigIntToVmNumber, binToHex } from "@bitauth/libauth";
import type { Registry, NftType } from "./interfaces/bcmr-v2.schema.js"
import type { DetailsObj } from "./interfaces/interfaces.js";

/**
 * The on-chain commitment for one NFT, encoding the NFT's own number. Both modes encode the
 * same number and differ only in how: vm-numbers is the spec's, little-endian and
 * sign-magnitude, so 0 is empty and 500 is `f401`. hex is big-endian, and legacy.
 */
export function nftCommitment(displayNumber: number, numbering: DetailsObj["numbering"]): string {
  if(numbering === "hex"){
    const hex = displayNumber.toString(16);
    return hex.length % 2 === 0 ? hex : `0${hex}`
  }
  return binToHex(bigIntToVmNumber(BigInt(displayNumber)))
}

function toInt(value: string, fallback: number): number {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed
}

/**
 * The two numbers one NFT carries: the one people see in its name and filename, and the one
 * the chain carries in its commitment. Equal unless `commitmentOffset` shifts them.
 */
export function nftNumbers(details: DetailsObj, index: number): { display: number; vm: number } {
  const display = toInt(details.startingNumber, 0) + index;
  return { display, vm: display + toInt(details.commitmentOffset, 0) }
}

/**
 * Everything one NFT gets, from its position in the collection. The form's preview renders
 * this and generateBcmr writes it, so what is shown and what is generated cannot drift.
 */
export function nftEntry(details: DetailsObj, index: number) {
  const { display, vm } = nftNumbers(details, index);
  const number = display.toString();
  return {
    number: display,
    vm,
    commitment: nftCommitment(vm, details.numbering),
    name: details.nftName.replaceAll("{i}", number),
    description: details.nftDescription.replaceAll("{i}", number),
    icon: `${details.nftIconUri}/${number}.${details.nftIconType}`,
    image: details.hasNftImages ? `${details.nftIconUri}/${number}-img.${details.nftIconType}` : undefined,
  }
}

export function generateBcmr(details:DetailsObj):Registry {
  // Generate BCMR json obj
  const bcmrJsonObj: Partial<Registry> = {
    "$schema": "https://cashtokens.org/bcmr-v2.schema.json",
    "version": { "major": 0, "minor": 1, "patch": 0 },
    "latestRevision": details.date,
    // an authbase makes the registry itself on-chain resolvable, which is the spec's
    // recommendation; the inline object is what a self-published token registry wants
    "registryIdentity": details.registryIdentityAuthbase
      ? details.registryIdentityAuthbase
      : {
          "name": details.registryIdentityName,
          "description": details.registryIdentityDescription,
        },
    "identities": {
      [details.tokenId]: {
        [details.date]: {
          "name": details.tokenName,
          "description": details.tokenDescription,
          "uris": {
            "icon": details.iconUri,
            "web": details.webUrl
          }
        }
      }
    }
  }
  if(!bcmrJsonObj?.identities?.[details.tokenId][details.date]) throw new Error("Error in bcmrJsonObj")
  const snapshot = bcmrJsonObj.identities[details.tokenId][details.date];
  if(!snapshot) throw new Error("Error in snapshot")
  // the spec omits `token` entirely for an identity that is not a token
  if(details.hasToken){
    snapshot.token = {
      "category": details.tokenId,
      "symbol": details.tokenSymbol
    };
    const tokenDecimals = parseInt(details.tokenDecimals)
    if(!Number.isNaN(tokenDecimals)) snapshot.token.decimals = tokenDecimals;
  }
  if(details.hasToken && details.hasNftFields){
    snapshot.token!.nfts = {
      // optional in the spec, so omitted rather than written empty
      ...(details.nftCollectionDescription ? { description: details.nftCollectionDescription } : {}),
      parse: {
        types: {}
      }
    };
    const NFTtypes = snapshot.token!.nfts!.parse.types;
    const count = toInt(details.numberNFTs, 0);
    for(let index = 0; index < count; index++){
      const entry = nftEntry(details, index);
      const newNftItem: NftType = {
        "name": entry.name,
        "description": entry.description,
        "uris": { "icon": entry.icon },
      }
      if(entry.image) newNftItem.uris!.image = entry.image;
      NFTtypes[entry.commitment] = newNftItem
    }
  }
  if(!snapshot?.uris) snapshot.uris = {}
  if(details.webUrl) snapshot.uris.web = details.webUrl;
  for(const [key, value] of details.listLinks){
    if(key && value) snapshot.uris[key] = value;
  }
  return bcmrJsonObj as Registry;
}

/**
 * A registry naming several identities. Each is built by generateBcmr and their
 * `identities` maps merged; every other field comes from the first, since the
 * registry-level ones are shared across the drafts.
 */
export function generateRegistry(drafts: DetailsObj[]): Registry {
  if(!drafts.length) throw new Error("Error: a registry needs at least one identity")
  const registry = generateBcmr(drafts[0]);
  for(const draft of drafts.slice(1)){
    registry.identities = { ...registry.identities, ...generateBcmr(draft).identities };
  }
  return registry
}
