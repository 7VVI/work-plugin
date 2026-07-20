<template>
  <teleport to="body">
    <div v-if="store.state.visible" class="dialog-overlay" @click.self="store.cancel()">
      <div class="dialog-box">
        <div class="dialog-header">
          <h3>{{ store.state.title }}</h3>
        </div>
        <div class="dialog-body">
          <p v-if="store.state.type === 'confirm'" class="dialog-message">{{ store.state.message }}</p>
          <input
            v-else
            v-model="inputValue"
            class="dialog-input"
            :placeholder="store.state.placeholder"
            @keyup.enter="store.ok()"
            ref="inputRef"
          />
        </div>
        <div class="dialog-footer">
          <button class="btn-cancel" @click="store.cancel()">取消</button>
          <button class="btn-ok" @click="store.ok()">{{ store.state.type === 'confirm' ? '确认' : '确定' }}</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useDialogStore } from '@shared/stores/dialogStore';

const store = useDialogStore();
const inputRef = ref<HTMLInputElement | null>(null);
const inputValue = ref('');

watch(() => store.state.visible, async (v) => {
  if (v) {
    inputValue.value = store.state.inputValue;
    if (store.state.type === 'prompt') {
      await nextTick();
      inputRef.value?.focus();
      inputRef.value?.select();
    }
  }
});

watch(inputValue, (v) => {
  store.state.inputValue = v;
});
</script>

<style scoped>
.dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 10002; }
.dialog-box { background: white; border-radius: 8px; padding: 20px; min-width: 360px; max-width: 420px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
.dialog-header h3 { margin: 0 0 12px; font-size: 15px; color: var(--text-primary); }
.dialog-body { margin-bottom: 16px; }
.dialog-message { margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
.dialog-input { width: 100%; height: 34px; border: 1px solid var(--border); border-radius: 6px; padding: 0 12px; font-size: 13px; outline: none; font-family: inherit; box-sizing: border-box; }
.dialog-input:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }
.dialog-footer { display: flex; gap: 8px; justify-content: flex-end; }
.btn-cancel, .btn-ok { height: 32px; padding: 0 16px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-cancel { background: var(--border-soft); color: var(--text-secondary); }
.btn-cancel:hover { background: var(--border); }
.btn-ok { background: var(--primary); color: white; }
.btn-ok:hover { background: var(--primary-700); }
</style>
