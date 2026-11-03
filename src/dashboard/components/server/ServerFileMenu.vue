<template>
  <Teleport to="body">
    <div v-if="open" class="fs-menu-backdrop" @mousedown="emit('close')" @contextmenu.prevent="emit('close')"></div>
    <div v-if="open" class="fs-menu" :style="{ left: `${x}px`, top: `${y}px` }" @mousedown.stop>
      <button class="fs-menu-item" @click="run('refresh')">
        <i class="fa-solid fa-rotate"></i><span>刷新</span>
      </button>
      <div v-if="isDir" class="fs-menu-sep"></div>
      <button v-if="isDir" class="fs-menu-item" @click="run('newFile')">
        <i class="fa-regular fa-file"></i><span>新建文件</span>
      </button>
      <button v-if="isDir" class="fs-menu-item" @click="run('newFolder')">
        <i class="fa-regular fa-folder"></i><span>新建文件夹</span>
      </button>
      <div class="fs-menu-sep"></div>
      <button class="fs-menu-item" @click="run('rename')">
        <i class="fa-solid fa-pen"></i><span>重命名</span>
      </button>
      <button class="fs-menu-item" @click="run('copyPath')">
        <i class="fa-regular fa-copy"></i><span>复制路径</span>
      </button>
      <button v-if="isDir" class="fs-menu-item" @click="run('openTerminal')">
        <i class="fa-solid fa-terminal"></i><span>在此打开终端</span>
      </button>
      <div v-if="isDir" class="fs-menu-sep"></div>
      <button v-if="isDir" class="fs-menu-item" @click="run('upload')">
        <i class="fa-solid fa-arrow-up"></i><span>上传到此目录</span>
      </button>
      <button v-if="!isDir" class="fs-menu-item" @click="run('download')">
        <i class="fa-solid fa-arrow-down"></i><span>下载文件</span>
      </button>
      <div class="fs-menu-sep"></div>
      <button class="fs-menu-item danger" @click="run('delete')">
        <i class="fa-regular fa-trash-can"></i><span>删除</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
export type FsMenuAction =
  | 'refresh'
  | 'newFile'
  | 'newFolder'
  | 'rename'
  | 'copyPath'
  | 'openTerminal'
  | 'upload'
  | 'download'
  | 'delete';

withDefaults(defineProps<{ open: boolean; x: number; y: number; isDir: boolean }>(), {
  open: false,
  x: 0,
  y: 0,
  isDir: false,
});

const emit = defineEmits<{ run: [action: FsMenuAction]; close: [] }>();

function run(action: FsMenuAction): void {
  emit('run', action);
  emit('close');
}
</script>

<style scoped>
.fs-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10050;
}
.fs-menu {
  position: fixed;
  z-index: 10051;
  min-width: 168px;
  padding: 4px;
  border: 1px solid #2a3038;
  border-radius: 8px;
  background: #171b21;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}
.fs-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #dfe4ea;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.fs-menu-item:hover { background: #232a33; }
.fs-menu-item i { width: 14px; font-size: 11px; text-align: center; color: #8b94a3; }
.fs-menu-item.danger:hover { color: #f87171; }
.fs-menu-sep {
  height: 1px;
  margin: 4px 2px;
  background: #2a3038;
}
</style>
