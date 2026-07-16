<template>
  <div class="onboarding">
    <div class="wizard-card">
      <h2>欢迎使用 Nav Portal</h2>
      <div class="steps">
        <div class="step" :class="{ active: step === 1 }">1. 创建第一个系统</div>
        <div class="step" :class="{ active: step === 2 }">2. 设置主密码（可选）</div>
        <div class="step" :class="{ active: step === 3 }">3. 完成</div>
      </div>

      <div v-if="step === 1" class="step-content">
        <p>添加你的第一个内部系统：</p>
        <input v-model="systemName" placeholder="系统名称（如：内部OA）" class="form-input" />
        <input v-model="systemUrl" placeholder="https://..." class="form-input" />
        <button class="btn btn-primary" @click="onCreateSystem" :disabled="!systemName || !systemUrl">下一步</button>
      </div>

      <div v-else-if="step === 2" class="step-content">
        <p>是否设置主密码加密密码字段？</p>
        <input v-model="masterPassword" type="password" placeholder="主密码（留空跳过）" class="form-input" />
        <div class="btn-group">
          <button class="btn btn-default" @click="step = 3">跳过</button>
          <button class="btn btn-primary" @click="onSetupCrypto" :disabled="!masterPassword">设置并完成</button>
        </div>
      </div>

      <div v-else class="step-content">
        <i class="fa-solid fa-circle-check success-icon"></i>
        <p>设置完成！</p>
        <button class="btn btn-primary" @click="$router.push('/systems')">进入管理面板</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSystemStore } from '@shared/stores/systemStore';
import { useCryptoStore } from '@shared/stores/cryptoStore';

const systemStore = useSystemStore();
const cryptoStore = useCryptoStore();

const step = ref(1);
const systemName = ref('');
const systemUrl = ref('');
const masterPassword = ref('');

async function onCreateSystem() {
  await systemStore.create({
    name: systemName.value,
    url: systemUrl.value,
    environment: 'development',
    favorite: false,
    sort: 0,
  });
  step.value = 2;
}

async function onSetupCrypto() {
  if (masterPassword.value) {
    await cryptoStore.setup(masterPassword.value);
  }
  step.value = 3;
}
</script>

<style scoped>
.onboarding { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: var(--bg); }
.wizard-card { background: white; border-radius: 12px; padding: 32px; max-width: 480px; width: 90%; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
.wizard-card h2 { margin: 0 0 24px; font-size: 20px; text-align: center; }
.steps { display: flex; justify-content: space-between; margin-bottom: 24px; }
.step { font-size: 11px; color: var(--text-tertiary); flex: 1; text-align: center; padding: 8px; border-bottom: 2px solid var(--border); }
.step.active { color: var(--primary); border-color: var(--primary); font-weight: 600; }
.step-content { text-align: center; }
.step-content p { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
.form-input { width: 100%; height: 36px; border: 1px solid var(--border); border-radius: 6px; padding: 0 12px; font-size: 13px; margin-bottom: 8px; outline: none; font-family: inherit; }
.form-input:focus { border-color: var(--primary); }
.btn { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 20px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; margin-top: 8px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--primary); color: white; }
.btn-default { background: var(--border-soft); color: var(--text-primary); }
.btn-group { display: flex; gap: 8px; justify-content: center; }
.success-icon { font-size: 48px; color: var(--success); margin: 16px 0; }
</style>
