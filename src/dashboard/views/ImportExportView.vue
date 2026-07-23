<template>
  <div class="ie-view">
    <!-- 导出 -->
    <section class="panel ie-section">
      <h3 class="section-title">
        <i class="fa-solid fa-upload section-icon"></i>
        导出数据
      </h3>
      <label class="check-label">
        <input v-model="includePasswords" type="checkbox" class="form-check" />
        <span>包含明文密码</span>
      </label>
      <button class="btn btn-default full" @click="onExportMarkdown">
        <i class="fa-brands fa-markdown"></i> 导出为 Markdown (.md)
      </button>
      <button class="btn btn-default full" @click="onExportJSON">
        <i class="fa-solid fa-code"></i> 导出为 JSON (.json)
      </button>
    </section>

    <!-- 导入 -->
    <section class="panel ie-section">
      <h3 class="section-title">
        <i class="fa-solid fa-download section-icon"></i>
        导入数据
      </h3>
      <div class="import-mode">
        <label class="row-label">模式:</label>
        <select v-model="importMode" class="form-select">
          <option value="merge">合并（推荐）</option>
          <option value="replace">替换（清空后导入）</option>
        </select>
      </div>
      <input ref="fileInput" type="file" accept=".md,.json" @change="onFileSelected" class="file-hidden" />
      <div
        class="drop-zone"
        :class="{ dragover: isDragOver }"
        @click="fileInput?.click()"
        @dragover.prevent="isDragOver = true"
        @dragenter.prevent="isDragOver = true"
        @dragleave.prevent="isDragOver = false"
        @drop.prevent="onDrop"
      >
        <i class="fa-solid fa-cloud-arrow-up"></i>
        <p class="drop-text">拖拽文件到此处，或点击选择</p>
        <p class="drop-hint">支持 .md / .json</p>
      </div>
      <button class="btn btn-default full" @click="fileInput?.click()">
        <i class="fa-solid fa-file-import"></i> 选择文件导入
      </button>
    </section>

    <!-- 预览 -->
    <section class="panel ie-section">
      <h3 class="section-title">
        <i class="fa-solid fa-eye section-icon"></i>
        Markdown 预览
      </h3>
      <pre class="md-preview">{{ preview }}</pre>
    </section>

    <!-- 导入结果 -->
    <section v-if="summary" class="panel ie-section summary">
      <h3 class="section-title">
        <i class="fa-solid fa-circle-check section-icon ok"></i>
        导入结果
      </h3>
      <p><span class="summary-label">新增系统</span><span class="summary-value">{{ summary.created.systems }}</span></p>
      <p><span class="summary-label">更新系统</span><span class="summary-value">{{ summary.updated.systems }}</span></p>
      <p><span class="summary-label">新增服务器</span><span class="summary-value">{{ summary.created.servers }}</span></p>
      <p><span class="summary-label">跳过</span><span class="summary-value">{{ summary.skipped.count }}</span></p>
    </section>

    <!-- 安全警示 -->
    <div class="warn-bar">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>导出包含明文密码的文件请妥善保管；替换模式导入会先清空现有数据，请谨慎操作。</span>
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
const isDragOver = ref(false);

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

async function processFile(file: File) {
  if (!file.name.endsWith('.md') && !file.name.endsWith('.json')) {
    toast.error('仅支持 .md / .json 文件');
    if (fileInput.value) fileInput.value.value = '';
    return;
  }
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

async function onFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  await processFile(file);
}

async function onDrop(e: DragEvent) {
  isDragOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  await processFile(file);
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
  padding: var(--gap-xl);
  margin-bottom: var(--gap-lg);
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
}
.section-title {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  letter-spacing: -0.2px;
}
.section-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--primary-50);
  color: var(--primary);
  font-size: var(--text-sm);
  flex-shrink: 0;
}
.section-icon.ok { background: var(--success-light); color: var(--success); }

.check-label {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  font-size: var(--text-sm);
  cursor: pointer;
  color: var(--text-secondary);
  user-select: none;
}
.row-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
  flex-shrink: 0;
}
.btn.full { width: 100%; }
.file-hidden { display: none; }

.import-mode {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
}
.import-mode .form-select { max-width: 260px; }

.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--gap-xs);
  padding: var(--gap-xl) var(--gap-lg);
  border: 2px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-secondary);
  color: var(--text-tertiary);
  cursor: pointer;
  text-align: center;
  transition: var(--transition-fast);
}
.drop-zone:hover,
.drop-zone.dragover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--primary-50);
}
.drop-zone i { font-size: var(--text-xl); }
.drop-text { margin: 0; font-size: var(--text-sm); font-weight: var(--font-medium); }
.drop-hint { margin: 0; font-size: var(--text-xs); color: var(--text-quaternary); }

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
  margin: 0;
}

.summary p {
  margin: 0;
  padding: var(--gap-sm) var(--gap-md);
  font-size: var(--text-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-soft);
}
.summary p:last-child { border-bottom: none; }
.summary-label { color: var(--text-secondary); }
.summary-value {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  font-family: var(--font-mono);
}

.warn-bar {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  padding: var(--gap-md) var(--gap-lg);
  border: 1px solid rgba(180, 83, 9, 0.28);
  border-radius: var(--radius-md);
  background: rgba(251, 191, 36, 0.07);
  color: var(--warning);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
}
.warn-bar i { color: var(--warning); flex-shrink: 0; }
</style>
