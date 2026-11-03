<template>
  <div class="remote-editor">
    <header class="re-head">
      <i class="fa-regular fa-file-lines re-icon"></i>
      <span class="re-name mono" :title="path">{{ name }}</span>
      <span class="re-path mono t3">{{ path }}</span>
      <span v-if="dirty" class="re-dirty">未保存</span>
      <span class="re-spacer"></span>
      <button class="re-btn" :disabled="!dirty || saving" @click="save">
        <i class="fa-solid fa-floppy-disk"></i>{{ saving ? '保存中…' : '保存' }}
      </button>
      <button class="re-btn" @click="close"><i class="fa-solid fa-xmark"></i></button>
    </header>
    <div ref="hostEl" class="re-host"></div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { EditorState, Compartment } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { languageExtensionFor } from '@shared/ssh/cmLanguage';
import { crepeHighlightExtension } from '../notes/crepeHighlight';

const props = defineProps<{
  path: string;
  name: string;
  content: string;
  saving?: boolean;
}>();

const emit = defineEmits<{
  save: [text: string];
  close: [];
  dirty: [value: boolean];
}>();

const hostEl = ref<HTMLElement | null>(null);
const dirty = ref(false);
let view: EditorView | null = null;
let languageCompartment = new Compartment();

const editorTheme = EditorView.theme({
  '&': { backgroundColor: '#0f1113', color: '#e8eaed', height: '100%' },
  '.cm-content': { fontFamily: 'var(--font-mono)', fontSize: '13px', padding: '10px 12px' },
  '.cm-gutters': { backgroundColor: '#0f1113', color: '#5b6472', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgba(91, 141, 239, 0.08)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(91, 141, 239, 0.08)', color: '#8b94a3' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(203, 216, 243, 0.35)' },
}, { dark: true });

function createView(text: string): EditorView {
  return new EditorView({
    state: EditorState.create({
      doc: text,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        editorTheme,
        crepeHighlightExtension,
        languageCompartment.of([]),
        keymap.of([
          {
            key: 'Mod-s',
            run: () => {
              emit('save', view?.state.doc.toString() ?? '');
              return true;
            },
          },
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of(update => {
          if (!update.docChanged) return;
          const text = update.state.doc.toString();
          dirty.value = text !== props.content;
          emit('dirty', dirty.value);
        }),
      ],
    }),
    parent: hostEl.value!,
  });
}

function loadLanguage(name: string): void {
  void languageExtensionFor(name).then(support => {
    if (!view || !support) return;
    view.dispatch({ effects: languageCompartment.reconfigure(support) });
  });
}

function save(): void {
  if (!view) return;
  emit('save', view.state.doc.toString());
}

function close(): void {
  emit('close');
}

onMounted(() => {
  view = createView(props.content);
  loadLanguage(props.name);
});

watch(() => props.content, value => {
  if (!view || view.state.doc.toString() === value) {
    dirty.value = false;
    emit('dirty', false);
  }
});

watch(() => props.path, (value, previous) => {
  if (!previous || value === previous) return;
  view?.destroy();
  view = null;
  dirty.value = false;
  emit('dirty', false);
  nextTick(() => {
    if (!hostEl.value) return;
    view = createView(props.content);
    loadLanguage(props.name);
  });
});

onBeforeUnmount(() => {
  view?.destroy();
  view = null;
});
</script>

<style scoped>
.remote-editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  background: #0f1113;
  color: #e8eaed;
}
.re-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 10px;
  border-bottom: 1px solid #22272e;
  background: #12151a;
  flex-shrink: 0;
}
.re-icon { color: #8b94a3; font-size: 12px; }
.re-name { font-size: 12px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.re-path { font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.re-dirty { font-size: 11px; color: #facc15; }
.re-spacer { flex: 1; }
.re-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px;
  border: 1px solid #2a3038;
  border-radius: 6px;
  background: transparent;
  color: #c9d1db;
  font-size: 11px;
  cursor: pointer;
}
.re-btn:hover:not(:disabled) { background: #1f242c; color: #fff; }
.re-btn:disabled { opacity: 0.45; cursor: default; }
.re-host { flex: 1; min-height: 0; overflow: auto; }
.re-host :deep(.cm-editor) { height: 100%; }
.re-host :deep(.cm-scroller) { font-family: var(--font-mono); }
</style>
