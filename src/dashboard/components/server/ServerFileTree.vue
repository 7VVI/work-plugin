<template>
  <div
    class="fs-tree"
    :class="{ unsupported: !supported }"
    @dragover.prevent="dragOver = true"
    @dragleave="dragOver = false"
    @drop.prevent="onDrop"
  >
    <div v-if="!supported" class="fs-empty">服务端不支持文件管理</div>
    <template v-else>
      <div v-for="row in rows" :key="row.path" class="fs-row-wrap">
        <div
          class="fs-row"
          :class="{ active: selected === row.path }"
          :style="{ paddingLeft: `${8 + row.depth * 14}px` }"
          :title="`${row.path}\n${formatSize(row.size)} · ${formatTime(row.mtime)}`"
          @click="onRowClick(row)"
          @contextmenu.prevent.stop="openMenu($event, row)"
        >
          <i v-if="row.type === 'dir'" class="fs-caret" :class="{ open: isExpanded(row.path) }" @click.stop="toggle(row.path)">
            <i class="fa-solid fa-chevron-right"></i>
          </i>
          <span v-else class="fs-caret"></span>
          <i class="fs-icon" :class="row.type === 'dir' ? 'fa-regular fa-folder' : 'fa-regular fa-file'"></i>
          <span class="fs-name">{{ row.name }}</span>
          <span class="fs-size">{{ formatSize(row.size) }}</span>
        </div>
      </div>
      <div v-if="rows.length === 0 && !loading" class="fs-empty">目录为空</div>
      <div v-if="loading" class="fs-empty">加载中…</div>
    </template>

    <ServerFileMenu
      :open="menu.open"
      :x="menu.x"
      :y="menu.y"
      :is-dir="menu.isDir"
      @run="onMenuAction"
      @close="menu.open = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { SshFsEntry } from '@protocol/ssh';
import { joinPath, parentPath, type SshFs } from '@shared/ssh/sshFs';
import { useDialogStore } from '@shared/stores/dialogStore';
import { useToastStore } from '@shared/stores/toastStore';
import ServerFileMenu, { type FsMenuAction } from './ServerFileMenu.vue';

const props = withDefaults(defineProps<{
  fs: SshFs | null;
  root?: string;
  supported?: boolean;
}>(), {
  root: '/',
  supported: true,
});

const emit = defineEmits<{
  openFile: [path: string, name: string, size: number];
  download: [path: string, name: string];
  openTerminal: [dir: string];
  pickFiles: [dir: string];
  uploadFiles: [files: File[], dir: string];
}>();

const dialog = useDialogStore();
const toast = useToastStore();

interface DirState {
  entries: SshFsEntry[];
  expanded: boolean;
  loading: boolean;
  loaded: boolean;
}

interface Row {
  path: string;
  name: string;
  type: SshFsEntry['type'];
  size: number;
  mtime: number;
  depth: number;
}

const dirs = reactive<Record<string, DirState>>({});
const selected = ref('');
const dragOver = ref(false);
const menu = reactive<{ open: boolean; x: number; y: number; isDir: boolean; path: string }>({
  open: false,
  x: 0,
  y: 0,
  isDir: true,
  path: '/',
});

const loading = computed(() => Object.values(dirs).some(dir => dir.loading));

const rows = computed<Row[]>(() => {
  const result: Row[] = [];
  const walk = (path: string, depth: number): void => {
    const dir = dirs[path];
    if (!dir) return;
    for (const entry of dir.entries) {
      const childPath = joinPath(path, entry.name);
      result.push({
        path: childPath,
        name: entry.name,
        type: entry.type,
        size: entry.size,
        mtime: entry.mtime,
        depth,
      });
      if (entry.type === 'dir' && dirs[childPath]?.expanded) walk(childPath, depth + 1);
    }
  };
  walk(props.root, 0);
  return result;
});

function isExpanded(path: string): boolean {
  return !!dirs[path]?.expanded;
}

async function loadDir(path: string, keepExpanded = true): Promise<void> {
  if (!props.fs) return;
  const state = dirs[path] ?? { entries: [], expanded: false, loading: false, loaded: false };
  dirs[path] = { ...state, loading: true };
  try {
    const result = await props.fs.list(path);
    dirs[path] = {
      entries: result.entries,
      expanded: keepExpanded ? state.expanded : state.expanded,
      loading: false,
      loaded: true,
    };
  } catch (error) {
    dirs[path] = { ...state, loading: false };
    toast.error(error instanceof Error ? error.message : '目录读取失败');
  }
}

