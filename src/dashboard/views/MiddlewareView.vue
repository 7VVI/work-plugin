<template>
  <div class="middleware-view">
    <!-- 操作栏 - v3 风格 -->
    <div class="action-bar">
      <button class="btn-p" @click="onCreate">
        <i class="fa-solid fa-plus text-[11px]"></i>新增中间件
      </button>
      <div class="flex-1"></div>
      <div class="relative">
        <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] t3"></i>
        <input v-model="search" class="inp w-72 !pl-8" placeholder="搜索中间件名称、Host…" />
      </div>
    </div>

    <!-- 中间件网格 - v3 风格 -->
    <div class="mw-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      <div v-for="m in filtered" :key="m.id" class="panel stat-card group p-4">
        <!-- 图标 + 环境 -->
        <div class="flex items-start justify-between">
          <span
            class="flex h-10 w-10 items-center justify-center rounded-xl text-base text-white"
            :style="{ background: mwMeta(m.type).color, boxShadow: '0 5px 14px -4px ' + mwMeta(m.type).color }"
          >
            <i :class="mwMeta(m.type).icon"></i>
          </span>
          <div class="flex items-center gap-1.5">
            <EnvBadge :env="mwEnv(m)" />
            <div class="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
              <button class="ibtn danger !h-6 !w-6" @click="onDelete(m.id)">
                <i class="fa-regular fa-trash-can text-[11px]"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- 名称 + 类型 -->
        <div class="mt-3 flex items-center gap-2">
          <span class="text-[14px] font-semibold t1">{{ m.name }}</span>
          <span class="mono rounded px-1 py-0.5 text-[10px] t2" style="background:var(--panel2);border:1px solid var(--border)">
            {{ m.type }}{{ m.version ? ' ' + m.version : '' }}
          </span>
        </div>

        <!-- 地址 -->
        <div class="mono mt-1 truncate text-xs t3">
          {{ m.host }}:{{ m.port }}{{ m.database ? ' / ' + m.database : '' }}
        </div>

        <!-- 详情 -->
        <dl class="mt-3 space-y-1.5 pt-3 text-xs" style="border-top:1px solid var(--border)">
          <div class="flex justify-between">
            <dt class="t3">
              <i class="fa-regular fa-user mr-1.5 w-3 text-center"></i>账号
            </dt>
            <dd class="mono t2">{{ m.username || '—' }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="t3">
              <i class="fa-regular fa-clock mr-1.5 w-3 text-center"></i>最后更新
            </dt>
            <dd class="t2">{{ formatRelativeTime(m.updatedAt) }}</dd>
          </div>
        </dl>

        <!-- 复制按钮 -->
        <button
          class="btn-g mt-3 w-full justify-center !py-1.5 !text-xs"
          @click="onCopyAddr(m)"
        >
          <i class="fa-regular fa-copy text-[10px]"></i>复制连接地址
        </button>
      </div>

      <button
        v-if="filtered.length > 0"
        class="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed t3 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        style="border-color:var(--border2)"
        @click="onCreate"
      >
        <i class="fa-solid fa-plus text-lg"></i>
        <span class="text-[13px] font-medium">添加中间件</span>
        <span class="mono text-[10.5px]">Redis · MySQL · MongoDB · ES</span>
      </button>

      <div v-if="filtered.length === 0" class="py-16 text-center">
        <i class="fa-solid fa-layer-group text-2xl t3"></i>
        <div class="mt-2 text-[13px] t3">暂无中间件，点击"新增中间件"添加</div>
      </div>
    </div>

    <MiddlewareForm :visible="formVisible" :middleware="editing" @close="formVisible = false" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useMiddlewareStore } from '@shared/stores/middlewareStore';
import { useToastStore } from '@shared/stores/toastStore';
import { useDialogStore } from '@shared/stores/dialogStore';
import type { Middleware, Environment } from '@shared/types/entities';
import { formatRelativeTime } from '@shared/utils/time';
import MiddlewareForm from '../components/middleware/MiddlewareForm.vue';
import EnvBadge from '../components/common/EnvBadge.vue';

const MW_TYPES: Record<string, { icon: string; color: string }> = {
  redis: { icon: 'fa-solid fa-bolt', color: '#DC382D' },
  mysql: { icon: 'fa-solid fa-database', color: '#00758F' },
  postgresql: { icon: 'fa-solid fa-database', color: '#336791' },
  mongodb: { icon: 'fa-solid fa-leaf', color: '#47A248' },
  elasticsearch: { icon: 'fa-solid fa-magnifying-glass', color: '#B7791F' },
  rabbitmq: { icon: 'fa-solid fa-message', color: '#FF6600' },
  kafka: { icon: 'fa-solid fa-stream', color: '#4B5563' },
  nginx: { icon: 'fa-solid fa-server', color: '#009639' },
  minio: { icon: 'fa-solid fa-cube', color: '#C72E49' },
};

function mwMeta(type: string) {
  return MW_TYPES[type] || { icon: 'fa-solid fa-cube', color: '#2E6BF0' };
}

function mwEnv(m: Middleware): Environment {
  const env = (m.extra as Record<string, unknown> | undefined)?.environment;
  return (env as Environment) || 'development';
}

const store = useMiddlewareStore();
const toast = useToastStore();
const dialog = useDialogStore();
const formVisible = ref(false);
const editing = ref<Middleware | null>(null);
const search = ref('');

onMounted(async () => { await store.load(); });

const filtered = computed(() => {
  if (!search.value.trim()) return store.list;
  const q = search.value.toLowerCase();
  return store.list.filter(m =>
    m.name.toLowerCase().includes(q) ||
    m.host.toLowerCase().includes(q) ||
    m.type.toLowerCase().includes(q)
  );
});

function onCreate() { editing.value = null; formVisible.value = true; }

async function onDelete(id: string) {
  const ok = await dialog.confirm('确认删除', '确认删除该中间件？');
  if (!ok) return;
  await store.remove(id);
  toast.success('已删除');
}

async function onSaved() {
  formVisible.value = false;
  await store.load();
}

async function onCopyAddr(m: Middleware) {
  try {
    await store.copyConnectionString(m.id);
    toast.success('连接地址已复制');
  } catch {
    toast.error('复制失败');
  }
}
</script>

<style scoped>
.middleware-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.action-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  flex-shrink: 0;
}

.mw-grid {
  padding: 0 24px 24px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  align-content: start;
}
</style>
