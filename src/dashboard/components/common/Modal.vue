<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-overlay" @click.self="onOverlayClick" @keydown.esc="onEsc">
        <div
          class="modal-box"
          :class="{ 'modal-flat': flat }"
          :style="{ width: typeof width === 'number' ? `${width}px` : width, maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth }"
          role="dialog"
          aria-modal="true"
        >
          <div v-if="title || $slots.header || closable" class="modal-header">
            <slot name="header">
              <div class="modal-title-group">
                <h3 v-if="title" class="modal-title">{{ title }}</h3>
                <p v-if="subtitle" class="modal-subtitle">{{ subtitle }}</p>
              </div>
            </slot>
            <button v-if="closable" class="modal-close" @click="onClose" aria-label="关闭">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onMounted, onBeforeUnmount } from 'vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    width?: number | string;
    maxWidth?: number | string;
    title?: string;
    subtitle?: string;
    closable?: boolean;
    overlayClosable?: boolean;
    flat?: boolean;
  }>(),
  {
    width: 'auto',
    maxWidth: '92vw',
    closable: true,
    overlayClosable: true,
    flat: false,
  },
);

const emit = defineEmits<{ close: []; 'overlay-click': [] }>();

function onClose() {
  emit('close');
}

function onOverlayClick() {
  emit('overlay-click');
  if (props.overlayClosable && props.closable) onClose();
}

function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open && props.closable) onClose();
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  },
);

function handleEsc(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open && props.closable) onClose();
}

onMounted(() => document.addEventListener('keydown', handleEsc));
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEsc);
  document.body.style.overflow = '';
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 38, 0.35);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: 24px;
}

.modal-box {
  background: var(--bg-pure);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-xl), 0 0 40px -16px var(--glow);
  width: 480px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
}
.modal-flat { box-shadow: var(--shadow-lg); }

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--gap-md);
  padding: 20px 24px 12px;
  flex-shrink: 0;
}
.modal-title-group { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.modal-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  letter-spacing: -0.2px;
  line-height: 1.3;
}
.modal-subtitle {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  line-height: 1.5;
}
.modal-close {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition-fast);
  flex-shrink: 0;
}
.modal-close:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.modal-close i { font-size: var(--text-sm); }

.modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 24px 20px;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--gap-md);
  padding: 16px 24px 20px;
  border-top: 1px solid var(--border-soft);
  flex-shrink: 0;
}

.modal-enter-active { transition: opacity .18s ease; }
.modal-leave-active { transition: opacity .16s ease; }
.modal-enter-active .modal-box { transition: transform .3s cubic-bezier(.3,1.3,.45,1), opacity .3s ease; }
.modal-leave-active .modal-box { transition: transform .16s ease, opacity .16s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal-box { transform: translateY(16px) scale(.95); opacity: 0; }
.modal-leave-to .modal-box { transform: translateY(8px) scale(.97); opacity: 0; }
</style>
