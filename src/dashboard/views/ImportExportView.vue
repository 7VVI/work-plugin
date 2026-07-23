<template>
  <div class="ie-view">
    <div class="ie-grid">
      <!-- 导出 -->
      <section class="panel ie-card">
        <div class="io-icon export"><i class="fa-solid fa-cloud-arrow-down"></i></div>
        <h3 class="io-title">导出数据</h3>
        <p class="io-desc">将资产数据导出为备份文件，可用于迁移或存档。支持 JSON 与 Markdown（每种记录为表格）。</p>
        <div class="scope-list">
          <label class="scope-item"><input type="checkbox" v-model="scope.systems" class="form-check" /><span>系统（含账号密码）</span></label>
          <label class="scope-item"><input type="checkbox" v-model="scope.servers" class="form-check" /><span>服务器</span></label>
          <label class="scope-item"><input type="checkbox" v-model="scope.middlewares" class="form-check" /><span>中间件</span></label>
          <label class="scope-item"><input type="checkbox" v-model="scope.configs" class="form-check" /><span>配置（项目 / 字段）</span></label>
        </div>

        <div class="io-row">
          <span class="io-label">格式</span>
          <div class="seg-group">
            <button class="seg-btn" :class="{ on: format === 'json' }" @click="format = 'json'">JSON</button>
            <button class="seg-btn" :class="{ on: format === 'md' }" @click="format = 'md'">Markdown</button>
          </div>
        </div>
        <label v-if="format === 'md'" class="scope-item pwd-item">
          <input type="checkbox" v-model="includePasswords" class="form-check" />
          <span>包含明文密码（系统 / 服务器 / 中间件）</span>
        </label>

        <button class="btn btn-primary io-btn" @click="onExport">
          <i class="fa-solid fa-download"></i>
          <span>{{ format === 'md' ? '导出 Markdown' : '导出 JSON' }}</span>
        </button>
      </section>

      <!-- 导入 -->
      <section class="panel ie-card">
        <div class="io-icon import"><i class="fa-solid fa-cloud-arrow-up"></i></div>
        <h3 class="io-title">导入数据</h3>
        <p class="io-desc">从备份文件恢复数据，导入前会自动校验文件格式。支持 .json 与 .md。</p>
        <div
          class="drop-zone"
          :class="{ over: dragOver }"
          @click="fileInput?.click()"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          @drop.prevent="onDrop"
        >
          <i class="fa-solid fa-file-import"></i>
          <span class="dz-text">拖拽文件到此处，或点击选择文件</span>
          <span class="dz-ext mono">.json / .md</span>
        </div>
        <input ref="fileInput" type="file" accept=".json,application/json,.md,text/markdown" class="hidden-input" @change="onFileChange" />
      </section>
    </div>

    <!-- 琥珀警示 -->
    <div class="warn-bar">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>数据仅保存在浏览器本地（IndexedDB）。导出的备份文件可能包含<strong>明文账号密码</strong>，请妥善保管，不要上传到公共网盘或群聊。</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { importExportService } from '@shared/services/importExportService';
import { useToastStore } from '@shared/stores/toastStore';

const toast = useToastStore();

const scope = ref({ systems: true, servers: true, middlewares: true, configs: true });
const format = ref<'json' | 'md'>('json');
const includePasswords = ref(false);
const dragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

async function onExport() {
  const stamp = new Date().toISOString().slice(0, 10);
  try {
    if (format.value === 'md') {
      const md = await importExportService.exportMarkdown({
        includePasswords: includePasswords.value,
        scope: { ...scope.value },
      });
      downloadFile(md, `dock-backup-${stamp}.md`, 'text/markdown');
      toast.success('Markdown 备份已导出');
    } else {
      const full = JSON.parse(await importExportService.exportJSON());
      const out: Record<string, unknown> = { app: 'Dock', version: '3.0.0', exportedAt: new Date().toISOString() };
      if (scope.value.systems) out.systems = full.systems ?? [];
      if (scope.value.servers) out.servers = full.servers ?? [];
      if (scope.value.middlewares) out.middlewares = full.middlewares ?? [];
      if (scope.value.configs) out.projects = full.projects ?? [];
      downloadFile(JSON.stringify(out, null, 2), `dock-backup-${stamp}.json`, 'application/json');
      toast.success('JSON 备份已导出');
    }
  } catch (e) {
    toast.error((e as Error).message || '导出失败');
  }
}

function onDrop(e: DragEvent) {
  dragOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) importFile(file);
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) importFile(file);
  if (fileInput.value) fileInput.value.value = '';
}

async function importFile(file: File) {
  const isMd = file.name.endsWith('.md') || file.name.endsWith('.markdown');
  const isJson = file.name.endsWith('.json');
  if (!isMd && !isJson) {
    toast.error('仅支持 .json 或 .md 备份文件');
    return;
  }
  try {
    const text = await file.text();
    if (isMd) {
      await importExportService.importMarkdown(text, { mode: 'merge' });
    } else {
      await importExportService.importJSON(text, { mode: 'merge' });
    }
    toast.success(`导入完成：${file.name}`);
  } catch (e) {
    toast.error('文件格式不正确，导入失败');
  }
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
  padding: var(--gap-lg) var(--page-pad) calc(var(--statusbar-h) + var(--page-pad));
  max-width: 920px;
  height: 100%;
  overflow-y: auto;
}
.ie-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--gap-lg);
}
@media (max-width: 720px) {
  .ie-grid { grid-template-columns: 1fr; }
}
.ie-card { padding: var(--gap-xl); }
.io-icon {
  width: 40px; height: 40px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--radius-md);
  font-size: var(--text-md);
}
.io-icon.export { background: rgba(46,107,240,.09); color: var(--accent); box-shadow: inset 0 0 0 1px rgba(46,107,240,.2); }
.io-icon.import { background: rgba(5,150,105,.08); color: var(--success); box-shadow: inset 0 0 0 1px rgba(5,150,105,.2); }
.io-title {
  margin: var(--gap-md) 0 var(--gap-xs);
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}
.io-desc {
  margin: 0 0 var(--gap-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--leading-normal);
}
.scope-list {
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
  margin-bottom: var(--gap-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
.scope-item {
  display: flex; align-items: center; gap: var(--gap-sm);
  cursor: pointer; user-select: none;
}
.io-row {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  margin-bottom: var(--gap-sm);
}
.io-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
.pwd-item { margin-bottom: var(--gap-md); }
.io-btn { width: 100%; justify-content: center; margin-top: var(--gap-sm); }

.drop-zone {
  margin-top: var(--gap-sm);
  height: 144px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--gap-sm);
  border: 2px dashed var(--border-strong);
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition-fast);
}
.drop-zone:hover, .drop-zone.over {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--primary-50);
}
.drop-zone i { font-size: var(--text-xl); }
.dz-text { font-size: var(--text-sm); }
.dz-ext { font-size: var(--text-xs); color: var(--text-quaternary); }
.hidden-input { display: none; }

.warn-bar {
  margin-top: var(--gap-lg);
  display: flex;
  align-items: flex-start;
  gap: var(--gap-sm);
  padding: var(--gap-md) var(--gap-lg);
  border-radius: var(--radius-md);
  border: 1px solid rgba(180,83,9,.28);
  background: rgba(251,191,36,.07);
  color: var(--warning);
  font-size: 12.5px;
  line-height: var(--leading-normal);
}
.warn-bar i { margin-top: 3px; flex-shrink: 0; }
.warn-bar strong { font-weight: var(--font-semibold); }
</style>
