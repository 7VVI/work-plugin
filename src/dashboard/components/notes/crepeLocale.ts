import { CrepeFeature } from '@milkdown/crepe';
import { languages as codeLanguages } from '@codemirror/language-data';

/** 代码块语言按字母序排列（思源的语言列表也是 A-Z），便于快速定位 */
export const sortedCodeLanguages = [...codeLanguages].sort((a, b) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
);

/** Crepe 没有全局 locale，按功能覆盖内置英文标签 */
export const zhCrepeConfig = {
  [CrepeFeature.BlockEdit]: {
    textGroup: {
      label: '文本',
      text: { label: '正文' },
      h1: { label: '一级标题' },
      h2: { label: '二级标题' },
      h3: { label: '三级标题' },
      h4: { label: '四级标题' },
      h5: { label: '五级标题' },
      h6: { label: '六级标题' },
      quote: { label: '引用' },
      divider: { label: '分割线' },
    },
    listGroup: {
      label: '列表',
      bulletList: { label: '无序列表' },
      orderedList: { label: '有序列表' },
      taskList: { label: '任务列表' },
    },
    advancedGroup: {
      label: '高级',
      codeBlock: { label: '代码块' },
      table: { label: '表格' },
      math: { label: '公式' },
    },
  },
  [CrepeFeature.Toolbar]: {
    boldLabel: '加粗',
    italicLabel: '斜体',
    strikethroughLabel: '删除线',
    codeLabel: '行内代码',
    latexLabel: '行内公式',
    linkLabel: '链接',
  },
  [CrepeFeature.Placeholder]: {
    text: '输入 / 打开命令菜单，或直接开始写作…',
    mode: 'doc' as const,
  },
  [CrepeFeature.CodeMirror]: {
    previewOnlyByDefault: false,
    searchPlaceholder: '搜索',
    noResultText: '无结果',
    copyText: '复制',
  },
  [CrepeFeature.LinkTooltip]: {
    inputPlaceholder: '输入链接地址',
    editButton: '编辑',
    removeButton: '移除',
    confirmButton: '确定',
  },
};
