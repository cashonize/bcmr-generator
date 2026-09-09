# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A single-page, entirely client-side form that produces a BCMR (Bitcoin Cash Metadata
Registry) v2 JSON file for a CashTokens project. Vue 3 (`<script setup>`) + TypeScript on
Vite, no backend and nothing uploaded. Hosting the result and publishing its hash on-chain
are the user's job. Deployed at bcmr-generator.app.

The standard is [CHIP-BCMR](https://github.com/bitjson/chip-bcmr); the schema the output
declares is [`bcmr-v2.schema.json`](https://cashtokens.org/bcmr-v2.schema.json).

**Read [`docs/bcmr-registries.md`](docs/bcmr-registries.md) before changing
`generateBcmr.ts`, `updateBcmr.ts` or the form fields that feed them.** It covers the
identity model, which parts of the output are the spec and which are this app's own
convention, the NFT commitment encodings, and the known gaps.

## Commands

```sh
pnpm install      # pnpm 11; Node 20.19+/22.12+/24+
pnpm dev          # vite dev server
pnpm build        # vue-tsc --build && vite build
pnpm type-check   # vue-tsc --build (vite build alone does not type-check)
pnpm lint         # eslint . --fix
pnpm preview      # serve the production build
```

There is no test suite and no test runner installed.

## Architecture

- **`src/App.vue`**: the whole form and all its state. `identities` is an array of
  `IdentityDraft`, one per tab, and the form binds to `current`, the active one.
  `src/components/` is presentational only, and there is no store.
- **`src/interfaces/interfaces.ts`**: `IdentityDraft` is one identity; `DetailsObj` is one
  plus the registry-level fields it shares with the others, which is what the generator and
  the validator take.
- **`src/generateBcmr.ts`**: pure builders. `generateBcmr()` makes a one-identity registry,
  `generateRegistry()` merges one per draft into a file naming several.
- **`src/validate.ts`**: all form validation, behind `validateDetails()`, `FieldIssue` and
  `duplicateAuthbaseIndexes()`. Nothing outside knows how a rule is expressed, so the
  implementation can be swapped without touching callers.
- **`src/updateBcmr.ts`**: the Update existing mode. Parses a registry the user already
  published, prefills a draft per identity, and merges generated snapshots back in.
- **`src/interfaces/bcmr-v2.schema.ts`**: types transcribed from the upstream schema. Treat
  it as vendored: change it to track upstream, not to make local code typecheck.

Two independent axes at the top of the form: **New registry / Update existing** is which
job, **Advanced** is which persona. Simple self-publishes metadata for one token; advanced
maintains a registry, and owns non-token identities (`hasToken`, which omits the whole
`token` block), the registry's own identity, and naming several identities in one file.
Turning Advanced off resets the first two and is locked while a second identity exists, so
simple mode still writes exactly one and its output stays byte-identical.

The things that bite:

- **Adding a form field means touching four hand-wired places**: `blankIdentity()` in
  `App.vue`, a field on `IdentityDraft` (or `DetailsObj` if it is registry-level), the
  template binding to `current`, and `generateBcmr()`, plus a rule in `validate.ts` if it
  needs one. Forgetting one is the likeliest bug here.
- **Validation issues carry the identity they belong to.** A failed generate switches to
  that tab, and tabs with a problem are marked, since the field may be on one you cannot
  see. `duplicateAuthbaseIndexes` is the only rule that spans identities: two drafts sharing
  an authbase would collapse into one entry in the output.
- **A token identity can never become a non-token one**, since a category is a consensus
  fact, and `mergeSnapshot` keeps `prev.token` regardless. So the kind toggle is locked
  rather than ignored when updating an identity that already has one.
- **Field rules guard what a typo would commit on-chain**, not just what is missing: a
  tokenId that is not 64 hex names a garbage authbase, a URI without a scheme resolves
  nowhere. Errors appear after the first generate attempt and scroll into view, since the
  button sits below a long form.
- **Every `DetailsObj` field is a `string`**, the numeric ones included; `generateBcmr()`
  does the parsing.
- **An NFT's number is the number its commitment encodes**, in both numbering schemes.
  `nftNumbers()` is the only place that decides, and advanced mode's `commitmentOffset` is
  what shifts them apart. `nftEntry()` is shared by the generator and the form's preview,
  so the preview cannot promise something the file will not contain.
- **The preview is a `computed` over the form, never a snapshot**, so it cannot disagree
  with what downloads. That matters because the panel shows the file's SHA-256 and a BCMR
  publication commits that hash on-chain. `generatedAt` is frozen at the click, so editing
  afterwards does not move `latestRevision`.
- **Update mode carries through anything the form does not model**: other identities,
  earlier snapshots, `tags`, `locales`, `extensions`. An empty field means "leave alone",
  not "erase". The reasoning is in `updateBcmr.ts`.
- **Hashing uses Web Crypto, not libauth's `sha256`.** libauth is imported only for
  `bigIntToVmNumber` and `binToHex`; its crypto entrypoints drag in a WASM module with
  top-level await that currently tree-shakes out of the bundle.

## Styling

Base CSS is a vendored subset of chota v0.9.2 (`src/assets/chota-subset.css`), imported by
`src/assets/main.css`; chota itself is not a dependency. The subset carries only the base
and form rules this app uses, so reaching for something it left out (the grid, nav, cards,
tabs, tags, utility classes) means bringing that rule across from upstream rather than
assuming it is there. Everything else is inline styles.

Light and dark live in `src/composables/useTheme.ts`, which sets `data-theme` on `<html>`;
`index.html` sets it again before first paint to avoid a flash. The dark palette in
`main.css` mostly re-points chota's own variables, so new UI inherits it by using those
variables rather than raw hex.
