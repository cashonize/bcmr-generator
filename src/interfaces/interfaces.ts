/** One identity in the registry: everything the form collects about a single authbase. */
export interface IdentityDraft {
  /** false for a person, organization, dapp or contract system: the spec omits `token` for those */
  hasToken: boolean
  tokenId: string
  tokenName: string
  tokenDescription: string
  tokenSymbol: string,
  iconUri: string
  tokenDecimals: string
  hasNftFields: boolean
  /** what the collection is for, the spec's `token.nfts.description` */
  nftCollectionDescription: string
  numberNFTs: string
  numbering: "hex" | "vm-numbers"
  /** the number in names and image filenames for the first NFT */
  startingNumber: string
  /**
   * How far an NFT's commitment sits from its number: commitment = number + offset. Empty
   * or 0 means they match. An offset rather than an absolute first commitment, so editing
   * the starting number does not silently change the relationship.
   */
  commitmentOffset: string
  nftName: string
  nftDescription: string
  nftIconUri: string
  nftIconType: string
  hasNftImages: boolean
  webUrl: string
  listLinks: ([] | [string | undefined, string | undefined])[]
}

/**
 * One identity plus the registry-level fields it shares with the others. A registry
 * naming several identities produces one of these per identity, differing only in the
 * `IdentityDraft` half.
 */
export interface DetailsObj extends IdentityDraft {
  date: string
  registryIdentityName: string
  registryIdentityDescription: string
  /** when set, the registry names its own identity by authbase instead of inline */
  registryIdentityAuthbase: string
}
