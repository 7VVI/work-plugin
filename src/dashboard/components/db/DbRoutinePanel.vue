<template>
  <div class="db-routine">
    <div class="db-routine-head">
      <span class="db-routine-icon">
        <i :class="kindIcon"></i>
      </span>
      <div class="db-routine-text">
        <div class="db-routine-title">{{ name }}</div>
        <div class="db-routine-sub t3">{{ kindLabel }}<template v-if="schema"> · {{ schema }}</template></div>
      </div>
      <span class="db-spacer"></span>
      <button class="db-grid-btn" title="复制定义" @click="copyDefinition">
        <i class="fa-regular fa-copy"></i>复制
      </button>
    </div>

    <div v-if="loading" class="db-routine-hint t3">
      <i class="fa-solid fa-spinner fa-spin"></i> 正在读取定义…
    </div>
    <div v-else-if="error" class="db-routine-hint db-routine-error">
      <i class="fa-solid fa-triangle-exclamation"></i> {{ error }}
    </div>
    <template v-else>
      <section v-if="parameters.length" class="db-routine-params">
        <div class="db-routine-section-title t3">参数</div>
        <table class="db-routine-table">
          <thead>
            <tr>
              <th class="db-routine-th">名称</th>
              <th class="db-routine-th">类型</th>
              <th class="db-routine-th">方向</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(param, index) in parameters" :key="`${param.name}-${index}`">
              <td class="db-routine-td mono">{{ param.name }}</td>
              <td class="db-routine-td mono t3">{{ param.type ?? '—' }}</td>
              <td class="db-routine-td t3">{{ param.mode ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="db-routine-code">
        <div class="db-routine-section-title t3">定义</div>
        <pre v-if="definition" class="db-routine-pre mono">{{ definition }}</pre>
        <div v-else class="db-routine-hint t3">没有取到定义（可能没有权限或该对象不支持查看源码）</div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DbRoutineParameter } from '@protocol/db';

const props = defineProps<{
  name: string;
  schema?: string;
  kind: 'functions' | 'procedures' | 'triggers';
  definition: string;
  parameters: DbRoutineParameter[];
  loading?: boolean;
  error?: string | null;
}>();

const kindLabel = computed(() => {
  if (props.kind === 'functions') return '函数';
  if (props.kind === 'procedures') return '存储过程';
  return '触发器';
});

const kindIcon = computed(() => {
  if (props.kind === 'functions') return 'fa-solid fa-calculator';
  if (props.kind === 'procedures') return 'fa-solid fa-gears';
  return 'fa-solid fa-bolt';
});

async function copyDefinition(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.definition);
  } catch {
    /* 剪贴板不可用时忽略 */
  }
}
</script>

<style scoped>
.db-routine {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--panel);
}
.db-routine-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.db-routine-icon {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-50);
  color: var(--accent);
  font-size: 12px;
}
.db-routine-text { min-width: 0; }
.db-routine-title { font-size: var(--text-md); font-weight: var(--font-bold); color: var(--ink); }
.db-routine-sub { font-size: var(--text-xs); }
.db-spacer { flex: 1; }
.db-routine-hint { padding: 24px; text-align: center; font-size: 12.5px; }
.db-routine-error { color: var(--danger-text); background: var(--danger-light); }
.db-routine-section-title {
  font-size: var(--text-xs);
  color: var(--ink3);
  padding: 10px 12px 6px;
}
.db-routine-params { flex-shrink: 0; border-bottom: 1px solid var(--border); }
.db-routine-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.db-routine-th {
  text-align: left;
  font-weight: var(--font-medium);
  color: var(--ink2);
  background: var(--panel2);
  border-bottom: 1px solid var(--border);
  padding: 6px 12px;
  white-space: nowrap;
}
.db-routine-td {
  border-bottom: 1px solid var(--border-soft);
  padding: 5px 12px;
  color: var(--ink2);
  white-space: nowrap;
}
.db-routine-code { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.db-routine-pre {
  flex: 1;
  margin: 0 12px 12px;
  padding: 12px;
  overflow: auto;
  background: var(--panel2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--ink);
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
