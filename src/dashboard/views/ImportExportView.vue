<template>
  <div class="ie-view">
    <div class="ie-section">
      <h3>导出数据</h3>
      <label class="checkbox-label">
        <input v-model="includePasswords" type="checkbox" />
        包含明文密码
      </label>
      <button class="ie-btn" @click="onExportMarkdown"><i class="fa-brands fa-markdown"></i> 导出为 Markdown (.md)</button>
      <button class="ie-btn green" @click="onExportJSON"><i class="fa-solid fa-code"></i> 导出为 JSON (.json)</button>
    </div>

    <div class="ie-section">
      <h3>导入数据</h3>
      <div class="import-mode">
        <label>模式:</label>
        <select v-model="importMode" class="form-select">
          <option value="merge">合并（推荐）</option>
          <option value="replace">替换（清空后导入）</option>
        </select>
      </div>
      <input ref="fileInput" type="file" accept=".md,.json" @change="onFileSelected" style="display:none" />
      <button class="ie-btn" @click="fileInput?.click()"><i class="fa-solid fa-file-import"></i> 选择文件导入</button>
    </div>

    <div class="ie-section">
      <h3>Markdown 预览</h3>
      <pre class="md-preview">{{ preview }}</pre>
    </div>

    <div v-if="summary" class="ie-section summary">
      <h3>导入结果</h3>
      <p>新增系统: {{ summary.created.systems }}</p>
      <p>更新系统: {{ summary.updated.systems }}</p>
      <p>新增服务器: {{ summary.created.servers }}</p>
      <p>跳过: {{ summary.skipped.count }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { importExportService, type ImportSummary } from '@shared/services/importExportService';
import { useToastStore } from '@shared/stores/toastStore';

const toast = useToastStore();
const includePasswords = ref(false);
const importMode = ref<'merge' | 'replace'>('merge');
const preview = ref('');
const summary = ref<ImportSummary | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

async function onExportMarkdown() {
  try {
    const md = await importExportService.exportMarkdown({ includePasswords: includePasswords.value });
    preview.value = md;
    downloadFile(md, 'nav-portal-backup.md', 'text/markdown');
    toast.success('Markdown 导出成功');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

async function onExportJSON() {
  const json = await importExportService.exportJSON();
  downloadFile(json, 'nav-portal-backup.json', 'application/json');
  toast.success('JSON 导出成功');
}

async function onFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    if (file.name.endsWith('.md')) {
      summary.value = await importExportService.importMarkdown(text, { mode: importMode.value });
    } else if (file.name.endsWith('.json')) {
      summary.value = await importExportService.importJSON(text, { mode: importMode.value });
    }
    toast.success('导入成功');
  } catch (err) {
    toast.error(`导入失败: ${(err as Error).message}`);
  }
  if (fileInput.value) fileInput.value.value = '';
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.ie-view { padding: 12px; max-width: 600px; }
.ie-section { background: white; border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 12px; }
.ie-section h3 { margin: 0 0 12px; font-size: 14px; }
.checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-bottom: 8px; cursor: pointer; }
.ie-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; height: 32px; background: var(--primary-50); color: var(--primary-700); border: 1px solid var(--primary-100); border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; margin-bottom: 6px; font-family: inherit; }
.ie-btn:hover { background: var(--primary-100); }
.ie-btn.green { background: #f0fdf4; color: #047857; border-color: #bbf7d0; }
.import-mode { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.import-mode label { font-size: 12px; color: var(--text-secondary); }
.form-select { height: 28px; border: 1px solid var(--border); border-radius: 5px; padding: 0 8px; font-size: 12px; font-family: inherit; }
.md-preview { background: #f9fafb; border: 1px solid var(--border-soft); border-radius: 6px; padding: 12px; font-family: monospace; font-size: 11px; max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
.summary p { margin: 4px 0; font-size: 12px; }
</style>
