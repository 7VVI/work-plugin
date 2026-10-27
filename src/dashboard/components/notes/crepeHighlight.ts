import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/**
 * 代码高亮对齐思源使用的 highlight.js GitHub 主题，
 * 取代 Milkdown Crepe 默认注入的 One Dark 配色。
 *
 * 颜色统一走 CSS 变量（--note-tok-*），明暗两套主题只在样式里切换变量值，
 * 避免暗色模式仍用浅色主题的深色文字导致代码看不清。
 */
const githubStyle = HighlightStyle.define([
  { tag: tags.comment, color: 'var(--note-tok-comment)', fontStyle: 'italic' },
  { tag: [tags.keyword, tags.modifier, tags.controlKeyword], color: 'var(--note-tok-keyword)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--note-tok-string)' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--note-tok-number)' },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--note-tok-type)' },
  { tag: tags.propertyName, color: 'var(--note-tok-property)' },
  { tag: tags.function(tags.variableName), color: 'var(--note-tok-function)' },
  { tag: tags.variableName, color: 'var(--note-tok-variable)' },
  { tag: [tags.operator, tags.punctuation, tags.separator, tags.bracket], color: 'var(--note-tok-punctuation)' },
  { tag: [tags.meta, tags.annotation, tags.processingInstruction], color: 'var(--note-tok-comment)' },
  { tag: [tags.link, tags.url], color: 'var(--note-tok-link)', textDecoration: 'underline' },
  { tag: tags.invalid, color: 'var(--note-tok-invalid)' },
]);

export const crepeHighlightExtension = syntaxHighlighting(githubStyle);
