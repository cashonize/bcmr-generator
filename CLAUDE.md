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

Base CSS is a vendored subset of chota v0.9.2 (`src/assets/chota-subset.css`), imported by
`src/assets/main.css`. chota itself is no longer a dependency. The subset carries only the
base and form rules this form uses, copied from chota's unprefixed `src/` modules rather
than its `dist/` build, whose legacy prefixes target browsers below the app's build
target. Everything else is inline styles on elements.

Left out of the subset: the grid, nav, cards, tabs, tags, dropdowns, tables, the utility
classes, and the button and input variants the app never applies. Using one of those means
bringing its rule across from upstream, not assuming it is there.

`@vueform/toggle` provides the toggle switches; its theme CSS is pulled in by the
`<style src>` at the bottom of `App.vue`. It renders checkbox inputs internally, which is
why the subset keeps chota's `[type="checkbox"]` rule even though the form has no checkbox
of its own.

### Theming

`src/composables/useTheme.ts` owns the light/dark choice: it writes `data-theme` on
`<html>`, persists to `localStorage` under `bcmr-generator-theme`, and follows the OS
until the visitor picks a side. `components/ThemeToggle.vue` is the only consumer.

The dark palette in `main.css` is almost entirely a re-point of the chota variables the
subset defines, so new UI inherits it by using those variables rather than raw hex. Two
rules exist because chota hardcodes a light colour instead of reading a variable: the
`select` background and arrow, and `::placeholder`. Adding a component with its own colours
means adding a `:root[data-theme="dark"]` case for it.

`index.html` sets `data-theme` in an inline script before first paint so a dark visitor
never sees a white flash; its storage key has to stay in sync with the composable.
