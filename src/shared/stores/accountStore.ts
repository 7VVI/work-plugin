import { defineStore } from 'pinia';
import { ref } from 'vue';
import { accountService } from '../services/accountService';
import type { Account, AccountInput } from '../types/entities';

export const useAccountStore = defineStore('account', () => {
  const list = ref<Account[]>([]);
  const loading = ref(false);

  async function loadBySystem(systemId: string) {
    loading.value = true;
    list.value = await accountService.bySystemId(systemId);
    loading.value = false;
  }

  async function create(input: AccountInput) {
    const id = await accountService.create(input);
    await loadBySystem(input.systemId);
    return id;
  }

  async function update(id: string, systemId: string, patch: Partial<AccountInput>) {
    await accountService.update(id, { ...patch, systemId });
    await loadBySystem(systemId);
  }

  async function remove(id: string, systemId: string) {
    await accountService.delete(id);
    await loadBySystem(systemId);
  }

  async function setDefault(systemId: string, accountId: string) {
    await accountService.setDefault(systemId, accountId);
    await loadBySystem(systemId);
  }

  async function copyPassword(id: string) {
    await accountService.copyPassword(id);
  }

  async function copyUsername(id: string) {
    await accountService.copyUsername(id);
  }

  return { list, loading, loadBySystem, create, update, remove, setDefault, copyPassword, copyUsername };
});
