
import { bigIntToVmNumber, binToHex } from "@bitauth/libauth";
import type { Registry, NftType } from "./interfaces/bcmr-v2.schema.js"
import type { DetailsObj } from "./interfaces/interfaces.js";

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
      description: "",
      parse: {
        types: {}
      }
    };
    const NFTtypes = snapshot.token!.nfts!.parse.types;
    const startingNumber = parseInt(details.startingNumber) ?? 1;
    const endingNumber = startingNumber + parseInt(details.numberNFTs);
    for(let i=startingNumber; i < endingNumber; i++){
      const nftNameNumbered = details.nftName.replace("{i}", i.toString());
      const nftDescriptionNumbered = details.nftDescription.replace("{i}", i.toString());
      let nftCommitment
      if(details.numbering === "hex"){
        nftCommitment = i.toString(16);
        if(nftCommitment.length % 2 != 0) nftCommitment = `0${nftCommitment}`;
      } else {
        const vmNumber = bigIntToVmNumber(BigInt(i) - 1n);
        nftCommitment = binToHex(vmNumber);
      }
      const newNftItem: NftType= {
        "name": nftNameNumbered,
        "description": nftDescriptionNumbered ,
        "uris": {
          "icon": details.nftIconUri + `/${i}.${details.nftIconType}`
        }
      }
      if(details.hasNftImages){
        if(!newNftItem.uris) throw new Error("Error in newNftItem.uris")
        newNftItem.uris.image = details.nftIconUri + `/${i}-img.${details.nftIconType}`
      }
      NFTtypes[nftCommitment] = newNftItem
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
