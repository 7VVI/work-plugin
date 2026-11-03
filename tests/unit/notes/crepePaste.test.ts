import { describe, it, expect } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { insertMarkdownImages, trimCodeBlockTail } from '../../../src/dashboard/components/notes/crepePaste';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    code_block: { content: 'text*', group: 'block', code: true, marks: '' },
    'image-block': {
      group: 'block',
      atom: true,
      attrs: {
        src: { default: '' },
        caption: { default: '' },
        ratio: { default: 1 },
      },
      toDOM: () => ['img'],
    },
    image: {
      inline: true,
      group: 'inline',
      atom: true,
      attrs: {
        src: { default: '' },
        alt: { default: null },
        title: { default: null },
      },
      toDOM: () => ['img'],
    },
    text: { group: 'inline' },
  },
  marks: {},
});

function stateWithCode(text: string): EditorState {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [schema.text('正文')]),
    schema.node('code_block', null, [schema.text(text)]),
  ]);
  return EditorState.create({ doc });
}

function codeText(state: EditorState): string {
  let value = '';
  state.doc.descendants(node => {
    if (node.type.name === 'code_block') value = node.textContent;
  });
  return value;
}

describe('insertMarkdownImages', () => {
  function makeView(): { view: EditorView; state: () => EditorState } {
    let state = EditorState.create({
      schema,
      doc: schema.node('doc', null, [schema.node('paragraph', null, [schema.text('正文')])]),
    });
    const view = {
      get state() { return state; },
      dispatch(tr: Parameters<EditorView['dispatch']>[0]) { state = state.apply(tr); },
      focus() { /* noop */ },
    } as unknown as EditorView;
    return { view, state: () => state };
  }

  function images(state: EditorState): string[] {
    const sources: string[] = [];
    state.doc.descendants((node: ProseNode) => {
      if (node.type.name === 'image-block' || node.type.name === 'image') sources.push(node.attrs.src);
    });
    return sources;
  }

  it('inserts a remote markdown image without touching local assets', () => {
    const { view, state } = makeView();
    const url = 'https://picgo.example.com/note.png';
    expect(insertMarkdownImages(view, `![image-1](${url})`)).toBe(true);
    expect(images(state())).toEqual([url]);
  });

  it('inserts multiple markdown images', () => {
    const { view, state } = makeView();
    const text = '![a](https://a.example/1.png)\n![b](https://b.example/2.png)';
    expect(insertMarkdownImages(view, text)).toBe(true);
    expect(images(state())).toEqual([
      'https://a.example/1.png',
      'https://b.example/2.png',
    ]);
  });

  it('renders images even when pasted together with text', () => {
    const { view, state } = makeView();
    expect(insertMarkdownImages(view, '看这张图 ![a](https://a.example/1.png)')).toBe(true);
    expect(images(state())).toEqual(['https://a.example/1.png']);
    expect(state().doc.textContent).toContain('看这张图');
  });

  it('does not intercept relative image paths', () => {
    const { view } = makeView();
    expect(insertMarkdownImages(view, '![a](./local.png)')).toBe(false);
  });

  it('accepts existing dock asset references', () => {
    const { view, state } = makeView();
    expect(insertMarkdownImages(view, '![a](dock-asset:ast_abc)')).toBe(true);
    expect(images(state())).toEqual(['dock-asset:ast_abc']);
  });
});

describe('trimCodeBlockTail', () => {
  it('removes the extra blank lines pasted after a code block', () => {
    const state = stateWithCode('docker push a\n\n');
    const tr = trimCodeBlockTail(state, 0, state.doc.content.size);
    expect(tr).not.toBeNull();
    expect(codeText(state.apply(tr!))).toBe('docker push a');
  });

  it('keeps inner blank lines intact', () => {
    const state = stateWithCode('a\n\nb\n');
    const tr = trimCodeBlockTail(state, 0, state.doc.content.size);
    expect(codeText(state.apply(tr!))).toBe('a\n\nb');
  });

  it('leaves code blocks without trailing newlines untouched', () => {
    const state = stateWithCode('a\nb');
    expect(trimCodeBlockTail(state, 0, state.doc.content.size)).toBeNull();
  });

  it('ignores code blocks outside the pasted range', () => {
    const state = stateWithCode('a\n\n');
    expect(trimCodeBlockTail(state, 0, 2)).toBeNull();
  });
});
