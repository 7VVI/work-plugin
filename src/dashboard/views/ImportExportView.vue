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
const includePasswords = ref(true);
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
.ie-view {
  padding: var(--gap-lg) var(--page-pad) var(--page-pad);
  max-width: 760px;
  height: 100%;
  overflow-y: auto;
}
.ie-section {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: var(--gap-xl);
  margin-bottom: var(--gap-lg);
  box-shadow: var(--shadow-sm);
}
.ie-section h3 {
  margin: 0 0 var(--gap-lg);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  letter-spacing: -0.2px;
}
.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  font-size: var(--text-sm);
  margin-bottom: var(--gap-md);
  cursor: pointer;
  color: var(--text-secondary);
  user-select: none;
}
.checkbox-label input { width: 16px; height: 16px; }
.ie-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--gap-sm);
  width: 100%;
  height: var(--control-h);
  background: var(--bg-pure);
  color: var(--text-secondary);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  margin-bottom: var(--gap-sm);
  font-family: inherit;
  transition: var(--transition-fast);
}
.ie-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-50);
}
.ie-btn.green:hover {
  border-color: var(--success);
  color: var(--success);
  background: var(--success-light);
}
.import-mode {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  margin-bottom: var(--gap-md);
}
.import-mode label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}
.md-preview {
  background: var(--surface-secondary);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  padding: var(--gap-md) var(--gap-lg);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  max-height: 280px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-primary);
  line-height: var(--leading-normal);
}
.summary p {
  margin: var(--gap-xs) 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  display: flex;
  justify-content: space-between;
}
.summary p::before { content: ""; }
</style>
