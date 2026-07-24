<template>
  <div class="onboarding">
    <div class="wizard-card">
      <h2>欢迎使用 Dock</h2>
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
.onboarding {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg);
  padding: var(--gap-xl);
}
.wizard-card {
  background: var(--bg-pure);
  border-radius: var(--radius-2xl);
  padding: 40px;
  max-width: 480px;
  width: 100%;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-soft);
}
.wizard-card h2 {
  margin: 0 0 var(--gap-xl);
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  text-align: center;
  color: var(--text-primary);
  letter-spacing: -0.4px;
}
.steps {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--gap-xl);
  gap: var(--gap-sm);
}
.step {
  font-size: var(--text-xs);
  color: var(--text-quaternary);
  flex: 1;
  text-align: center;
  padding: var(--gap-sm) 0;
  border-bottom: 2px solid var(--border);
  font-weight: var(--font-medium);
  transition: var(--transition);
}
.step.active {
  color: var(--primary);
  border-color: var(--primary);
  font-weight: var(--font-semibold);
}
.step-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}
.step-content > p {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0 0 var(--gap-md);
}
.step-content .form-input { margin-bottom: var(--gap-sm); }
.step-content .btn { width: 100%; margin-top: var(--gap-sm); }
.btn-group {
  display: flex;
  gap: var(--gap-sm);
  justify-content: center;
  margin-top: var(--gap-sm);
}
.btn-group .btn { flex: 1; margin-top: 0; }
.success-icon {
  font-size: 56px;
  color: var(--success);
  margin: var(--gap-lg) 0;
}
</style>
