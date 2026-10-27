import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/**
 * 代码高亮配色对齐思源使用的 highlight.js GitHub 主题（浅色），
 * 取代 Milkdown Crepe 默认注入的 One Dark 配色。
 */
const githubLight = HighlightStyle.define([
  { tag: tags.comment, color: '#6a737d', fontStyle: 'italic' },
  { tag: [tags.keyword, tags.modifier, tags.controlKeyword], color: '#d73a49' },
  { tag: [tags.string, tags.special(tags.string)], color: '#032f62' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: '#005cc5' },
  { tag: [tags.typeName, tags.className, tags.namespace], color: '#6f42c1' },
  { tag: tags.propertyName, color: '#005cc5' },
  { tag: tags.function(tags.variableName), color: '#6f42c1' },
  { tag: tags.variableName, color: '#24292e' },
  { tag: [tags.operator, tags.punctuation, tags.separator, tags.bracket], color: '#24292e' },
  { tag: [tags.meta, tags.annotation, tags.processingInstruction], color: '#6a737d' },
  { tag: [tags.link, tags.url], color: '#032f62', textDecoration: 'underline' },
  { tag: tags.invalid, color: '#d73a49' },
]);

export const crepeHighlightExtension = syntaxHighlighting(githubLight);
