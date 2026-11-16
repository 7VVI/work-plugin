<template>
  <div class="db-editor" :class="{ 'is-drop': dropActive }"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave">
    <div ref="hostEl" class="db-editor-host"></div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import type { DbDialect } from '@protocol/db';
import { sqlLanguageExtension } from '@shared/db/sqlLanguage';
import { qualifiedTable } from '@shared/db/sql';

const props = defineProps<{
  modelValue: string;
  dialect?: DbDialect | null;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  /** 光标位置变化（用于执行光标所在语句） */
  cursor: [position: number];
  run: [];
  runAll: [];
  save: [];
}>();

const hostEl = ref<HTMLElement | null>(null);
const dropActive = ref(false);
let view: EditorView | null = null;
const languageCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

const editorTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--panel)', color: 'var(--ink)', height: '100%' },
  '.cm-content': { fontFamily: 'var(--font-mono)', fontSize: '12.5px', padding: '8px 10px' },
  '.cm-gutters': { backgroundColor: 'var(--panel)', color: 'var(--ink4)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--surface-hover)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--surface-hover)', color: 'var(--ink3)' },
  '.cm-scroller': { overflow: 'auto' },
});

/** 从对象树拖进来的表名 */
function readDroppedTable(event: DragEvent): { schema?: string; name: string } | null {
  const raw = event.dataTransfer?.getData('application/x-dock-db-table');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { schema?: string; name: string };
    return parsed && parsed.name ? parsed : null;
  } catch {
    return null;
  }
}

function onDragOver(event: DragEvent): void {
  if (!event.dataTransfer?.types.includes('application/x-dock-db-table')) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  dropActive.value = true;
}

function onDragLeave(): void {
  dropActive.value = false;
}

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
        languageCompartment.of([]),
        readOnlyCompartment.of(props.readOnly ? EditorState.readOnly.of(true) : []),
        EditorView.domEventHandlers({ drop: (event, editor) => {
          const dropped = readDroppedTable(event as DragEvent);
          if (!dropped) return false;
          event.preventDefault();
          const insert = qualifiedTable(dropped.schema, dropped.name, props.dialect);
          const pos = editor.posAtCoords({ x: event.clientX, y: event.clientY }) ?? editor.state.selection.main.head;
          editor.dispatch({
            changes: { from: pos, to: pos, insert },
            selection: { anchor: pos + insert.length },
          });
          return true;
        } }),
        keymap.of([
          { key: 'Mod-Enter', run: () => { emit('run'); return true; } },
          { key: 'Shift-Mod-Enter', run: () => { emit('runAll'); return true; } },
          { key: 'Mod-s', run: () => { emit('save'); return true; } },
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            emit('update:modelValue', update.state.doc.toString());
          }
          if (update.selectionSet) {
            emit('cursor', update.state.selection.main.head);
          }
        }),
      ],
    }),
    parent: hostEl.value!,
  });
}

function loadLanguage(): void {
  void sqlLanguageExtension(props.dialect).then(support => {
    if (!view || !support) return;
    view.dispatch({ effects: languageCompartment.reconfigure(support) });
  });
}

onMounted(async () => {
  await nextTick();
  view = createView(props.modelValue);
  loadLanguage();
  emit('cursor', 0);
});

onBeforeUnmount(() => {
  view?.destroy();
  view = null;
});

watch(() => props.modelValue, (value) => {
  if (!view) return;
  const current = view.state.doc.toString();
  if (current === value) return;
  view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
});

watch(() => props.dialect, () => loadLanguage());

watch(() => props.readOnly, (value) => {
  if (!view) return;
  view.dispatch({ effects: readOnlyCompartment.reconfigure(value ? EditorState.readOnly.of(true) : []) });
});
</script>

<style scoped>
.db-editor { height: 100%; min-height: 0; overflow: hidden; position: relative; }
.db-editor-host { height: 100%; }
.db-editor.is-drop::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border: 2px dashed var(--accent);
  border-radius: var(--radius-sm);
  background: var(--primary-50);
  opacity: .5;
}
</style>
