<template>
  <div class="toast-container">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type" @click="dismiss(t.id)">
      <i :class="iconFor(t.type)"></i>
      <span>{{ t.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from '@shared/stores/toastStore';
import { storeToRefs } from 'pinia';

const store = useToastStore();
const { toasts } = storeToRefs(store);
const { dismiss } = store;

function iconFor(type: string) {
  return {
    success: 'fa-solid fa-circle-check',
    error: 'fa-solid fa-circle-exclamation',
    info: 'fa-solid fa-circle-info',
  }[type] || 'fa-solid fa-circle-info';
}
</script>

<style scoped>
.toast-container { position: fixed; bottom: 16px; right: 16px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; }
.toast { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 6px; background: white; border: 1px solid var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.1); font-size: 13px; cursor: pointer; animation: slideIn 0.2s; }
.toast.success { border-color: var(--success); color: var(--success-text); }
.toast.error { border-color: var(--danger); color: var(--danger-text); }
.toast.info { border-color: var(--primary); color: var(--primary-700); }
@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
</style>
