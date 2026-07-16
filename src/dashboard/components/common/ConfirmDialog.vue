<template>
  <teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="onCancel">
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>{{ title }}</h3>
        </div>
        <div class="modal-body">
          <p>{{ message }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="onCancel">取消</button>
          <button class="btn btn-danger" @click="onConfirm">确认</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean; title: string; message: string }>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();

function onConfirm() { emit('confirm'); }
function onCancel() { emit('cancel'); }
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 10000; }
.modal-dialog { background: white; border-radius: 8px; padding: 20px; min-width: 360px; max-width: 480px; }
.modal-header h3 { margin: 0 0 12px; font-size: 15px; color: var(--text-primary); }
.modal-body p { margin: 0 0 16px; font-size: 13px; color: var(--text-secondary); }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; }
.btn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-default { background: white; color: #374151; border-color: var(--border); }
.btn-danger { background: white; color: #dc2626; border-color: #fecaca; }
.btn-danger:hover { background: #fef2f2; }
</style>
