<template>
  <teleport to="body">
    <Transition name="mw-modal">
      <div v-if="visible" class="mw-overlay" @click.self="$emit('close')">
        <div class="mw-panel panel-solid" role="dialog" aria-modal="true">
          <!-- Header (v3 498-501) -->
          <div class="mw-header">
            <h2>{{ middleware ? '编辑中间件' : '新增中间件' }}</h2>
            <button class="ibtn" type="button" @click="$emit('close')" aria-label="关闭">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <!-- Body (v3 502-533) -->
          <div class="mw-body">
            <div class="grid-2">
              <div class="field">
                <label class="lbl">类型 <i class="fa-solid fa-asterisk req-mark"></i></label>
                <select v-model="form.type" class="inp" @change="onTypeChange">
                  <option v-for="t in MIDDLEWARE_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
                </select>
              </div>
              <div class="field">
                <label class="lbl">名称 <i class="fa-solid fa-asterisk req-mark"></i></label>
                <input v-model="form.name" class="inp" type="text" placeholder="如：订单库主库" />
              </div>
            </div>

            <div class="grid-2">
              <div class="field">
                <label class="lbl">版本</label>
                <input v-model="form.version" class="inp mono sm" type="text" placeholder="如：7.2" />
              </div>
              <div class="field">
                <label class="lbl">环境</label>
                <select v-model="env" class="inp">
                  <option v-for="e in ENV_OPTS" :key="e.value" :value="e.value">{{ e.label }}</option>
                </select>
              </div>
            </div>

            <div class="grid-host">
              <div class="field">
                <label class="lbl">Host <i class="fa-solid fa-asterisk req-mark"></i></label>
                <input v-model="form.host" class="inp mono sm" type="text" placeholder="172.16.0.1" />
              </div>
              <div class="field">
                <label class="lbl">端口</label>
                <input v-model.number="form.port" class="inp mono sm" type="number" />
              </div>
            </div>

            <div class="grid-2">
              <div class="field">
                <label class="lbl">数据库</label>
                <input v-model="form.database" class="inp mono sm" type="text" placeholder="如：business" />
              </div>
              <div class="field">
                <label class="lbl">DB Index</label>
                <input v-model.number="dbIndex" class="inp mono sm" type="number" />
              </div>
            </div>

            <div class="grid-2">
              <div class="field">
                <label class="lbl">账号</label>
                <input v-model="form.username" class="inp" type="text" />
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
              <label class="lbl">额外参数</label>
              <input v-model="extraParams" class="inp mono sm" type="text" placeholder="如：maxmemory-policy=allkeys-lru" />
            </div>

            <div class="field">
              <label class="lbl">备注</label>
              <textarea v-model="form.remark" rows="2" class="inp resize-none"></textarea>
            </div>
          </div>

          <!-- Footer (v3 535-538) -->
          <div class="mw-footer">
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
import type { Middleware, MiddlewareInput, Environment } from '@shared/types/entities';
import { MIDDLEWARE_TYPES } from '@shared/types/enums';
import type { MiddlewareType } from '@shared/types/enums';
import { useMiddlewareStore } from '@shared/stores/middlewareStore';
import { useToastStore } from '@shared/stores/toastStore';
import { cryptoService } from '@shared/services/cryptoService';

// ---- external contract (preserved): { visible, middleware } / { close, saved } ----
const props = defineProps<{ visible: boolean; middleware: Middleware | null }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const store = useMiddlewareStore();
const toast = useToastStore();

// v3 环境 option 顺序：开发 / 测试 / 预发 / 生产
const ENV_OPTS: { value: Environment; label: string }[] = [
  { value: 'development', label: '开发' },
  { value: 'test', label: '测试' },
  { value: 'staging', label: '预发' },
  { value: 'production', label: '生产' },
];

// v3 MW_TYPES 默认端口（类型 → 端口），mwTypeChange 据此自动填充
const DEFAULT_PORT: Record<MiddlewareType, number> = {
  mysql: 3306,
  redis: 6379,
  rabbitmq: 5672,
  kafka: 9092,
  nacos: 8848,
  apollo: 8080,
  minio: 9000,
  elasticsearch: 9200,
  clickhouse: 8123,
  mongodb: 27017,
  rocketmq: 9876,
};

