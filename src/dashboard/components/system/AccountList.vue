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
          <div class="row-action" @click="$emit('setDefault', acc.id)" v-if="!acc.isDefault" title="设为默认"><i class="fa-solid fa-star"></i></div>
          <div class="row-action danger" @click="$emit('delete', acc.id)" title="删除"><i class="fa-solid fa-trash"></i></div>
        </div>
      </div>
      <div v-if="accounts.length === 0 && !adding" class="empty-row">暂无账号，点击下方"新增账号"添加</div>
      <div v-if="adding" class="account-item edit-row">
        <input v-model="newAccount.role" class="cell-input" placeholder="角色" @keyup.enter="confirmAdd" />
        <input v-model="newAccount.username" class="cell-input" placeholder="用户名" @keyup.enter="confirmAdd" />
        <div class="pwd-cell">
          <input v-model="newAccount.password" :type="showNewPwd ? 'text' : 'password'" class="cell-input" placeholder="密码" @keyup.enter="confirmAdd" />
          <i :class="showNewPwd ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'" @click="showNewPwd = !showNewPwd"></i>
        </div>
        <div class="acc-icons">
          <div class="row-action confirm" @click="confirmAdd" title="确认"><i class="fa-solid fa-check"></i></div>
          <div class="row-action danger" @click="cancelAdd" title="取消"><i class="fa-solid fa-xmark"></i></div>
        </div>
      </div>
    </div>
    <button v-if="!adding" class="add-account-btn" @click="startAdd"><i class="fa-solid fa-plus"></i> 新增账号</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Account } from '@shared/types/entities';
import { accountService } from '@shared/services/accountService';
import { copyToClipboard } from '@shared/utils/clipboard';

const props = defineProps<{ accounts: Account[]; systemId: string }>();
const emit = defineEmits<{
  add: [account: { role: string; username: string; password: string; isDefault: boolean }];
  delete: [id: string];
  setDefault: [id: string];
}>();

const visibleIds = ref<Set<string>>(new Set());
const plainPasswords = ref<Record<string, string>>({});
const adding = ref(false);
const showNewPwd = ref(false);
const newAccount = ref({ role: '', username: '', password: '' });

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
  const acc = props.accounts.find(a => a.id === id);
  if (!acc) return;
  if (visibleIds.value.has(id)) {
    visibleIds.value.delete(id);
  } else {
    if (!plainPasswords.value[id]) {
      if (!acc.password.__encrypted) {
        plainPasswords.value[id] = acc.password.value;
      } else {
        try {
          const { plainPassword } = await accountService.getDecrypted(id);
          plainPasswords.value[id] = plainPassword;
        } catch { return; }
      }
    }
    visibleIds.value.add(id);
  }
}

async function copyPassword(id: string) {
  const acc = props.accounts.find(a => a.id === id);
  if (!acc) return;
  if (!acc.password.__encrypted) {
    await copyToClipboard(acc.password.value);
  } else {
    await accountService.copyPassword(id);
  }
}

async function copyUsername(username: string) {
  await copyToClipboard(username);
}

function startAdd() {
  adding.value = true;
  showNewPwd.value = false;
  newAccount.value = { role: '', username: '', password: '' };
}

function cancelAdd() {
  adding.value = false;
  newAccount.value = { role: '', username: '', password: '' };
}

function confirmAdd() {
  if (!newAccount.value.role.trim()) { return; }
  if (!newAccount.value.username.trim()) { return; }
  if (!newAccount.value.password.trim()) { return; }
  emit('add', {
    role: newAccount.value.role.trim(),
    username: newAccount.value.username.trim(),
    password: newAccount.value.password,
    isDefault: props.accounts.length === 0,
  });
  cancelAdd();
}
</script>

<style scoped>
.account-section { margin-top: var(--gap-md); }
.form-section-title {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  margin-bottom: var(--gap-sm);
  letter-spacing: 0.3px;
  text-transform: uppercase;
}
.account-list {
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.account-item {
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr 140px;
  align-items: center;
  padding: 0 14px;
  height: 40px;
  font-size: var(--text-sm);
  border-bottom: 1px solid var(--border-soft);
  gap: var(--gap-sm);
}
.account-item:last-child { border-bottom: none; }
.account-item.header-row {
  background: var(--surface-secondary);
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  height: 36px;
  letter-spacing: 0.3px;
}
.account-item.edit-row {
  background: var(--primary-50);
  height: auto;
  padding: 8px 14px;
}
.acc-pwd {
  letter-spacing: 1px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
.acc-icons {
  display: flex;
  align-items: center;
  gap: 2px;
  justify-content: flex-end;
}
.row-action {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-quaternary);
  cursor: pointer;
  font-size: 11px;
  transition: var(--transition-fast);
  background: transparent;
}
.row-action:hover { background: var(--primary-50); color: var(--primary); }
.row-action.danger:hover { background: var(--danger-light); color: var(--danger); }
.row-action.confirm { color: var(--success); }
.row-action.confirm:hover { background: var(--success-light); }
.default-badge {
  font-size: 10px;
  padding: 1px 6px;
  background: var(--warning-light);
  color: var(--warning-text);
  border-radius: var(--radius-sm);
  margin-left: 6px;
  font-weight: var(--font-medium);
}
.empty-row {
  padding: 24px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--text-sm);
  height: auto !important;
}
.cell-input {
  width: 100%;
  height: 32px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  padding: 0 10px;
  font-size: var(--text-sm);
  outline: none;
  font-family: inherit;
  background: var(--bg-pure);
  color: var(--text-primary);
  transition: var(--transition-fast);
}
.cell-input:focus {
  border-color: var(--primary);
  box-shadow: var(--shadow-focus);
}
.pwd-cell { position: relative; }
.pwd-cell .cell-input { padding-right: 32px; }
.pwd-cell i {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  color: var(--text-quaternary);
  font-size: 11px;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xs);
  transition: var(--transition-fast);
}
.pwd-cell i:hover { color: var(--primary); background: var(--primary-50); }

.add-account-btn {
  margin-top: var(--gap-sm);
  font-size: var(--text-sm);
  color: var(--primary);
  background: none;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  padding: 8px 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--gap-sm);
  width: 100%;
  font-weight: var(--font-medium);
  font-family: inherit;
  transition: var(--transition-fast);
}
.add-account-btn:hover {
  border-color: var(--primary);
  background: var(--primary-50);
  color: var(--primary);
}
</style>
