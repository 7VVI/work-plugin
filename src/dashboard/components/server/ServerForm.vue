<template>
  <teleport to="body">
    <Transition name="srv-modal">
      <div v-if="visible" class="srv-overlay" @click.self="$emit('close')">
        <div class="srv-panel panel-solid" role="dialog" aria-modal="true">
          <!-- Header (v3 460-463) -->
          <div class="srv-header">
            <h2>{{ server ? '编辑服务器' : '新增服务器' }}</h2>
            <button class="ibtn" type="button" @click="$emit('close')" aria-label="关闭">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <!-- Body (v3 464-485) -->
          <div class="srv-body">
            <div class="field">
              <label class="lbl">名称 <i class="fa-solid fa-asterisk req-mark"></i></label>
              <input v-model="form.name" class="inp" type="text" placeholder="如：应用服务器-01" />
            </div>

            <div class="grid-ip">
              <div class="field">
                <label class="lbl">IP <i class="fa-solid fa-asterisk req-mark"></i></label>
                <input v-model="form.ip" class="inp mono sm" type="text" placeholder="172.16.0.1" />
              </div>
              <div class="field">
                <label class="lbl">SSH 端口</label>
                <input v-model.number="form.sshPort" class="inp mono sm" type="number" />
              </div>
            </div>

            <div class="grid-2">
              <div class="field">
                <label class="lbl">账号</label>
                <input v-model="form.username" class="inp" type="text" placeholder="root" />
              </div>
              <div class="field">
                <label class="lbl">密码</label>
                <div class="pwd-wrap">
                  <input
                    v-model="form.password"
                    :type="showPwd ? 'text' : 'password'"
                    class="inp pwd-input"
                    placeholder="••••••••"
                  />
                  <button
                    class="ibtn pwd-toggle"
                    type="button"
                    :title="showPwd ? '隐藏' : '显示'"
                    @click="showPwd = !showPwd"
                  >
                    <i :class="showPwd ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'"></i>
                  </button>
                </div>
              </div>
            </div>

            <div class="field">
              <label class="lbl">SSH Key</label>
              <textarea
                v-model="form.sshKey"
                rows="3"
                class="inp mono xs resize-none"
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              ></textarea>
            </div>

            <div class="grid-2">
              <div class="field">
                <label class="lbl">环境</label>
                <select v-model="form.environment" class="inp">
                  <option v-for="env in ENV_OPTS" :key="env.value" :value="env.value">{{ env.label }}</option>
                </select>
              </div>
              <div class="field">
                <label class="lbl">用途</label>
                <input v-model="form.purpose" class="inp" type="text" placeholder="如：应用服务器" />
              </div>
            </div>

            <div class="field">
              <label class="lbl">备注</label>
              <textarea v-model="form.remark" rows="2" class="inp resize-none"></textarea>
            </div>
          </div>

          <!-- Footer (v3 487-490) -->
          <div class="srv-footer">
            <button class="btn-g" type="button" @click="$emit('close')">取消</button>
            <button class="btn-p" type="button" @click="save">
              <i class="fa-solid fa-check"></i>保存
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Server, ServerInput, Environment } from '@shared/types/entities';
import { useServerStore } from '@shared/stores/serverStore';
import { useToastStore } from '@shared/stores/toastStore';
import { cryptoService } from '@shared/services/cryptoService';

// ---- external contract (preserved): { visible, server } / { close, saved } ----
const props = defineProps<{ visible: boolean; server: Server | null }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const store = useServerStore();
const toast = useToastStore();

// v3 环境 option 顺序：开发 / 测试 / 预发 / 生产
const ENV_OPTS: { value: Environment; label: string }[] = [
  { value: 'development', label: '开发' },
  { value: 'test', label: '测试' },
  { value: 'staging', label: '预发' },
  { value: 'production', label: '生产' },
];

const showPwd = ref(false);

