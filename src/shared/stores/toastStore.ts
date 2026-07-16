import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([]);

  function show(message: string, type: Toast['type'] = 'info', duration = 4000) {
    const id = `${Date.now()}-${Math.random()}`;
    toasts.value.push({ id, message, type });
    setTimeout(() => dismiss(id), duration);
  }

  function success(message: string) { show(message, 'success'); }
  function error(message: string) { show(message, 'error'); }
  function info(message: string) { show(message, 'info'); }

  function dismiss(id: string) {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }

  return { toasts, show, success, error, info, dismiss };
});
