<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '../composables/useTheme'

const { theme, toggleTheme } = useTheme()

const label = computed(() =>
  theme.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
)
</script>

<template>
  <button
    class="themeToggle"
    type="button"
    :class="{ dark: theme === 'dark' }"
    :title="label"
    :aria-label="label"
    :aria-pressed="theme === 'dark'"
    @click="toggleTheme"
  >
    <span class="iconStack" aria-hidden="true">
      <svg class="icon sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 1.8v2.4M12 19.8v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M1.8 12h2.4M19.8 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7" />
      </svg>
      <svg class="icon moon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.7 14.6A8.7 8.7 0 0 1 9.4 3.3a1 1 0 0 0-1.3-1.2 10.7 10.7 0 1 0 13.8 13.8 1 1 0 0 0-1.2-1.3z" />
      </svg>
    </span>
  </button>
</template>

<style scoped>
/* floats over the page: the form has no header bar to sit in */
.themeToggle {
  position: fixed;
  top: 1.4rem;
  right: 1.4rem;
  z-index: 50;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--color-lightGrey);
  border-radius: 50%;
  background: var(--bg-secondary-color);
  color: var(--font-color);
  cursor: pointer;
  transition: transform 0.2s ease, background-color 0.3s ease, border-color 0.3s ease,
    color 0.3s ease;
}
.themeToggle:hover {
  transform: translateY(-1px);
  border-color: var(--color-grey);
}
.themeToggle:active {
  transform: scale(0.94);
}
.themeToggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}

/* the two glyphs sit on top of each other and swap with a little spin */
.iconStack {
  position: relative;
  display: block;
  width: 19px;
  height: 19px;
}
.icon {
  position: absolute;
  inset: 0;
  width: 19px;
  height: 19px;
  transition: opacity 0.28s ease, transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.sun {
  opacity: 0;
  transform: rotate(-70deg) scale(0.5);
}
.moon {
  opacity: 1;
  transform: rotate(0) scale(1);
}
.themeToggle.dark .sun {
  opacity: 1;
  transform: rotate(0) scale(1);
}
.themeToggle.dark .moon {
  opacity: 0;
  transform: rotate(70deg) scale(0.5);
}

@media (max-width: 600px) {
  .themeToggle {
    top: 1rem;
    right: 1rem;
    width: 37px;
    height: 37px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .themeToggle,
  .icon {
    transition: none;
  }
}
</style>