function blankForm(): ServerInput {
  return {
    name: '',
    ip: '',
    sshPort: 22,
    username: '',
    password: '',
    sshKey: '',
    environment: 'development',
    purpose: '',
    remark: '',
    favorite: false,
  };
}

const form = ref<ServerInput>(blankForm());

watch(
  () => props.visible,
  async (v) => {
    if (!v) return;
    showPwd.value = false;
    if (props.server) {
      const { password: _p, sshKey: _s, ...rest } = props.server;
      form.value = { ...rest, password: '', sshKey: '' } as ServerInput;
      if (props.server.password) {
        try {
          form.value.password = await cryptoService.decryptField(props.server.password);
        } catch {
          form.value.password = '';
        }
      }
      if (props.server.sshKey) {
        try {
          form.value.sshKey = await cryptoService.decryptField(props.server.sshKey);
        } catch {
          form.value.sshKey = '';
        }
      }
    } else {
      form.value = blankForm();
    }
  },
);

async function save() {
  if (!form.value.name.trim()) {
    toast.error('请填写名称');
    return;
  }
  if (!form.value.ip.trim()) {
    toast.error('请填写 IP 地址');
    return;
  }
  if (!form.value.sshPort || form.value.sshPort <= 0) {
    toast.error('请填写有效的 SSH 端口');
    return;
  }
  try {
    if (props.server) {
      await store.update(props.server.id, form.value);
      toast.success('服务器已更新');
    } else {
      await store.create(form.value);
      toast.success('服务器已创建');
    }
    emit('saved');
  } catch (e) {
    toast.error((e as Error).message || '保存失败');
  }
}
</script>

<style scoped>
/* ================= 弹窗外壳（v3 panel-solid + 弹簧动画） ================= */
.srv-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 38, 0.35);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}
.srv-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 448px; /* v3 max-w-md */
  max-height: 88vh;
  overflow: hidden;
  border-radius: var(--radius-2xl);
  box-shadow: 0 24px 70px -16px rgba(15, 23, 38, 0.3), 0 0 40px -16px var(--glow);
}

.srv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  flex-shrink: 0;
}
.srv-header h2 {
  margin: 0;
  font-size: 15px;
  font-weight: var(--font-semibold);
  color: var(--ink);
}

.srv-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px; /* v3 space-y-3.5 */
}

.srv-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

/* ================= 字段 / 标签 / 栅格 ================= */
.field { display: flex; flex-direction: column; }
.lbl {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  font-size: 12.5px;
  font-weight: var(--font-medium);
  color: var(--ink2);
}
.req-mark { color: var(--danger); font-size: 7px; }

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.grid-ip {
  display: grid;
  grid-template-columns: 1fr 110px;
  gap: 12px;
}

/* mono 字号微调（v3 !text-xs / !text-[11px]） */
.sm { font-size: 12px; }
.xs { font-size: 11px; }
.resize-none { resize: none; }

/* ================= 密码显隐 ================= */
.pwd-wrap { position: relative; }
.pwd-input { padding-right: 36px; }
.pwd-toggle {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
}
.pwd-toggle i { font-size: 11px; }

/* ================= 过渡（v3 弹簧） ================= */
.srv-modal-enter-active { transition: opacity 0.18s ease; }
.srv-modal-leave-active { transition: opacity 0.16s ease; }
.srv-modal-enter-active .srv-panel {
  transition: transform 0.3s cubic-bezier(0.3, 1.3, 0.45, 1), opacity 0.3s ease;
}
.srv-modal-leave-active .srv-panel {
  transition: transform 0.16s ease, opacity 0.16s ease;
}
.srv-modal-enter-from,
.srv-modal-leave-to { opacity: 0; }
.srv-modal-enter-from .srv-panel { transform: translateY(16px) scale(0.95); opacity: 0; }
.srv-modal-leave-to .srv-panel { transform: translateY(8px) scale(0.97); opacity: 0; }
</style>
