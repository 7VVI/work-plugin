import { describe, it, expect } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import { EditorState } from '@milkdown/kit/prose/state';
import { trimCodeBlockTail } from '../../../src/dashboard/components/notes/crepePaste';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    code_block: { content: 'text*', group: 'block', code: true, marks: '' },
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
