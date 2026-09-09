<script setup lang="ts">
  import { computed, nextTick, ref, watch } from "vue"
  import { generateBcmr } from "./generateBcmr"
  import { validateDetails } from "./validate"
  import { parseRegistry, applyUpdate, prefillFrom, nextVersion, type Prefill } from "./updateBcmr"
  import type { Registry } from "./interfaces/bcmr-v2.schema"
  import ThemeToggle from './components/ThemeToggle.vue'
  import InfoTip from './components/InfoTip.vue'
  import ToggleSwitch from './components/ToggleSwitch.vue'
  import type { DetailsObj } from "./interfaces/interfaces";

  // Simple mode is self-publishing metadata for one token. Advanced is maintaining a
  // registry: identities that are not tokens, and control of the registry's own identity.
  const advanced = ref(false);
  const hasToken = ref(true);
  const registryName = ref("");
  const registryDescription = ref("");
  const registryAuthbase = ref("");

  const tokenId = ref("");
  const tokenName = ref("");
  const tokenDescription = ref("");
  const tokenSymbol = ref("");
  const iconUri = ref("");
  const tokenDecimals = ref("");

  const hasNftFields = ref(false);
  const numberNFTs = ref("");
  const numbering = ref("vm-numbers" as "hex" | "vm-numbers");
  const startingNumber = ref("");
  const nftName = ref("");
  const nftDescription = ref("");
  const nftIconUri = ref("")
  const nftIconType = ref("");
  const hasImages = ref(false);

  const webUrl = ref("");
  const listLinks = ref([] as ([] | [string | undefined, string | undefined])[]);
  const addUri = () => {listLinks.value.push([])}
  const removeUri = () => {listLinks.value.pop()}

  // Fresh registry, or a new snapshot on one that already exists. The second is
  // what stops a returning user silently dropping their own history.
  const mode = ref<"new" | "update">("new");
  const loadedText = ref("");
  const loadedFileName = ref("");
  const loadedBase = ref<Registry | null>(null);
  const loadedInfo = ref<Prefill | null>(null);
  const loadError = ref("");
  const committedHash = ref("");
  // prefilled with nextVersion, editable because a change this app cannot see
  // (an identity removed by hand) is a major
  const versionMajor = ref("");
  const versionMinor = ref("");
  const versionPatch = ref("");

  function loadRegistry(text: string) {
    loadedText.value = text;
    if (!text.trim()) { clearLoaded(); return }
    const result = parseRegistry(text);
    if ("error" in result) {
      loadError.value = result.error;
      loadedBase.value = null;
      loadedInfo.value = null;
      committedHash.value = "";
      return
    }
    const prefill = prefillFrom(result.registry, new Date().toISOString());
    if (!prefill) {
      loadError.value = "That registry has no identities to update.";
      loadedBase.value = null;
      loadedInfo.value = null;
      return
    }
    loadError.value = "";
    loadedBase.value = result.registry;
    loadedInfo.value = prefill;
    generatedAt.value = null;

    const next = nextVersion(result.registry);
    versionMajor.value = String(next.major);
    versionMinor.value = String(next.minor);
    versionPatch.value = String(next.patch);

    tokenId.value = prefill.authbase;
    tokenName.value = prefill.name;
    tokenDescription.value = prefill.description;
    tokenSymbol.value = prefill.symbol;
    tokenDecimals.value = prefill.decimals;
    iconUri.value = prefill.iconUri;
    webUrl.value = prefill.webUrl;
    listLinks.value = prefill.listLinks.map(([key, value]) => [key, value] as [string, string]);
    hasNftFields.value = false; // an existing nfts block is carried over as it is

    void hashBytes(new TextEncoder().encode(text)).then((hex) => { committedHash.value = hex });
  }

  // a count of one reads badly through inline ternaries, so the whole sentence agrees here
  const unorderableNote = computed(() => {
    const count = loadedInfo.value?.unorderable ?? 0;
    if (!count) return null
    return count === 1
      ? {
          lead: "1 snapshot on this identity has a timestamp that is not the spec's",
          rest: "It is kept in the file untouched, but it cannot be ordered, so it is left out of working out which snapshot is the current one.",
        }
      : {
          lead: `${count} snapshots on this identity have timestamps that are not the spec's`,
          rest: "They are kept in the file untouched, but they cannot be ordered, so they are left out of working out which snapshot is the current one.",
        }
  });

  // the identity being updated already carries a token, and a category is a consensus
  // fact, so the kind cannot be changed: lock it rather than ignore the switch silently
  const tokenLocked = computed(() => Boolean(loadedInfo.value?.hasToken));

  // Every label, tip and example that changes with the kind, in one place: a token's
  // wording reads as nonsense on a contract system or an organization.
  const copy = computed(() => hasToken.value
    ? {
        idLabel: "TokenId",
        idTip: "The token's category id: 64 hex characters, shown as the category by any wallet holding the token.",
        nameLabel: "Token Name",
        nameTip: "The name wallets show for this token. Interfaces with limited space may hide it beyond the first 20 characters, so lead with what identifies it.",
        descriptionLabel: "Token Description",
        descriptionTip: "A sentence or two about the token. Interfaces with limited space may hide it beyond 140 characters.",
        name: "DogeCash",
        description: "Don't let your dreams be memes",
        icon: "https://example.com/Dogecoin_Logo.png",
        web: "https://example.com",
      }
    : {
        idLabel: "Authbase",
        idTip: "The identity's permanent id: 64 hex characters, the transaction its authchain starts from.",
        nameLabel: "Name",
        nameTip: "The name shown for this identity. Interfaces with limited space may hide it beyond the first 20 characters, so lead with what identifies it.",
        descriptionLabel: "Description",
        descriptionTip: "A sentence or two about this identity. Interfaces with limited space may hide it beyond 140 characters.",
        name: "ACME DEX",
        description: "The decentralized exchange contract system operated by ACME, Inc.",
        icon: "https://acme.example/logo.svg",
        web: "https://acme.example",
      });

  watch(advanced, (on) => {
    if (on) return
    hasToken.value = true;
    registryName.value = "";
    registryDescription.value = "";
    registryAuthbase.value = "";
  });
  watch(tokenLocked, (locked) => { if (locked) hasToken.value = true });

  function clearLoaded() {
    loadedText.value = "";
    loadedBase.value = null;
    loadedInfo.value = null;
    loadError.value = "";
    committedHash.value = "";
    loadedFileName.value = "";
    versionMajor.value = "";
    versionMinor.value = "";
    versionPatch.value = "";
    generatedAt.value = null;
  }

  function onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return
    loadedFileName.value = file.name;
    void file.text().then(loadRegistry);
  }

  // The timestamp the current preview was generated with, and the flag for whether
  // there is a preview at all. Frozen on Generate rather than recomputed, so editing
  // a field afterwards does not keep moving the registry's latestRevision.
  const generatedAt = ref<string | null>(null);
  const validationError = ref("");

  function buildDetails(date: string): DetailsObj {
    return {
      date,
      registryIdentityName: registryName.value || `bcmr for ${tokenName.value}`,
      registryIdentityDescription: registryDescription.value || `self-published bcmr for ${tokenName.value}`,
      registryIdentityAuthbase: advanced.value ? registryAuthbase.value : "",
      hasToken: advanced.value ? hasToken.value : true,
      tokenId: tokenId.value,
      tokenName: tokenName.value,
      tokenDescription: tokenDescription.value,
      tokenSymbol: tokenSymbol.value,
      iconUri: iconUri.value,
      tokenDecimals: tokenDecimals.value,
      hasNftFields: hasNftFields.value,
      numberNFTs: numberNFTs.value,
      numbering: numbering.value,
      startingNumber: startingNumber.value,
      nftName: nftName.value,
      nftDescription: nftDescription.value,
      nftIconUri: nftIconUri.value,
      nftIconType: nftIconType.value,
      hasNftImages: hasImages.value,
      webUrl: webUrl.value,
      listLinks: listLinks.value,
    }
  }

  // The preview tracks the form once it exists, so what is shown and what is
  // downloaded can never drift apart. That matters more than usual here: the hash
  // below is what a BCMR publication commits to on-chain.
  // held back until the first generate, so an untouched form is not a wall of red
  const showErrors = ref(false);
  const issues = computed(() => validateDetails(buildDetails("1970-01-01T00:00:00.000Z")));
  function issueFor(field: string): string | undefined {
    return showErrors.value ? issues.value.find((i) => i.field === field)?.message : undefined
  }

  function versionPart(input: string, fallback: number): number {
    const parsed = parseInt(input, 10);
    return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed
  }

  const registry = computed(() => {
    if (!generatedAt.value) return null
    const fresh = generateBcmr(buildDetails(generatedAt.value));
    const base = loadedBase.value;
    if (!base) return fresh
    const fallback = nextVersion(base);
    return applyUpdate(base, fresh, tokenId.value, generatedAt.value, {
      major: versionPart(versionMajor.value, fallback.major),
      minor: versionPart(versionMinor.value, fallback.minor),
      patch: versionPart(versionPatch.value, fallback.patch),
    })
  });

  const registryJson = computed(() =>
    registry.value ? JSON.stringify(registry.value, null, 2) : ""
  );

  // the exact bytes the download writes, and so the bytes the hash covers
  const registryBytes = computed(() => new TextEncoder().encode(registryJson.value));

  const nftTypeCount = computed(() => {
    const types = registry.value?.identities?.[tokenId.value]?.[generatedAt.value ?? ""]
      ?.token?.nfts?.parse.types;
    return types ? Object.keys(types).length : 0;
  });

  const byteSize = computed(() => {
    const bytes = registryBytes.value.length;
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
  });

  // A big collection is tens of thousands of lines, which is no use as a preview and
  // slow to paint. Keep the head and the tail: the tail is where an off-by-one in the
  // NFT numbering shows up, so truncating only the end would hide the likeliest mistake.
  const HEAD_LINES = 300;
  const TAIL_LINES = 60;
  const previewJson = computed(() => {
    const lines = registryJson.value.split("\n");
    if (lines.length <= HEAD_LINES + TAIL_LINES) return registryJson.value;
    const hidden = lines.length - HEAD_LINES - TAIL_LINES;
    return [
      ...lines.slice(0, HEAD_LINES),
      ``,
      `    ... ${hidden.toLocaleString()} lines hidden, the download holds the full file ...`,
      ``,
      ...lines.slice(-TAIL_LINES),
    ].join("\n");
  });

  // sha256 over the file's bytes, hex, not reversed: the same hash a wallet checks a
  // published registry against. Web Crypto rather than libauth's sha256 on purpose,
  // since libauth's crypto entrypoints would pull a wasm module into the bundle.
  async function hashBytes(bytes: Uint8Array): Promise<string> {
    if (!bytes.length || !globalThis.crypto?.subtle) return ""
    const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("")
  }

  const fileHash = ref("");
  let hashToken = 0;
  watch(registryBytes, async (bytes) => {
    const token = ++hashToken;
    const hex = await hashBytes(bytes);
    if (token !== hashToken) return // a newer edit already won
    fileHash.value = hex;
  }, { immediate: true });

  function generateBcmrFile(){
    showErrors.value = true;
    const date = new Date().toISOString();
    if(mode.value === "update" && !loadedBase.value){
      validationError.value = "Load the registry you are updating first.";
      generatedAt.value = null;
      return
    }
    const found = validateDetails(buildDetails(date));
    if(found.length){
      validationError.value = found.length === 1
        ? "Fix the highlighted field, then generate."
        : `Fix the ${found.length} highlighted fields, then generate.`;
      generatedAt.value = null;
      // 2. the button is at the foot of a long form, so the first bad field is
      // usually off-screen above it: take the user there rather than describing it
      void nextTick().then(() => {
        const firstError = document.querySelector(".fieldError");
        if (!firstError) return
        firstError.scrollIntoView({ block: "center", behavior: "smooth" });
        const previous = firstError.previousElementSibling;
        const input = previous instanceof HTMLInputElement ? previous : previous?.querySelector("input");
        input?.focus({ preventScroll: true });
      });
      return
    }
    validationError.value = "";
    generatedAt.value = date;
  }

  function downloadFile(){
    if(!registryJson.value) return
    // a Blob rather than a data: URI, which has a length limit a large NFT
    // collection can exceed
    const blob = new Blob([registryBytes.value], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const element = document.createElement('a');
    element.href = url;
    element.download = 'bcmr.json';
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  }

  const copied = ref(false);
  async function copyJson(){
    try {
      await navigator.clipboard.writeText(registryJson.value);
      copied.value = true;
      setTimeout(() => { copied.value = false }, 1500);
    } catch {
      // clipboard blocked; the download is still there
    }
  }

</script>

<template>
  <ThemeToggle />
  <main>
    <header class="pageHead">
      <h1>BCMR Generator</h1>
      <p class="lead">
        Give your CashTokens a name, a symbol and an icon in every wallet that reads BCMR.
      </p>
      <p class="leadMeta">
        Fill in the form, check the preview, publish the hash on-chain.
        <span class="leadDot" aria-hidden="true">·</span>
        <a href="https://cashtokens.org/docs/category/metadata-registries-chip" target="_blank" rel="noopener">What is BCMR? &rarr;</a>
      </p>
    </header>
    <div class="modeRow">
      <div class="modePill">
        <button type="button" :class="{ active: mode === 'new' }" @click="mode = 'new'; clearLoaded()">New registry</button>
        <button type="button" :class="{ active: mode === 'update' }" @click="mode = 'update'">Update existing</button>
      </div>
      <label class="advancedToggle">
        <InfoTip text="Simple mode self-publishes metadata for one token. Advanced is for maintaining a registry: identities that are not tokens, and control of the registry's own identity rather than the name derived for you.">Advanced</InfoTip>
        <ToggleSwitch v-model="advanced" />
      </label>
    </div>
    <div class="modeNote">
      <template v-if="advanced">Registry author: name the registry itself, and describe identities that are not tokens.</template>
      <template v-else-if="mode === 'new'">A fresh registry naming a single token.</template>
      <template v-else>Adds a snapshot to a registry you already published.</template>
    </div>

    <div v-if="advanced" class="advancedBox">
      <div class="advancedStep">1. The registry itself</div>
      <div class="loadLead">
        How this registry names itself. Left empty, both fields are derived from the name
        below, which suits a self-published registry and not an organization's.
      </div>

      <div>Registry name</div>
      <input v-model="registryName" :disabled="Boolean(registryAuthbase)" :placeholder="`bcmr for ${tokenName || copy.name}`">
      <div>Registry description</div>
      <input v-model="registryDescription" :disabled="Boolean(registryAuthbase)" :placeholder="`self-published bcmr for ${tokenName || copy.name}`">

      <div class="orRule"><span>or</span></div>

      <div>
        <InfoTip text="The spec lets a registry name its own identity by authbase rather than describing it here. Clients then verify who publishes the registry on-chain and read its details from that identity, instead of trusting it because of where the file is hosted.">Identify the registry on-chain</InfoTip>
      </div>
      <input v-model="registryAuthbase" :class="{ invalid: issueFor('registryIdentityAuthbase') }" placeholder="its authbase, 64 hex characters">
      <div v-if="issueFor('registryIdentityAuthbase')" class="fieldError">{{ issueFor('registryIdentityAuthbase') }}</div>

      <div class="advancedStep stepTwo">2. The identity you are describing</div>
      <div class="kindRow">
        <InfoTip text="Off for a person, organization, dapp or contract system: the spec omits the token block entirely for those, and symbol, decimals and NFTs go with it.">This identity has a token</InfoTip>
        <ToggleSwitch v-model="hasToken" :disabled="tokenLocked" />
        <span v-if="tokenLocked" class="kindLocked">locked: this identity already has one, and a category is permanent</span>
      </div>
      <div class="loadLead" style="margin: 6px 0 0;">
        Off leaves a name, a description and URIs: a person, organization, dapp or contract
        system. The fields for it are below.
      </div>
    </div>

    <div v-if="mode === 'update'" class="loadBox">
      <div class="loadLead">
        Paste the registry you published, or load the file. Everything in it is kept: other
        identities, earlier snapshots, and fields this form does not show.
      </div>
      <textarea
        class="loadInput"
        rows="4"
        placeholder='{ "$schema": "https://cashtokens.org/bcmr-v2.schema.json", ... }'
        :value="loadedText"
        @input="loadRegistry(($event.target as HTMLTextAreaElement).value)"
      ></textarea>
      <div class="loadActions">
        <label class="secondaryButton">
          Choose file
          <input class="fileInput" type="file" accept="application/json,.json" @change="onFile">
        </label>
        <span v-if="loadedFileName" class="loadFileName">{{ loadedFileName }}</span>
        <button v-if="loadedText" type="button" class="secondaryButton" @click="clearLoaded">Clear</button>
      </div>
      <div v-if="loadError" class="formError">{{ loadError }}</div>
      <div v-else-if="loadedInfo" class="loadSummary">
        Loaded version {{ loadedBase?.version.major }}.{{ loadedBase?.version.minor }}.{{ loadedBase?.version.patch }},
        {{ loadedInfo.identityCount }} identit{{ loadedInfo.identityCount === 1 ? 'y' : 'ies' }},
        {{ loadedInfo.snapshotCount }} snapshot{{ loadedInfo.snapshotCount === 1 ? '' : 's' }} on this one.
        Generating adds a snapshot and bumps the minor version.
        <template v-if="loadedInfo.keepsNfts"> Its existing NFT types are carried over as they are.</template>
        <div v-if="loadedInfo.identityCount > 1" class="loadWarning">
          This registry names {{ loadedInfo.identityCount }} identities. The one in the
          {{ copy.idLabel }} field below is the one being updated; the others are kept
          exactly as they are. Authoring several identities here is not built yet.
        </div>
        <div v-if="unorderableNote" class="loadWarning">
          {{ unorderableNote.lead }} <code>YYYY-MM-DDTHH:mm:ss.sssZ</code> form.
          {{ unorderableNote.rest }}
        </div>
        <div class="versionRow">
          <span>New version</span>
          <input v-model="versionMajor" type="number" min="0" aria-label="major">
          <span class="versionDot">.</span>
          <input v-model="versionMinor" type="number" min="0" aria-label="minor">
          <span class="versionDot">.</span>
          <input v-model="versionPatch" type="number" min="0" aria-label="patch">
          <InfoTip text="The spec's rule: major when an identity is removed, minor when an identity or snapshot is added, patch when an existing snapshot or a registry property is corrected. Adding a snapshot is what this does, so minor is filled in for you.">what these mean</InfoTip>
        </div>
      </div>
    </div>

    <div class="firstFieldRow">
      <span><InfoTip :text="copy.idTip">{{ copy.idLabel }}</InfoTip> *</span>
      <span class="requiredNote">* marks a required field</span>
    </div>
    <input v-model="tokenId" :class="{ invalid: issueFor('tokenId') }" placeholder="8473d94f604de351cdee3030f6c354d36b257861ad8e95bbc0a06fbab2a2f5b7">
    <div v-if="issueFor('tokenId')" class="fieldError">{{ issueFor('tokenId') }}</div>
    <div><InfoTip :text="copy.nameTip">{{ copy.nameLabel }}</InfoTip> *</div>
    <input  v-model="tokenName" :class="{ invalid: issueFor('tokenName') }" :placeholder="copy.name">
    <div v-if="issueFor('tokenName')" class="fieldError">{{ issueFor('tokenName') }}</div>
    <div><InfoTip :text="copy.descriptionTip">{{ copy.descriptionLabel }}</InfoTip> *</div>
    <input v-model="tokenDescription" :class="{ invalid: issueFor('tokenDescription') }" :placeholder="copy.description">
    <div v-if="issueFor('tokenDescription')" class="fieldError">{{ issueFor('tokenDescription') }}</div>
    <div v-if="hasToken"><InfoTip text="Capital letters, numbers and dashes only, matching /^[-A-Z0-9]+$/ in the spec. This is the ticker wallets show next to an amount.">Token Symbol</InfoTip> *</div>
    <input v-if="hasToken" v-model="tokenSymbol" :class="{ invalid: issueFor('tokenSymbol') }" placeholder="DOGECASH">
    <div v-if="hasToken && issueFor('tokenSymbol')" class="fieldError">{{ issueFor('tokenSymbol') }}</div>
    <div><InfoTip text="Must be a full URI including the scheme, e.g. https://... or ipfs://... A bare domain or path will not resolve. Clients are only required to support https and ipfs.">Link Icon (https or ipfs)</InfoTip></div>
    <input v-model="iconUri" :class="{ invalid: issueFor('iconUri') }" :placeholder="copy.icon">
    <div v-if="issueFor('iconUri')" class="fieldError">{{ issueFor('iconUri') }}</div>
    <div v-if="hasToken"><InfoTip text="How divisible one token is: 0 to 18. With decimals of 2 an on-chain amount of 123456 is shown as 1234.56. Leave empty for 0, which is what an NFT-only category wants.">Decimals</InfoTip> (suggested to not use more than 8)</div>
    <input v-if="hasToken" v-model="tokenDecimals" type="number" :class="{ invalid: issueFor('tokenDecimals') }" placeholder="0">
    <div v-if="hasToken && issueFor('tokenDecimals')" class="fieldError">{{ issueFor('tokenDecimals') }}</div>

    <div v-if="hasToken"><InfoTip text="Turn on if this category also issues NFTs. It adds an nfts block listing every NFT type by its on-chain commitment.">Has NFTs</InfoTip> <ToggleSwitch v-model="hasNftFields" /></div>

    <div v-if="hasToken && hasNftFields" style="margin-left: 25px;">
      <div><InfoTip text="How many NFT entries to write, counting up from the starting number. One entry per commitment, so this is the size of the collection.">Number of unique NFTs</InfoTip> *</div>
      <input v-model="numberNFTs" type="number" :class="{ invalid: issueFor('numberNFTs') }" placeholder="10">
    <div v-if="issueFor('numberNFTs')" class="fieldError">{{ issueFor('numberNFTs') }}</div>
      <div><InfoTip text="How each NFT's number becomes its on-chain commitment. VM-numbers is the spec's sequential encoding and what wallets expect: it is zero-based, so NFT 1 has an empty commitment, 2 is 01, and 129 is 8000 rather than 81. Hex is plain big-endian and only for old Cashonize collections.">Numbering on-chain</InfoTip></div>
      <select name="numbering" v-model="numbering" style="width: 350px;">
        <option value="vm-numbers">VM-numbers (default)</option>
        <option value="hex">hexadecimal (for old Cashonize collections)</option>
      </select>
      <div><InfoTip text="The number the first NFT carries, usually 1. It shifts both the names and the commitments, so it has to match how the collection was actually minted.">StartingNumber</InfoTip> *</div>
      <input v-model="startingNumber" type="number" :class="{ invalid: issueFor('startingNumber') }" placeholder="1">
    <div v-if="issueFor('startingNumber')" class="fieldError">{{ issueFor('startingNumber') }}</div>
      <div><InfoTip text="Written for every NFT in the collection, with {i} replaced by that NFT's number: ABC #{i} becomes ABC #1, ABC #2 and so on.">NFT Name</InfoTip> * ( <code>{i}</code> will be replaced by the NFT number)</div>
      <input v-model="nftName" :class="{ invalid: issueFor('nftName') }" placeholder="ABC collection #{i}">
    <div v-if="issueFor('nftName')" class="fieldError">{{ issueFor('nftName') }}</div>
      <div><InfoTip text="Same {i} substitution as the name. Optional: leave it empty and the NFTs get no description.">NFT Description</InfoTip> ( <code>{i}</code> will be replaced by the NFT number)</div>
      <input v-model="nftDescription" placeholder="Number {i} of the ABC collection with 500 NFTs">
      <b>Image folder:</b> The image folder should have the 400x400 NFT icons named as <code>1.png</code>,
      <code>2.png</code>, etc.<br />
      <span style="margin-left: 10px;">Optional high-res images should be included as <code>1-img.png</code>,
        <code>2-img.png</code>, etc.<br /></span>
      <div><InfoTip text="The folder holding the numbered images, as a full URI with its scheme and no trailing slash: each NFT's icon is this plus /1.png, /2.png and so on.">Link Image Folder (https or ipfs)</InfoTip></div>
      <input v-model="nftIconUri" :class="{ invalid: issueFor('nftIconUri') }" placeholder="ipfs://bafybeifz7yag2hlxvmaahyo5kl5etajycxtxsryadcawzt4dgy3hrzzxdq">
    <div v-if="issueFor('nftIconUri')" class="fieldError">{{ issueFor('nftIconUri') }}</div>
      <div><InfoTip text="The file extension of the images in the folder, without the dot. It is appended to every NFT number, so all the files have to share it.">Image Type</InfoTip> (png, svg, ...)</div>
      <input v-model="nftIconType" :class="{ invalid: issueFor('nftIconType') }" placeholder="png">
    <div v-if="issueFor('nftIconType')" class="fieldError">{{ issueFor('nftIconType') }}</div>
      <div>
        <InfoTip text="Adds an image URI beside each icon, pointing at {i}-img in the same folder, for wallets that can show something larger than the 400x400 icon.">Has High-resolution Image for NFTs</InfoTip> (besides 400x400px icon)
        <ToggleSwitch v-model="hasImages" />
      </div>
    </div>

    <div><InfoTip text="The project's own site, published as the web URI. Needs the full URL including https://.">Link website</InfoTip></div>
    <input v-model="webUrl" :class="{ invalid: issueFor('webUrl') }" :placeholder="copy.web">
    <div v-if="issueFor('webUrl')" class="fieldError">{{ issueFor('webUrl') }}</div>
    <div style="margin: 5px 0;"><InfoTip text="Extra places this identity lives, keyed by the spec's standard names. Each value is a full URI with its scheme, so a social link is the profile URL, not a handle.">Extra Links</InfoTip>
      <button @click="removeUri" type="button" style="padding: 3px 5px; vertical-align: text-top; margin: 0 5px;">-</button>
      <button @click="addUri" type="button" style="padding: 3px 5px; vertical-align: text-top;">+</button>
    </div>

    <div v-for="(uriItem, index) of listLinks" v-bind:key="index">
      <div style="display: flex; margin-top: 10px;">
        <select name="uriSelect"  @change="(event) => listLinks[index][0] = (event.target as HTMLInputElement).value"  style="width: 150px; display: inline-block;">
          <option value="">- select -</option>
          <option value="image">full image</option>
          <option value="blog">blog</option>
          <option value="chat">chat</option>
          <option value="forum">forum</option>
          <option value="support">support</option>
          <option value="twitter">twitter</option>
          <option value="telegram">telegram</option>
          <option value="reddit">reddit</option>
          <option value="discord">discord</option>
          <option value="youtube">youtube</option>
          <option value="instagram">instagram</option>
        </select>
        <input placeholder="https://example.com" @input="(event) => listLinks[index][1] = (event.target as HTMLInputElement).value">
      </div>
      <div v-if="issueFor(`listLinks.${index}`)" class="fieldError">{{ issueFor(`listLinks.${index}`) }}</div>
    </div>

    <input @click="generateBcmrFile" class="button primary" type="button" style="margin-top:15px" :value="mode === 'update' ? 'Generate updated BCMR' : 'Generate BCMR json file'">

    <div v-if="validationError" class="formError">{{ validationError }}</div>

    <section v-if="registry" class="preview">
      <div class="previewHead">
        <div>
          <b>Generated registry</b>
          <span class="previewMeta">
            {{ byteSize }}<template v-if="nftTypeCount"> · {{ nftTypeCount.toLocaleString() }} NFT types</template>
          </span>
        </div>
        <div class="previewActions">
          <button @click="copyJson" type="button" class="secondaryButton">{{ copied ? 'Copied' : 'Copy JSON' }}</button>
          <input @click="downloadFile" class="button primary" type="button" value="Download bcmr.json">
        </div>
      </div>

      <div v-if="fileHash" class="hashBox">
        <template v-if="committedHash">
          <div class="hashLabel">SHA-256 currently published (the file you loaded)</div>
          <code class="hashValue">{{ committedHash }}</code>
        </template>
        <div class="hashLabel" :style="committedHash ? 'margin-top: 10px;' : ''">
          SHA-256 of this file{{ committedHash ? ', to publish next' : '' }}
        </div>
        <code class="hashValue">{{ fileHash }}</code>
        <div class="hashNote">
          This is the hash a BCMR publication commits to on-chain. Publish it only for the
          exact file you host: re-generating after any edit, this timestamp included, changes it.
        </div>
      </div>

      <pre class="previewJson">{{ previewJson }}</pre>
    </section>

    <footer>
      <a class="footerLink" href="https://github.com/cashonize/bcmr-generator" target="_blank" rel="noopener">
        <svg class="footerIcon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        View source on GitHub
      </a>

      <span class="footerDot" aria-hidden="true">·</span>

      <a class="footerLink" href="https://x.com/GeukensMathieu" target="_blank" rel="noopener">
        Made with
        <svg class="footerHeart" viewBox="0 0 24 24" fill="currentColor" aria-label="love" role="img">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
        by Mathieu G.
      </a>
    </footer>

  </main>
</template>
