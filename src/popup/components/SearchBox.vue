<template>
  <div class="search-box">
    <i class="fa-solid fa-terminal search-icon"></i>
    <input
      ref="inputRef"
      :value="query"
      type="text"
      placeholder="搜索系统 / URL / 标签 / 账号…"
      @input="onInput"
    />
    <span class="kbd shortcut-kbd">{{ shortcutKey }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSearchStore } from '@shared/stores/searchStore';
import { storeToRefs } from 'pinia';

const searchStore = useSearchStore();
const { query } = storeToRefs(searchStore);

const inputRef = ref<HTMLInputElement | null>(null);
const shortcutKey = navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K';

onMounted(() => {
  inputRef.value?.focus();
});

function onInput(e: Event) {
  searchStore.search((e.target as HTMLInputElement).value);
}
</script>

<style scoped>
.search-box {
  position: relative;
  padding: var(--gap-sm) var(--gap-md);
}
.search-icon {
  position: absolute;
  left: 26px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--accent);
  font-size: var(--text-sm);
  pointer-events: none;
}
.search-box input {
  width: 100%;
  height: 40px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  padding: 0 56px 0 40px;
  font-size: var(--text-sm);
  outline: none;
  font-family: inherit;
  background: var(--surface-secondary);
  color: var(--text-primary);
  transition: var(--transition-fast);
}
.search-box input::placeholder { color: var(--text-quaternary); }
.search-box input:hover { border-color: var(--text-quaternary); }
.search-box input:focus {
  border-color: var(--accent);
  box-shadow: var(--shadow-focus);
  background: var(--bg-pure);
}
.shortcut-kbd {
  position: absolute;
  right: 26px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: var(--surface-secondary);
  padding: 2px 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: var(--font-medium);
  color: var(--text-tertiary);
  letter-spacing: 0.5px;
  pointer-events: none;
}
</style>
