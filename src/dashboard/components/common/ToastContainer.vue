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
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}
.toast {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  padding: 12px 16px;
  border-radius: var(--radius-lg);
  background: var(--bg-pure);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg), 0 0 24px -10px var(--glow);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  cursor: pointer;
  animation: slideIn .3s cubic-bezier(.3,1.2,.4,1);
  min-width: 220px;
  max-width: 360px;
}
.toast i { font-size: var(--text-base); }
.toast.success { border-color: var(--success); color: var(--success-text); }
.toast.success i { color: var(--success); }
.toast.error { border-color: var(--danger); color: var(--danger-text); }
.toast.error i { color: var(--danger); }
.toast.info { border-color: var(--primary); color: var(--primary); }
.toast.info i { color: var(--primary); }

@keyframes slideIn {
  from { transform: translateY(14px) scale(.95); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}
</style>
