import { describe, it, expect } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import { EditorState, TextSelection } from '@milkdown/kit/prose/state';
import { EditorView } from '@milkdown/kit/prose/view';
import { noteKeyHandlers } from '../../../src/dashboard/components/notes/crepeKeys';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block', toDOM: () => ['p', 0] },
    heading: {
      content: 'inline*',
      group: 'block',
      defining: true,
      attrs: { level: { default: 1 } },
      toDOM: node => [`h${node.attrs.level}`, 0],
    },
    code_block: {
      content: 'text*',
      group: 'block',
      code: true,
      marks: '',
      defining: true,
      toDOM: () => ['pre', ['code', 0]],
    },
    text: { group: 'inline' },
  },
  marks: {},
});

function makeView(doc: ReturnType<typeof schema.node>, from: number, to = from): EditorView {
  const state = EditorState.create({ doc, selection: TextSelection.create(doc, from, to) });
  const place = document.createElement('div');
  document.body.appendChild(place);
  return new EditorView(place, { state });
}

function keyEvent(key: string): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
}

function outline(view: EditorView): string[] {
  const result: string[] = [];
  view.state.doc.forEach(node => {
    result.push(`${node.type.name}${node.attrs.level ? node.attrs.level : ''}:${node.textContent}`);
  });
  return result;
}

describe('note editor key behavior', () => {
  it('keeps a typed code fence as text when the line still has content after the cursor', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('```json国内：hi-cors')]),
    ]);
    const view = makeView(doc, 1 + '```json'.length);

    const handled = noteKeyHandlers.keepFenceAsText(view, view.state.selection.from, view.state.selection.to, ' ');

    expect(handled).toBe(true);
    expect(view.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(view.state.doc.textContent).toBe('```json 国内：hi-cors');
  });

  it('leaves an empty line free to become a code block', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('```json')]),
    ]);
    const view = makeView(doc, 1 + '```json'.length);

    const handled = noteKeyHandlers.keepFenceAsText(view, view.state.selection.from, view.state.selection.to, ' ');

    expect(handled).toBe(false);
  });

  it('merges instead of downgrading the heading on Backspace at its start', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('上一行')]),
      schema.node('heading', { level: 2 }, [schema.text('二级标题')]),
    ]);
    const view = makeView(doc, 1 + '上一行'.length + 2);

    const handled = noteKeyHandlers.handleHeadingDelete(view, keyEvent('Backspace'));

    expect(handled).toBe(true);
    expect(outline(view)).toEqual(['paragraph:上一行二级标题']);
  });

  it('removes an empty line that sits right after a code block', () => {
    const doc = schema.node('doc', null, [
      schema.node('code_block', null, [schema.text('docker tag xxx')]),
      schema.node('paragraph', null, []),
    ]);
    const view = makeView(doc, doc.firstChild!.nodeSize + 1);

    const handled = noteKeyHandlers.handleEmptyBlockDelete(view, keyEvent('Backspace'));

    expect(handled).toBe(true);
    expect(outline(view)).toEqual(['code_block:docker tag xxx']);
  });

  it('leaves normal Backspace inside a heading untouched', () => {
    const doc = schema.node('doc', null, [
      schema.node('heading', { level: 2 }, [schema.text('二级标题')]),
    ]);
    const view = makeView(doc, 1 + 2);

    expect(noteKeyHandlers.handleHeadingDelete(view, keyEvent('Backspace'))).toBe(false);
  });
});
