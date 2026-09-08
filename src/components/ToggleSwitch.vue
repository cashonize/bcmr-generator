<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label class="switch" :class="{ on: model }">
    <input type="checkbox" role="switch" v-model="model">
    <span class="switchTrack" aria-hidden="true"></span>
    <span class="switchThumb" aria-hidden="true"></span>
  </label>
</template>

<style scoped>
/*
 * Pill toggle matching the one in Cashonize, which restyles Quasar's q-toggle
 * to these proportions (34.5x19.5 with a 15px knob at 30px font-size). Built on
 * a native checkbox, so keyboard, focus and form semantics come for free.
 */
/* cashonize's own .q-toggle rule: inline-flex sitting on vertical-align middle,
   which is defined against font metrics (baseline + half an x-height) and so
   tracks the text, unlike flex centring on the line box */
.switch {
  position: relative;
  display: inline-flex;
  vertical-align: middle;
  margin-left: 1px;
  width: 34.5px;
  height: 19.5px;
  cursor: pointer;
  color: var(--font-color);
}
.switch.on {
  color: var(--color-primary);
}

/* kept focusable, just not visible */
.switch input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
}

.switchTrack {
  position: absolute;
  inset: 0;
  border-radius: 9.75px;
  background: #e0e0e0;
  transition: background-color 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

/* the knob sits inside the pill and stays white in both states. Split into two
   pseudo-elements the way Quasar does: ::before is the hover halo, ::after the
   knob itself, so the knob paints over the halo and only its ring shows. */
.switchThumb {
  position: absolute;
  top: 2.25px;
  left: 1.5px;
  width: 15px;
  height: 15px;
  transition: left 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
.switchThumb::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.12;
  transform: scale(0);
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
.switchThumb::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
/* 1.5x is the scale Quasar uses for its dense toggle, which is the one here */
.switch:hover .switchThumb::before,
.switch input:focus-visible ~ .switchThumb::before {
  transform: scale(1.5);
}

.switch.on .switchTrack {
  background: var(--color-primary);
}
.switch.on .switchThumb {
  left: 18px;
}

.switch input:focus-visible ~ .switchTrack {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* scoped to the off state, the way cashonize scopes its own dark track rule
   with :not(--truthy): unscoped it ties .switch.on on specificity and, coming
   later, would keep the track grey when the toggle is on */
:root[data-theme="dark"] .switch:not(.on) .switchTrack {
  background: #5c6166;
}

@media (prefers-reduced-motion: reduce) {
  .switchTrack,
  .switchThumb,
  .switchThumb::before {
    transition: none;
  }
}
</style>
