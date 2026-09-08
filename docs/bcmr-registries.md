# The registry files this generator writes

What a BCMR registry is, which parts of the output are the standard and which are this
generator's convention, and what the standard allows that the generator does not do yet.
Read this before changing `generateBcmr.ts` or the form fields that feed it.

The standard is [CHIP-BCMR](https://github.com/bitjson/chip-bcmr); the JSON schema the
output declares is [`bcmr-v2.schema.json`](https://cashtokens.org/bcmr-v2.schema.json),
transcribed to types in `src/interfaces/bcmr-v2.schema.ts`.

## The model, in the spec's words

- **Authbase.** A transaction. Its hash is an identity's permanent id and root of trust.
- **Authchain.** The lineage of output 0 from the authbase onward; its latest transaction
  is the **authhead**, and that transaction's unspent output 0 is the identity's UTXO.
  Whoever holds that coin holds the identity.
- **Publication.** An `OP_RETURN "BCMR" <hash> <uri>...` output on an authchain
  transaction, committing to the hash of a registry file hosted off-chain and saying where
  it is hosted. A bare domain means `/.well-known/bitcoin-cash-metadata-registry.json`.
- **Registry.** The hosted JSON file this app generates. Its `identities` are keyed
  by authbase, each a history of snapshots keyed by timestamp; the current snapshot is the
  latest one **not after now**.

**For a token, the authbase is the transaction whose output 0 the genesis spent, so the
token's category is its authbase.** That is a consensus fact, not a convention, and it is
why the form's single "TokenId" field is used both as the `identities` key and as
`token.category`. The spec's identities are not only tokens: people, organizations and
contract systems are identities too, differing only in having no token on their chain.

The file is not trusted for being where it is: the on-chain publication hash is what
authenticates it. Hosting it is the user's job, and outside this app's scope.

## What the generator emits

One `Registry` with exactly one identity and exactly one snapshot:

- `version` is always `0.1.0`. The spec's semantics are: **major** bumps when an identity
  is removed, **minor** when an identity or a snapshot is added, **patch** when an existing
  snapshot or a registry-level property is corrected. A regenerated file for an update is
  therefore mislabelled as a first publication; see Future items.
- `latestRevision` and the snapshot's timestamp key are the same `new Date().toISOString()`
  string. The spec requires exactly that 24-character format.
- `registryIdentity` is always an inline object (`{name, description}`, auto-derived as
  `bcmr for <token name>` / `self-published bcmr for <token name>`). The spec also allows
  an authbase **string** here, which is the recommended form: it makes the registry itself
  an on-chain-resolvable identity. Emitting the inline object means the file describes the
  token's identity on-chain, but the registry's own identity is authenticated only by where
  it is hosted. This is deliberate for the self-published single-token case the app targets.
- `identities[tokenId][date]` carries `name`, `description`, `token` (`category`, `symbol`,
  optional `decimals`), and `uris`.

## NFT commitments: the part that is easy to get wrong

When "Has NFTs" is on, the generator emits a **sequential** NFT collection: `token.nfts`
with `parse.types` and no `parse.bytecode`. The spec's other shape, a *parsable*
collection, requires bytecode that parses each commitment and is not something this app
produces.

`parse.types` is keyed by **on-chain commitment hex**, and for sequential NFTs the spec
says each commitment is interpreted as a **VM number**. The generator offers two schemes:

| Displayed # | `vm-numbers` (default) | `hex` (legacy) |
|---|---|---|
| 1 | `""` (empty) | `01` |
| 2 | `01` | `02` |
| 128 | `7f` | `80` |
| 129 | `8000` | `81` |
| 255 | `fe00` | `ff` |

Two things follow that reliably surprise people:

- **NFT #1 has an empty commitment** under `vm-numbers`, because the displayed number is
  one-based and the VM number is zero-based (`bigIntToVmNumber(BigInt(i) - 1n)`). The
  `- 1n` is intentional; it is not an off-by-one.
- **VM numbers are little-endian and sign-magnitude**, so they diverge from plain hex well
  before they look like they should. `8000` is 128 with a `00` byte appended because a bare
  `80` would read as negative.

`hex` mode is plain big-endian `i.toString(16)` zero-padded to an even length. It exists
only for backwards compatibility with old Cashonize collections and **deviates from the
spec**: a conforming client reading those commitments as VM numbers displays different
numbers than the registry names. Do not offer it as anything but a legacy option.

## Conventions this generator invents

None of the following is in CHIP-BCMR; they are this app's ergonomics, and a hand-written
registry is free to ignore them.

- `{i}` in the NFT name and description is substituted with the displayed NFT number.
- Icon and image URIs are derived from one image-folder URI by convention:
  `{folder}/{i}.{type}` for the 400x400 icon, `{folder}/{i}-img.{type}` for the optional
  high-resolution image. The spec just wants URIs; nothing requires this layout.
- The auto-derived `registryIdentity` name and description described above.
- `token.nfts.description` is emitted as an empty string; the spec treats it as optional.

## Future items

What the standard enables that the generator does not do yet.

- **Multi-identity registries.** One registry file may name any number of identities: an
  organization and its token, a project's several token categories, a token and the
  registry's own identity. The form models exactly one, so anyone publishing more merges
  files by hand today. Nothing written by this generator or by CashTokens Studio names more
  than one identity, which is why downstream wallets have not had to handle the case well
  either.
- **Snapshot history / updates.** A registry update is a new snapshot added under the same
  authbase with a later timestamp, keeping the old ones so clients can show what changed.
  The generator always writes a single snapshot at `now` and always version `0.1.0`, so
  updating a token means editing the previous file by hand. Taking an existing registry as
  input and appending a snapshot is the natural shape of this.
- **An authbase as `registryIdentity`.** Letting the user give the registry its own
  on-chain identity, per the spec's recommendation, instead of the inline object.
- **The rest of the spec's optional surface.** `tags`, `license`, `locales`,
  `defaultChain` / `chains` for non-mainnet tokens, `extensions`, and identity `migrated`
  fields are typed in the vendored schema and reachable, but have no form field.
- **Parsable NFT collections.** Sequential is the only shape the form produces.
