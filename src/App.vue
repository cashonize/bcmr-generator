<script setup lang="ts">
  import { ref } from "vue"
  import { generateBcmr, validInputs } from "./generateBcmr"
  import Toggle from '@vueform/toggle'
  import ThemeToggle from './components/ThemeToggle.vue'
  import type { DetailsObj } from "./interfaces/interfaces";

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

  function createBcmrFile(){
    const date = new Date().toISOString();
    const registryIdentityName = `bcmr for ${tokenName.value}`;
    const registryIdentityDescription = `self-published bcmr for ${tokenName.value}`;

    // create object with all userInputs
    const details: DetailsObj = {
      date,
      registryIdentityName,
      registryIdentityDescription,
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
    const validDetailsObj = validInputs(details);
    if(!validDetailsObj){
      alert("Fill in all the required fields before generating the JSON file!");
      return
    }
    const bcmrJsonObj = generateBcmr(details);
    if(bcmrJsonObj) download(JSON.stringify(bcmrJsonObj,null, 2));
  }

  function download(stringifiedObj:string){
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(stringifiedObj));
    element.setAttribute('download', 'bcmr.json');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }
</script>

<template>
  <ThemeToggle />
  <main>
    <h1>BCMR Generator</h1>
    <div style="font-weight: bold; margin-bottom: 15px;">Generate the BCMR Json file for your CashTokens project!</div>
    <div style="display: flex;justify-content: space-between;">
      TokenId *
      <div>(*) means required</div>
    </div>
    <input v-model="tokenId" placeholder="8473d94f604de351cdee3030f6c354d36b257861ad8e95bbc0a06fbab2a2f">
    <div>Token Name *</div>
    <input  v-model="tokenName" placeholder="DogeCash">
    <div>Token Description *</div>
    <input v-model="tokenDescription" placeholder="Don't let your dreams be memes">
    <div>Token Symbol *</div>
    <input v-model="tokenSymbol" placeholder="DOGECASH">
    <div>Link Icon (https or ipfs)</div>
    <input v-model="iconUri" placeholder="https:/example.com/Dogecoin_Logo.png">
    <div>Decimals (suggested to not use more than 8)</div>
    <input v-model="tokenDecimals" type="number" placeholder="0">

    Has NFTs <Toggle v-model="hasNftFields" style="vertical-align: middle; toggleHeight: 18rem; display: inline-block;"/>

    <div v-if="hasNftFields" style="margin-left: 25px;">
      <div>Number of unique NFTs *</div>
      <input v-model="numberNFTs" type="number" placeholder="10">
      <div>Numbering on-chain</div>
      <select name="numbering" v-model="numbering" style="width: 350px;">
        <option value="vm-numbers">VM-numbers (default)</option>
        <option value="hex">hexadecimal (for old Cashonize collections)</option>
      </select>
      <div>StartingNumber *</div>
      <input v-model="startingNumber" type="number" placeholder="1">
      <div>NFT Name * ( <code>{i}</code> will be replaced by the NFT number)</div>
      <input v-model="nftName" placeholder="ABC collection #{i}">
      <div>NFT Description ( <code>{i}</code> will be replaced by the NFT number)</div>
      <input v-model="nftDescription" placeholder="Number {i} of the ABC collection with 500 NFTs">
      <b>Image folder:</b> The image folder should have the 400x400 NFT icons named as <code>1.png</code>,
      <code>2.png</code>, etc.<br />
      <span style="margin-left: 10px;">Optional high-res images should be included as <code>1-img.png</code>,
        <code>2-img.png</code>, etc.<br /></span>
      <div>Link Image Folder (https or ipfs)</div>
      <input v-model="nftIconUri" placeholder="ipfs://bafybeifz7yag2hlxvmaahyo5kl5etajycxtxsryadcawzt4dgy3hrzzxdq">
      <div>Image Type (png, svg, ...)</div>
      <input v-model="nftIconType" placeholder="png">
      <div>
        Has High-resolution Image for NFTs (besides 400x400px icon)
        <Toggle v-model="hasImages" style="vertical-align: middle; toggleHeight: 18rem; display: inline-block;"/>
      </div>
    </div>

    <div>Link website</div>
    <input v-model="webUrl" placeholder="https:/example.com">
    <div style="margin: 5px 0;">Extra Links
      <button @click="removeUri" type="button" style="padding: 3px 5px; vertical-align: text-top; margin-right: 5px;">-</button>
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
        <input placeholder="https:/example.com" @input="(event) => listLinks[index][1] = (event.target as HTMLInputElement).value">
      </div>
    </div>

    <input @click="createBcmrFile" class="button primary" type="button" style="margin-top:15px" value="Download BCMR json file">

    <footer id="githubLink">
      <a href="https://github.com/mr-zwets/bcmr-generator" target="_blank">
        <img class="githublogo" src="./assets/github.png" alt="Github logo">
      </a>
      <div style="margin-left: 10px;height: 35px;">
        <a href="https://github.com/mr-zwets/bcmr-generator" target="_blank">
          see GitHub code
        </a>
      </div>
    </footer>

  </main>
</template>

<style src="@vueform/toggle/themes/default.css"></style>