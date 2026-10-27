<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="ctx-menu"
      :style="{ left: `${x}px`, top: `${y}px` }"
      @contextmenu.prevent
      @mousedown.stop
    >
      <div class="ctx-group">
        <button class="ctx-tool" title="剪切" @click="run('cut')">
          <i class="fa-solid fa-scissors"></i>
        </button>
        <button class="ctx-tool" title="复制" @click="run('copy')">
          <i class="fa-regular fa-copy"></i>
        </button>
        <button class="ctx-tool" title="粘贴" @click="run('paste')">
          <i class="fa-regular fa-paste"></i>
        </button>
        <button class="ctx-tool danger" title="删除" @click="run('delete')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>

      <div class="ctx-sep"></div>

      <div class="ctx-group ctx-rows">
        <div class="ctx-row" @mouseenter="sub = 'copy'" @mouseleave="sub = null">
          <span class="ctx-label">复制为…</span>
          <i class="fa-solid fa-chevron-right ctx-arrow"></i>
          <div v-if="sub === 'copy'" class="ctx-submenu">
            <button class="ctx-item" @click="run('copyAs', 'text')">纯文本</button>
            <button class="ctx-item" @click="run('copyAs', 'markdown')">Markdown 源码（整篇）</button>
          </div>
        </div>
        <div class="ctx-row" @mouseenter="sub = 'paste'" @mouseleave="sub = null">
          <span class="ctx-label">粘贴为…</span>
          <i class="fa-solid fa-chevron-right ctx-arrow"></i>
          <div v-if="sub === 'paste'" class="ctx-submenu">
            <button class="ctx-item" @click="run('pasteAs', 'text')">纯文本</button>
            <button class="ctx-item" @click="run('pasteAs', 'markdown')">Markdown 源码</button>
          </div>
        </div>
      </div>

      <div class="ctx-sep"></div>

      <div class="ctx-group">
        <button class="ctx-tool ctx-bold" title="加粗 (Ctrl+B)" @click="run('bold')">B</button>
        <button class="ctx-tool ctx-italic" title="斜体 (Ctrl+I)" @click="run('italic')">I</button>
        <button class="ctx-tool ctx-mono" title="行内代码" @click="run('code')">&lt;/&gt;</button>
        <button class="ctx-tool" title="链接 (Ctrl+K)" @click="run('link')">
          <i class="fa-solid fa-link"></i>
        </button>
      </div>

      <div class="ctx-group">
        <button class="ctx-tool" title="引用" @click="run('quote')">
          <i class="fa-solid fa-quote-right"></i>
        </button>
        <button class="ctx-tool" title="无序列表" @click="run('bullet')">
          <i class="fa-solid fa-list-ul"></i>
        </button>
        <button class="ctx-tool" title="有序列表" @click="run('ordered')">
          <i class="fa-solid fa-list-ol"></i>
        </button>
        <button class="ctx-tool" title="任务列表" @click="run('task')">
          <i class="fa-solid fa-list-check"></i>
        </button>
      </div>

      <div class="ctx-sep"></div>

      <div class="ctx-group ctx-rows">
        <div class="ctx-row" @mouseenter="sub = 'paragraph'" @mouseleave="sub = null">
          <span class="ctx-label">段落</span>
          <i class="fa-solid fa-chevron-right ctx-arrow"></i>
          <div v-if="sub === 'paragraph'" class="ctx-submenu">
            <button class="ctx-item" @click="run('paragraph', 'body')">正文</button>
            <button class="ctx-item" @click="run('paragraph', 'h1')">标题 1</button>
            <button class="ctx-item" @click="run('paragraph', 'h2')">标题 2</button>
            <button class="ctx-item" @click="run('paragraph', 'h3')">标题 3</button>
            <button class="ctx-item" @click="run('paragraph', 'h4')">标题 4</button>
            <button class="ctx-item" @click="run('paragraph', 'h5')">标题 5</button>
            <button class="ctx-item" @click="run('paragraph', 'h6')">标题 6</button>
            <button class="ctx-item" @click="run('paragraph', 'quote')">引用</button>
            <button class="ctx-item" @click="run('paragraph', 'code')">代码块</button>
          </div>
        </div>
        <div class="ctx-row" @mouseenter="sub = 'insert'" @mouseleave="sub = null">
          <span class="ctx-label">插入</span>
          <i class="fa-solid fa-chevron-right ctx-arrow"></i>
          <div v-if="sub === 'insert'" class="ctx-submenu">
            <button class="ctx-item" @click="run('insert', 'table')">表格</button>
            <button class="ctx-item" @click="run('insert', 'hr')">分割线</button>
            <button class="ctx-item" @click="run('insert', 'code')">代码块</button>
            <button class="ctx-item" @click="run('insert', 'math')">数学公式</button>
            <button class="ctx-item" @click="run('insert', 'link')">链接</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  open: boolean;
  x: number;
  y: number;
}>();

const emit = defineEmits<{
  run: [action: string, arg?: string];
}>();

const sub = ref<string | null>(null);

function run(action: string, arg?: string): void {
  emit('run', action, arg);
}
</script>

<style scoped>
.ctx-menu {
  position: fixed;
  z-index: 10050;
  min-width: 208px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--panel);
  box-shadow: var(--shadow-lg);
  font-family: var(--font-sans);
  color: var(--ink2);
  user-select: none;
}
.ctx-group {
  display: flex;
  align-items: center;
  gap: 2px;
}
.ctx-group.ctx-rows {
  flex-direction: column;
  align-items: stretch;
  gap: 0;
}
.ctx-tool {
  width: 34px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink2);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}
.ctx-tool:hover { background: var(--panel2); color: var(--ink); }
.ctx-tool.danger:hover { color: var(--danger); }
.ctx-bold { font-weight: 700; }
.ctx-italic { font-style: italic; }
.ctx-mono { font-family: var(--font-mono); font-size: 11px; }
.ctx-sep {
  height: 1px;
  margin: 5px 4px;
  background: var(--border);
}
.ctx-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: default;
}
.ctx-row:hover { background: var(--panel2); color: var(--ink); }
.ctx-label { flex: 1; }
.ctx-arrow { font-size: 9px; color: var(--ink4); }
.ctx-submenu {
  position: absolute;
  left: calc(100% - 2px);
  top: -6px;
  min-width: 172px;
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--panel);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ctx-item {
  padding: 6px 9px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink2);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}
.ctx-item:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); }
</style>
