# BCMR Generator

Fill-in form to create the [BCMR](https://github.com/bitjson/chip-bcmr) Json file for a CashTokens project! Deployed at [bcmr-generator.app](https://bcmr-generator.app/).

This Json file can then be hosted on the web on a domain name you control or can be pinned on IPFS.

![Screenshot0](./screenshots/Screenshot0.png)

## Project Setup

```sh
pnpm install
```

### Run Locally

```sh
pnpm dev
```

## Documentation

🗺️ For an overview of the architecture, see [CLAUDE.md](./CLAUDE.md): written to guide AI agents, it doubles as the codebase's architecture documentation.

📖 The [`docs`](./docs) folder covers the BCMR standard itself: [the registry files this generator writes](./docs/bcmr-registries.md) explains the identity model behind [CHIP-BCMR](https://github.com/bitjson/chip-bcmr), which parts of the output are the spec and which are this generator's own convention, the two NFT commitment encodings, and what the standard allows that the generator does not do yet.

## Historic Version

🪦 Before moving the generator to Vue it was written in vanilla-js. <br>
You can find the old codebase [here](https://github.com/mr-zwets/bcmr-generator-vanillaJS).

