export interface DetailsObj {
  date: string
  registryIdentityName: string
  registryIdentityDescription: string
  /** when set, the registry names its own identity by authbase instead of inline */
  registryIdentityAuthbase: string
  /** false for a person, organization, dapp or contract system: the spec omits `token` for those */
  hasToken: boolean
  tokenId: string
  tokenName: string
  tokenDescription: string
  tokenSymbol: string,
  iconUri: string
  tokenDecimals: string
  hasNftFields: boolean
  numberNFTs: string
  numbering: "hex" | "vm-numbers"
  startingNumber: string
  nftName: string
  nftDescription: string
  nftIconUri: string
  nftIconType: string
  hasNftImages: boolean
  webUrl: string
  listLinks: ([] | [string | undefined, string | undefined])[]
}