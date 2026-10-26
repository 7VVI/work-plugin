<template>
  <LoginView
    v-if="phase === 'login'"
    :error="loginError"
    @success="onLogin"
  />
  <DashboardApp v-else-if="phase === 'ready'" />
  <div v-else class="boot-shell">
    <div class="boot-card">
      <i class="fa-solid fa-cloud boot-icon"></i>
      <div class="boot-text">{{ phase === 'checking' ? '正在检查登录状态…' : '正在加载云端数据…' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import DashboardApp from '../dashboard/App.vue';
import LoginView from './LoginView.vue';
import { webApi } from './webApi';
import { hydrateFromServer } from './webHydrate';
import { startWebSync, stopWebSync } from './webSync';

type Phase = 'checking' | 'loading' | 'login' | 'ready';

const phase = ref<Phase>('checking');
const loginError = ref('');
let hydrated = false;

async function enter(hydrate: boolean): Promise<void> {
  phase.value = 'loading';
  try {
    if (hydrate) {
      await hydrateFromServer();
      hydrated = true;
    }
    startWebSync();
    phase.value = 'ready';
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : String(error);
    phase.value = 'login';
  }
}

async function onLogin(): Promise<void> {
  loginError.value = '';
  await enter(!hydrated);
}

function onUnauthorized(): void {
  stopWebSync();
  loginError.value = '登录已过期，请重新输入访问密钥';
  phase.value = 'login';
}

onMounted(async () => {
  window.addEventListener('dock-unauthorized', onUnauthorized);
  const session = await webApi.getSession();
  if (!session) {
    phase.value = 'login';
    return;
  }
  await enter(true);
});

onBeforeUnmount(() => {
  stopWebSync();
  window.removeEventListener('dock-unauthorized', onUnauthorized);
});
</script>

<style scoped>
.boot-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}
.boot-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-tertiary);
}
.boot-icon {
  font-size: 28px;
  color: var(--accent);
  animation: boot-pulse 1.4s ease-in-out infinite;
}
.boot-text { font-size: var(--text-sm); }
@keyframes boot-pulse {
  0%, 100% { opacity: 1; transform: translateY(0); }
  50% { opacity: .45; transform: translateY(-2px); }
}
</style>
