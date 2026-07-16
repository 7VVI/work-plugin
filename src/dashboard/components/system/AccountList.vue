<template>
  <div class="account-section">
    <div class="form-section-title">账号信息</div>
    <div class="account-list">
      <div class="account-item header-row">
        <div>角色</div>
        <div>用户名</div>
        <div>密码</div>
        <div class="text-right">操作</div>
      </div>
      <div v-for="acc in accounts" :key="acc.id" class="account-item">
        <div>{{ acc.role }} <span v-if="acc.isDefault" class="default-badge">默认</span></div>
        <div>{{ acc.username }}</div>
        <div class="acc-pwd">{{ visibleIds.has(acc.id) ? plainPasswords[acc.id] : '••••••••' }}</div>
        <div class="acc-icons">
          <div class="row-action" @click="toggleVisible(acc.id)" :title="visibleIds.has(acc.id) ? '隐藏' : '显示'">
            <i :class="visibleIds.has(acc.id) ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'"></i>
          </div>
          <div class="row-action" @click="copyPassword(acc.id)" title="复制密码"><i class="fa-solid fa-copy"></i></div>
          <div class="row-action" @click="copyUsername(acc.username)" title="复制用户名"><i class="fa-solid fa-user"></i></div>
          <div class="row-action" @click="setDefault(acc.id)" v-if="!acc.isDefault" title="设为默认"><i class="fa-solid fa-star"></i></div>
          <div class="row-action danger" @click="$emit('delete', acc.id)" title="删除"><i class="fa-solid fa-trash"></i></div>
        </div>
      </div>
    </div>
    <button class="add-account-btn" @click="$emit('add')"><i class="fa-solid fa-plus"></i> 新增账号</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Account } from '@shared/types/entities';
import { accountService } from '@shared/services/accountService';
import { copyToClipboard } from '@shared/utils/clipboard';

const props = defineProps<{ accounts: Account[]; systemId: string }>();
defineEmits<{ add: []; delete: [id: string] }>();

const visibleIds = ref<Set<string>>(new Set());
const plainPasswords = ref<Record<string, string>>({});

watch(() => props.accounts, async (accounts) => {
  for (const acc of accounts) {
    if (visibleIds.value.has(acc.id) && !plainPasswords.value[acc.id]) {
      try {
        const { plainPassword } = await accountService.getDecrypted(acc.id);
        plainPasswords.value[acc.id] = plainPassword;
      } catch { /* locked */ }
    }
  }
}, { deep: true });

async function toggleVisible(id: string) {
  if (visibleIds.value.has(id)) {
    visibleIds.value.delete(id);
  } else {
    if (!plainPasswords.value[id]) {
      try {
        const { plainPassword } = await accountService.getDecrypted(id);
        plainPasswords.value[id] = plainPassword;
      } catch { return; }
    }
    visibleIds.value.add(id);
  }
}

async function copyPassword(id: string) {
  await accountService.copyPassword(id);
}

async function copyUsername(username: string) {
  await copyToClipboard(username);
}

function setDefault(id: string) {
  // emit to parent or call store
  void id;
}
</script>

<style scoped>
.account-section { margin-top: 14px; }
.form-section-title { font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
.account-list { border: 1px solid var(--border-soft); border-radius: 6px; overflow: hidden; }
.account-item { display: grid; grid-template-columns: 1fr 1fr 1.2fr 120px; align-items: center; padding: 7px 10px; font-size: 12px; border-bottom: 1px solid var(--border-soft); gap: 8px; }
.account-item:last-child { border-bottom: none; }
.account-item.header-row { background: #f9fafb; color: var(--text-secondary); font-size: 11px; font-weight: 500; }
.acc-pwd { letter-spacing: 1px; }
.acc-icons { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }
.row-action { width: 22px; height: 22px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); cursor: pointer; font-size: 11px; }
.row-action:hover { background: var(--border-soft); color: var(--primary); }
.row-action.danger:hover { color: var(--danger); }
.default-badge { font-size: 9px; padding: 0 4px; background: var(--warning-light); color: var(--warning-text); border-radius: 3px; margin-left: 4px; }
.add-account-btn { margin-top: 8px; font-size: 12px; color: var(--primary); background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; }
.add-account-btn:hover { color: var(--primary-700); }
</style>
