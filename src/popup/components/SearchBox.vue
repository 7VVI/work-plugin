<template>
  <div class="search-box">
    <i class="fa-solid fa-terminal search-icon"></i>
    <input
      ref="inputRef"
      :value="query"
      type="text"
      placeholder="搜索系统 / URL / 分组 / 标签 / 账号…"
      @input="onInput"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSearchStore } from '@shared/stores/searchStore';
import { storeToRefs } from 'pinia';

const searchStore = useSearchStore();
const { query } = storeToRefs(searchStore);

const inputRef = ref<HTMLInputElement | null>(null);

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
  padding: 0 16px 0 40px;
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
</style>
