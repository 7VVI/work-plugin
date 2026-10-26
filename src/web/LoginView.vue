<template>
  <div class="login-shell">
    <div class="login-card panel-solid">
      <div class="login-brand">
        <span class="brand-logo">D</span>
        <div>
          <div class="brand-name">Dock 云端控制台</div>
          <div class="brand-sub">输入访问密钥进入管理面板</div>
        </div>
      </div>

      <div class="login-body">
        <label class="login-label">访问密钥</label>
        <input
          ref="inputRef"
          v-model="secret"
          class="inp login-input"
          type="password"
          placeholder="输入服务端 DOCK_ADMIN_SECRET"
          @keyup.enter="submit"
        />
        <div v-if="localError || error" class="login-error">{{ localError || error }}</div>
        <button class="btn btn-primary login-btn" :disabled="loading" @click="submit">
          <i class="fa-solid fa-right-to-bracket"></i>{{ loading ? '验证中…' : '进入控制台' }}
        </button>
        <p class="login-note">
          密钥由服务端环境变量配置。登录会话默认 30 天，过期后需要重新输入；可在面板设置中调整。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { webApi, WebApiError } from './webApi';

defineProps<{ error?: string }>();
const emit = defineEmits<{
  success: [session: { expiresAt: number; sessionDays: number }];
}>();

const secret = ref('');
const loading = ref(false);
const localError = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

onMounted(() => inputRef.value?.focus());

async function submit() {
  if (!secret.value.trim() || loading.value) return;
  loading.value = true;
  localError.value = '';
  try {
    const session = await webApi.login(secret.value);
    secret.value = '';
    emit('success', session);
  } catch (error) {
    if (error instanceof WebApiError && error.status === 401) {
      localError.value = '访问密钥不正确';
    } else {
      localError.value = error instanceof Error ? error.message : String(error);
    }
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(520px 300px at 18% -10%, rgba(46,107,240,.14), transparent 60%),
    radial-gradient(420px 260px at 92% 112%, rgba(8,145,178,.10), transparent 65%),
    var(--bg);
}
.login-card {
  width: 100%;
  max-width: 400px;
  padding: 24px;
}
.login-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.brand-logo {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: linear-gradient(135deg, var(--accent), #1D4ED8);
  color: #fff;
  font-weight: var(--font-bold);
  font-size: var(--text-md);
  box-shadow: 0 4px 14px -4px var(--glow);
}
.brand-name {
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}
.brand-sub {
  margin-top: 2px;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}
.login-body {
  margin-top: 22px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.login-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}
.login-input { width: 100%; }
.login-error {
  font-size: var(--text-xs);
  color: var(--danger);
}
.login-btn {
  margin-top: 6px;
  width: 100%;
  justify-content: center;
  gap: 6px;
}
.login-btn i { font-size: 11px; }
.login-note {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: var(--leading-normal);
  color: var(--text-tertiary);
}
</style>
