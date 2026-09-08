# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A single-page, entirely client-side form that produces a BCMR (Bitcoin Cash Metadata
Registry) v2 JSON file for a CashTokens project. Vue 3 (`<script setup>`) + TypeScript on
Vite, no backend and nothing uploaded; the generated JSON is handed to the browser as a
`data:` URI download. Hosting the result is the user's job. Deployed at
bcmr-generator.app.

The standard is [CHIP-BCMR](https://github.com/bitjson/chip-bcmr); the schema the output
declares is [`bcmr-v2.schema.json`](https://cashtokens.org/bcmr-v2.schema.json).

**Read [`docs/bcmr-registries.md`](docs/bcmr-registries.md) before changing
`generateBcmr.ts` or the form fields that feed it**: it covers the identity/authchain
model, which parts of the output are the spec and which are this app's convention, the NFT
commitment encodings, and the known gaps (multi-identity registries, snapshot history).

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

The whole app is three meaningful files:

- **`src/App.vue`**: the entire UI and all state. Every form field is a standalone
  `ref()`; there are no child components and no store.
- **`src/interfaces/interfaces.ts`**: `DetailsObj`, the contract between the form and
  the generator.
- **`src/generateBcmr.ts`**: pure functions `validInputs()` and `generateBcmr()` that
  turn a `DetailsObj` into a `Registry`.

The data flow is deliberately one-directional and un-reactive: `createBcmrFile()` in
`App.vue` snapshots every ref into a single `DetailsObj` literal, validates it, calls
`generateBcmr()`, and downloads the result.

**Adding a form field means touching four places**: a new `ref` in `App.vue`, a field on
`DetailsObj`, the details object literal in `createBcmrFile()`, and the consumption in
`generateBcmr()` (plus `validInputs()` if it is required). Because they are wired by hand
rather than derived, forgetting one of the four is the most likely bug.

Note that **every `DetailsObj` field is a `string`**, including numeric ones
(`tokenDecimals`, `numberNFTs`, `startingNumber`); they hold raw input values, and
`generateBcmr()` does the `parseInt` itself.

### `src/interfaces/bcmr-v2.schema.ts`

1000 lines of types transcribed from the upstream BCMR v2 JSON schema. This mirrors an
external spec. Treat it as vendored, and only change it to track upstream, not to make
local code typecheck.

### libauth

**`@bitauth/libauth` is imported only for its pure helpers** (`bigIntToVmNumber`,
`binToHex`). Its crypto entrypoints pull in a module that uses top-level await to
instantiate WASM; today that module tree-shakes out of the bundle entirely, which is why
`vite-plugin-top-level-await` could be dropped. Importing a crypto function would pull the
WASM and the top-level await back in.

## Styling

`chota` (a CSS micro-framework, imported in `src/assets/main.css`) plus inline styles on
elements. `@vueform/toggle` provides the toggle switches; its theme CSS is pulled in by
the `<style src>` at the bottom of `App.vue`.
