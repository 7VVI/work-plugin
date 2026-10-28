import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import { noteAssetRepo, bufferToBase64 } from '../db/repositories/noteAssetRepo';
import { ASSET_REF_PREFIX, collectAssetRefs } from './noteAssets';

const markdown = new MarkdownIt({ html: true, linkify: true, breaks: false });

const PAGE_STYLE = `
  :root {
    color-scheme: light;
    /* 思源导出内容里的颜色变量，保证导出的 HTML 单文件也能还原颜色 */
    --b3-font-color1: #0f1726;
    --b3-font-color2: #6b7280;
    --b3-font-color3: #d97706;
    --b3-font-color4: #dc2626;
    --b3-font-color5: #16a34a;
    --b3-font-color6: #2563eb;
    --b3-font-color7: #7c3aed;
    --b3-font-color8: #db2777;
    --b3-font-color9: #ec4899;
    --b3-font-color10: #0891b2;
    --b3-font-color11: #65a30d;
    --b3-font-color12: #ca8a04;
    --b3-font-color13: #475569;
  }
  body {
    margin: 0;
    padding: 48px 24px 96px;
    background: #fff;
    color: #0F1726;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Luxi Sans", "Microsoft YaHei", "Noto Sans SC", arial, sans-serif;
    font-size: 16px;
    line-height: 1.625;
  }
  .page { max-width: 860px; margin: 0 auto; }
  .doc-title { margin: 0 0 6px; font-size: 32px; line-height: 1.3; font-weight: 700; }
  .doc-meta { margin: 0 0 24px; color: #AEB8C9; font-size: 12px; }
  h1, h2, h3, h4, h5, h6 { margin: 2px 0; padding: 4px; font-weight: 600; line-height: 1.25; }
  h1 { font-size: 1.75em; }
  h2 { font-size: 1.55em; }
  h3 { font-size: 1.38em; }
  h4 { font-size: 1.25em; }
  h5 { font-size: 1.13em; }
  h6 { font-size: 1em; }
  p { margin: 2px 0; padding: 4px; }
  mark { padding: 0 .1em; border-radius: 2px; background: rgba(255, 214, 0, .38); color: inherit; }
  sup, sub { line-height: 0; }
  a { color: #4285f4; text-decoration: none; }
  a:hover { text-decoration: underline; }
  ul, ol { margin: 2px 0; padding: 4px 4px 4px 1.8em; }
  li { margin: 0; }
  blockquote {
    margin: 2px 0;
    padding: 0 4px 0 calc(.25em + 6px);
    border-left: 4px solid #E1E8F2;
    border-radius: 2px;
    color: #4E5D75;
  }
  code {
    padding: .2em .4em;
    border-radius: 3px;
    background: rgba(27, 31, 35, .05);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 85%;
  }
  pre {
    margin: 2px 0;
    padding: 16px 14px;
    border-radius: 3px;
    background: rgba(27, 31, 35, .05);
    overflow-x: auto;
  }
  pre code { padding: 0; background: none; font-size: 13.6px; line-height: 1.625; }
  table { margin: 2px 0; border-collapse: collapse; font-size: 1em; }
  th, td { padding: 4px 8px; border: 1px solid #E1E8F2; text-align: left; }
  th { font-weight: 600; }
  tbody tr:nth-child(odd) td { background: rgba(15, 23, 38, .02); }
  hr { height: 1px; margin: 12px 4px; padding: 0; border: none; background: #E1E8F2; }
  img { max-width: 100%; border-radius: 4px; }
  @media print {
    body { padding: 0; }
    pre, blockquote, table, img { break-inside: avoid; }
  }
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 把正文里的本地图片引用换成 data URL，导出的 HTML 单文件离线也能看 */
async function inlineAssets(source: string): Promise<string> {
  const ids = collectAssetRefs(source);
  if (!ids.length) return source;
  let out = source;
  for (const id of ids) {
    const asset = await noteAssetRepo.get(id).catch(() => undefined);
    if (!asset) continue;
    const dataUrl = `data:${asset.mime};base64,${bufferToBase64(asset.data)}`;
    out = out.split(`${ASSET_REF_PREFIX}${id}`).join(dataUrl);
  }
  return out;
}

export interface NoteHtmlOptions {
  title: string;
  bookName?: string;
}

/** 把笔记 Markdown 渲染成可独立打开的单文件 HTML（样式对齐编辑器） */
export async function renderNoteHtml(source: string, options: NoteHtmlOptions): Promise<string> {
  // 正文里的原始 HTML（导入的思源片段等）先清洗再输出，导出的文件可直接分享
  const body = DOMPurify.sanitize(markdown.render(await inlineAssets(source)));
  const meta = [options.bookName, new Date().toLocaleString()].filter(Boolean).join(' · ');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(options.title)}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<div class="page">
<h1 class="doc-title">${escapeHtml(options.title)}</h1>
<p class="doc-meta">${escapeHtml(meta)}</p>
${body}
</div>
</body>
</html>
`;
}
