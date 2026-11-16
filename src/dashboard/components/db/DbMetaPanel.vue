<template>
  <div class="db-meta">
    <table v-if="prop === 'schema'" class="db-meta-table">
      <thead><tr><th>列</th><th>类型</th><th>可空</th><th>主键</th></tr></thead>
      <tbody>
        <tr v-for="col in columns" :key="col.name">
          <td class="mono">{{ col.name }}</td>
          <td class="mono t2">{{ col.dataType ?? '—' }}</td>
          <td>{{ col.nullable ? '是' : '否' }}</td>
          <td>{{ col.primary ? 'PK' : '' }}</td>
        </tr>
        <tr v-if="columns.length === 0"><td colspan="4" class="t3">暂无列信息</td></tr>
      </tbody>
    </table>

    <table v-else-if="prop === 'indexes'" class="db-meta-table">
      <thead><tr><th>索引</th><th>唯一</th><th>主键</th><th>列</th></tr></thead>
      <tbody>
        <tr v-for="idx in indexes" :key="idx.name">
          <td class="mono">{{ idx.name }}</td>
          <td>{{ idx.unique ? '是' : '否' }}</td>
          <td>{{ idx.primary ? '是' : '' }}</td>
          <td class="mono t2">{{ idx.columns.join(', ') || idx.definition || '—' }}</td>
        </tr>
        <tr v-if="indexes.length === 0"><td colspan="4" class="t3">暂无索引</td></tr>
      </tbody>
    </table>

    <table v-else-if="prop === 'foreignKeys'" class="db-meta-table">
      <thead><tr><th>约束</th><th>列</th><th>引用表</th><th>引用列</th></tr></thead>
      <tbody>
        <tr v-for="fk in foreignKeys" :key="fk.name">
          <td class="mono">{{ fk.name }}</td>
          <td class="mono t2">{{ fk.columns.join(', ') }}</td>
          <td class="mono t2">{{ fk.foreignSchema ? `${fk.foreignSchema}.${fk.foreignTable}` : fk.foreignTable }}</td>
          <td class="mono t2">{{ fk.foreignColumns.join(', ') }}</td>
        </tr>
        <tr v-if="foreignKeys.length === 0"><td colspan="4" class="t3">暂无外键</td></tr>
      </tbody>
    </table>

    <table v-else-if="prop === 'triggers'" class="db-meta-table">
      <thead><tr><th>触发器</th><th>表</th><th>定义</th></tr></thead>
      <tbody>
        <tr v-for="trg in triggers" :key="trg.name">
          <td class="mono">{{ trg.name }}</td>
          <td class="mono t2">{{ trg.table ?? '—' }}</td>
          <td class="mono t2 db-meta-def">{{ trg.definition ?? '—' }}</td>
        </tr>
        <tr v-if="triggers.length === 0"><td colspan="3" class="t3">暂无触发器</td></tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { DbColumn, DbForeignKeyInfo, DbIndexInfo, DbTriggerInfo } from '@protocol/db';
import type { DbPanelTab } from '@shared/stores/dbStore';

defineProps<{
  prop: DbPanelTab;
  columns: DbColumn[];
  indexes: DbIndexInfo[];
  foreignKeys: DbForeignKeyInfo[];
  triggers: DbTriggerInfo[];
}>();
</script>

<style scoped>
.db-meta { overflow: auto; padding: 8px 10px; }
.db-meta-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.db-meta-table th {
  position: sticky;
  top: 0;
  text-align: left;
  color: var(--ink2);
  font-weight: var(--font-medium);
  background: var(--bg);
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
}
.db-meta-table td { padding: 5px 8px; border-bottom: 1px solid var(--border-soft); }
.db-meta-def { max-width: 520px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
