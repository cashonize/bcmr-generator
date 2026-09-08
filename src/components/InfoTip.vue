<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <!-- tabindex so the tip is reachable by keyboard, and so a tap opens it on
       touch, where there is no hover -->
  <span class="infoTip" tabindex="0">
    <slot />
    <span class="infoTipBubble" role="note">{{ text }}</span>
  </span>
</template>

<style scoped>
/*
 * No marker on the label: every field carries a tip, so a per-label affordance
 * would just be noise on every line. The pointer cursor is the only hint.
 */
.infoTip {
  position: relative;
  cursor: pointer;
}
.infoTip:focus {
  outline: none;
}

.infoTipBubble {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 20;
  width: max-content;
  max-width: min(340px, 72vw);
  padding: 7px 12px;
  border-radius: 6px;
  /* dark in both themes, so a tip always reads as an overlay rather than as
     part of the form */
  background: #2d2d33;
  color: #f5f5f5;
  font-size: 13px;
  font-weight: normal;
  line-height: 1.5;
  text-decoration: none;
  white-space: normal;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease;
  pointer-events: none;
}
.infoTip:hover .infoTipBubble,
.infoTip:focus-visible .infoTipBubble {
  opacity: 1;
  visibility: visible;
}

@media (prefers-reduced-motion: reduce) {
  .infoTipBubble {
    transition: none;
  }
}
</style>
