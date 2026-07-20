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
          <button class="btn btn-default" @click="store.cancel()">取消</button>
          <button class="btn btn-primary" @click="store.ok()">{{ store.state.type === 'confirm' ? '确认' : '确定' }}</button>
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
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-dialog-host);
  padding: 24px;
}
.dialog-box {
  background: var(--bg-pure);
  border-radius: var(--radius-xl);
  padding: 4px 0 0;
  min-width: 380px;
  max-width: 440px;
  width: auto;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-soft);
  overflow: hidden;
}
.dialog-header {
  padding: 20px 24px 8px;
}
.dialog-header h3 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  letter-spacing: -0.2px;
}
.dialog-body {
  padding: 8px 24px 8px;
  margin-bottom: 0;
}
.dialog-message {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--leading-normal);
}
.dialog-input {
  width: 100%;
  height: var(--control-h);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: 0 14px;
  font-size: var(--text-sm);
  outline: none;
  font-family: inherit;
  background: var(--bg-pure);
  color: var(--text-primary);
  box-sizing: border-box;
  transition: var(--transition-fast);
}
.dialog-input::placeholder { color: var(--text-quaternary); }
.dialog-input:focus {
  border-color: var(--primary);
  box-shadow: var(--shadow-focus);
}
.dialog-footer {
  display: flex;
  gap: var(--gap-md);
  justify-content: flex-end;
  padding: 16px 24px 20px;
  border-top: 1px solid var(--border-soft);
  margin-top: var(--gap-md);
}
</style>