const showPwd = ref(false);
// v3 的 DB Index / 额外参数 / 环境 存入 extra（Middleware 实体无独立字段，不改 shared 类型）
const dbIndex = ref<number>(0);
const extraParams = ref<string>('');
const env = ref<Environment>('development');

function blankForm(): MiddlewareInput {
  return {
    type: 'redis',
    name: '',
    version: '',
    host: '',
    port: 6379,
    database: '',
    username: '',
    password: '',
    extra: {},
    remark: '',
    favorite: false,
  };
}

const form = ref<MiddlewareInput>(blankForm());

watch(
  () => props.visible,
  async (v) => {
    if (!v) return;
    showPwd.value = false;
    if (props.middleware) {
      const { password: _p, ...rest } = props.middleware;
      form.value = { ...rest, password: '' } as MiddlewareInput;
      if (props.middleware.password) {
        try {
          form.value.password = await cryptoService.decryptField(props.middleware.password);
        } catch {
          form.value.password = '';
        }
      }
      const ex = props.middleware.extra ?? {};
      dbIndex.value = (ex.dbIndex as number) ?? (ex.db as number) ?? 0;
      extraParams.value = (ex.params as string) ?? '';
      env.value = (ex.environment as Environment) ?? 'development';
    } else {
      form.value = blankForm();
      dbIndex.value = 0;
      extraParams.value = '';
      env.value = 'development';
    }
  },
);

// v3 mwTypeChange：类型切换时自动填充默认端口
function onTypeChange() {
  const p = DEFAULT_PORT[form.value.type];
  if (p) form.value.port = p;
}

async function save() {
  if (!form.value.name.trim()) {
    toast.error('请填写名称');
    return;
  }
  if (!form.value.host.trim()) {
    toast.error('请填写 Host');
    return;
  }
  const port = Number(form.value.port);
  if (!port || port <= 0) {
    toast.error('请填写有效的端口');
    return;
  }
  form.value.port = port;
  // 将 v3 的 DB Index / 额外参数 / 环境 收集进 extra
  const extra: Record<string, unknown> = {};
  if (dbIndex.value !== undefined && dbIndex.value !== null && !Number.isNaN(dbIndex.value)) {
    extra.dbIndex = Number(dbIndex.value);
  }
  if (extraParams.value.trim()) extra.params = extraParams.value.trim();
  extra.environment = env.value;
  form.value.extra = extra;
  try {
    if (props.middleware) {
      await store.update(props.middleware.id, form.value);
      toast.success('中间件已更新');
    } else {
      await store.create(form.value);
      toast.success('中间件已创建');
    }
    emit('saved');
  } catch (e) {
    toast.error((e as Error).message || '保存失败');
  }
}
</script>

<style scoped>
/* ================= 弹窗外壳（v3 panel-solid + 弹簧动画） ================= */
.mw-overlay {
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
.mw-panel {
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

.mw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  flex-shrink: 0;
}
.mw-header h2 {
  margin: 0;
  font-size: 15px;
  font-weight: var(--font-semibold);
  color: var(--ink);
}

.mw-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px; /* v3 space-y-3.5 */
}

.mw-footer {
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
.grid-host {
  display: grid;
  grid-template-columns: 1fr 110px;
  gap: 12px;
}

/* mono 字号微调（v3 !text-xs） */
.sm { font-size: 12px; }
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
.mw-modal-enter-active { transition: opacity 0.18s ease; }
.mw-modal-leave-active { transition: opacity 0.16s ease; }
.mw-modal-enter-active .mw-panel {
  transition: transform 0.3s cubic-bezier(0.3, 1.3, 0.45, 1), opacity 0.3s ease;
}
.mw-modal-leave-active .mw-panel {
  transition: transform 0.16s ease, opacity 0.16s ease;
}
.mw-modal-enter-from,
.mw-modal-leave-to { opacity: 0; }
.mw-modal-enter-from .mw-panel { transform: translateY(16px) scale(0.95); opacity: 0; }
.mw-modal-leave-to .mw-panel { transform: translateY(8px) scale(0.97); opacity: 0; }
</style>