async function toggle(path: string): Promise<void> {
  const state = dirs[path];
  if (!state?.loaded) {
    await loadDir(path);
    if (dirs[path]) dirs[path].expanded = true;
    return;
  }
  dirs[path].expanded = !dirs[path].expanded;
}

async function onRowClick(row: Row): Promise<void> {
  selected.value = row.path;
  if (row.type === 'dir') {
    await toggle(row.path);
    return;
  }
  emit('openFile', row.path, row.name, row.size);
}

function openMenu(event: MouseEvent, row: Row): void {
  selected.value = row.path;
  menu.path = row.path;
  menu.isDir = row.type === 'dir';
  menu.x = Math.max(8, Math.min(event.clientX, window.innerWidth - 190));
  menu.y = Math.max(8, Math.min(event.clientY, window.innerHeight - 320));
  menu.open = true;
}

async function onMenuAction(action: FsMenuAction): Promise<void> {
  const fs = props.fs;
  if (!fs) return;
  const path = menu.path;
  const isDir = menu.isDir;
  const parent = parentPath(path);

  switch (action) {
    case 'refresh':
      await loadDir(parent);
      break;
    case 'newFile': {
      const name = await dialog.prompt('新建文件', '文件名');
      if (!name) return;
      await fs.touch(joinPath(parent, name));
      await loadDir(parent);
      break;
    }
    case 'newFolder': {
      const name = await dialog.prompt('新建文件夹', '文件夹名');
      if (!name) return;
      await fs.mkdir(joinPath(parent, name));
      await loadDir(parent);
      break;
    }
    case 'rename': {
      const current = path.slice(path.lastIndexOf('/') + 1);
      const name = await dialog.prompt('重命名', '新名称', current);
      if (!name || name === current) return;
      try {
        await fs.stat(joinPath(parent, name));
        toast.error('目标名称已存在');
        return;
      } catch {
        // 目标不存在，继续重命名
      }
      await fs.rename(path, joinPath(parent, name));
      await loadDir(parent);
      break;
    }
    case 'copyPath':
      try {
        await navigator.clipboard.writeText(path);
        toast.success('路径已复制');
      } catch {
        toast.error('复制失败');
      }
      break;
    case 'openTerminal':
      emit('openTerminal', path);
      break;
    case 'upload':
      emit('pickFiles', isDir ? path : parent);
      break;
    case 'download':
      emit('download', path, path.slice(path.lastIndexOf('/') + 1));
      break;
    case 'delete': {
      const ok = await dialog.confirm('确认删除', `确认删除 ${path}？`);
      if (!ok) return;
      await fs.remove(path, isDir);
      await loadDir(parent);
      break;
    }
  }
}

function onDrop(event: DragEvent): void {
  dragOver.value = false;
  const files = [...(event.dataTransfer?.files ?? [])];
  if (!files.length) return;
  const target = selected.value && dirs[selected.value]?.entries.some(entry => entry.name === selected.value.split('/').pop())
    ? selected.value
    : props.root;
  emit('uploadFiles', files, target);
}

function formatSize(size: number): string {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} K`;
  return `${(size / 1024 / 1024).toFixed(1)} M`;
}

function formatTime(time: number): string {
  if (!time) return '';
  return new Date(time).toLocaleString();
}

async function refresh(path?: string): Promise<void> {
  await loadDir(path ?? props.root);
}

defineExpose({ refresh });

onMounted(() => {
  void loadDir(props.root);
});
</script>

<style scoped>
.fs-tree {
  position: relative;
  height: 100%;
  overflow: auto;
  padding: 6px 4px 12px;
  background: #12151a;
  color: #c9d1db;
  font-size: 12px;
}
.fs-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}
.fs-row:hover { background: #1b2129; }
.fs-row.active { background: #223047; }
.fs-caret {
  width: 12px;
  flex: none;
  text-align: center;
  color: #6b7686;
  font-size: 9px;
}
.fs-caret i { transition: transform 0.15s ease; }
.fs-caret.open i { transform: rotate(90deg); }
.fs-icon { color: #8b94a3; font-size: 11px; width: 13px; text-align: center; }
.fs-name { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.fs-size { color: #66707f; font-size: 10px; }
.fs-empty { padding: 16px 10px; color: #6b7686; font-size: 12px; }
</style>
