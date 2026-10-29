import type { Node as PMNode, Schema } from '@milkdown/kit/prose/model';
import { DOMSerializer } from '@milkdown/kit/prose/model';
import { TableMap } from '@milkdown/kit/prose/tables';

/** 与 crepeHtml 的 MdastLike 结构兼容的最小节点类型 */
export interface MdastLite {
  type?: string;
  value?: string;
  color?: string;
  children?: MdastLite[];
  align?: unknown;
  colspan?: number;
  rowspan?: number;
  colwidth?: number[] | null;
  isHeader?: boolean;
  url?: string;
  title?: string | null;
  [key: string]: unknown;
}

const CELL_TYPES = new Set(['table_cell', 'table_header']);

function isCell(node: PMNode): boolean {
  return CELL_TYPES.has(node.type.name);
}

/** 合并单元格或自定义列宽的表格，GFM 管道语法表达不了，需要写成 HTML */
export function needsHtmlTable(table: PMNode): boolean {
  let advanced = false;
  table.descendants((node) => {
    if (advanced || !isCell(node)) return !advanced;
    const { colspan, rowspan, colwidth } = node.attrs as {
      colspan?: number;
      rowspan?: number;
      colwidth?: number[] | null;
    };
    if ((colspan ?? 1) > 1 || (rowspan ?? 1) > 1) advanced = true;
    else if (Array.isArray(colwidth) && colwidth.some((width) => width > 0)) advanced = true;
    return !advanced;
  });
  return advanced;
}

function cellHtml(serializer: DOMSerializer, cell: PMNode): string {
  const holder = document.createElement('div');
  const paragraph = cell.firstChild;
  holder.appendChild(serializer.serializeFragment(paragraph ? paragraph.content : cell.content));
  // Milkdown 的硬换行会带 data-* 属性，写进 Markdown 前还原成普通 <br>
  return holder.innerHTML.replace(/<br\b[^>]*>/gi, '<br>');
}

function cellAlign(cell: PMNode): string {
  const align = String(cell.attrs.alignment ?? '');
  return align === 'center' || align === 'right' ? align : '';
}

/** 把表格节点序列化成单行 HTML，防止 remark 在标签之间插入空白 */
export function serializeTableHtml(table: PMNode, schema: Schema): string {
  const serializer = DOMSerializer.fromSchema(schema);
  const rows: PMNode[] = [];
  table.forEach((row) => rows.push(row));
  if (!rows.length) return '';

  const map = TableMap.get(table);
  const widths = new Array<number>(map.width).fill(0);
  for (let row = 0; row < map.height; row += 1) {
    for (let col = 0; col < map.width; col += 1) {
      const pos = map.map[row * map.width + col];
      if (pos == null) continue;
      const cell = table.nodeAt(pos);
      if (!cell || !isCell(cell)) continue;
      const colwidth = cell.attrs.colwidth as number[] | null | undefined;
      if (!Array.isArray(colwidth)) continue;
      const start = map.colCount(pos);
      colwidth.forEach((width, index) => {
        if (width > 0 && !widths[start + index]) widths[start + index] = width;
      });
    }
  }

  const colgroup = widths.some((width) => width > 0)
    ? `<colgroup>${widths.map((width) => (width > 0 ? `<col style="width: ${width}px">` : '<col>')).join('')}</colgroup>`
    : '';

  const renderRow = (row: PMNode): string => {
    const cells: string[] = [];
    row.forEach((cell) => {
      const tag = cell.type.name === 'table_header' ? 'th' : 'td';
      const colspan = Number(cell.attrs.colspan ?? 1);
      const rowspan = Number(cell.attrs.rowspan ?? 1);
      const spans = `${colspan > 1 ? ` colspan="${colspan}"` : ''}${rowspan > 1 ? ` rowspan="${rowspan}"` : ''}`;
      const align = cellAlign(cell);
      const style = align ? ` style="text-align:${align}"` : '';
      cells.push(`<${tag}${spans}${style}>${cellHtml(serializer, cell)}</${tag}>`);
    });
    return `<tr>${cells.join('')}</tr>`;
  };

  const head = `<thead>${renderRow(rows[0])}</thead>`;
  const bodyRows = rows.slice(1);
  const body = bodyRows.length ? `<tbody>${bodyRows.map(renderRow).join('')}</tbody>` : '';
  return `<table>${colgroup}${head}${body}</table>`;
}

const BLOCK_WRAPPERS = new Set(['p', 'div', 'li', 'ul', 'ol', 'blockquote', 'section']);

function readAlign(element: HTMLElement): string {
  const align = (element.style.textAlign || element.getAttribute('align') || '').toLowerCase();
  return align === 'center' || align === 'right' ? align : 'left';
}

function inlineChildren(element: Element): MdastLite[] {
  const out: MdastLite[] = [];
  element.childNodes.forEach((node) => appendInline(node, out));
  return out;
}

function appendInline(node: Node, out: MdastLite[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.nodeValue ?? '';
    if (value) out.push({ type: 'text', value });
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  const pushWrapped = (type: string, extra?: Record<string, unknown>): void => {
    out.push({ type, children: inlineChildren(element), ...extra });
  };

  switch (tag) {
    case 'br':
      out.push({ type: 'break' });
      return;
    case 'code':
      out.push({ type: 'inlineCode', value: element.textContent ?? '' });
      return;
    case 'a': {
      const url = element.getAttribute('href') ?? '';
      out.push({ type: 'link', url, title: null, children: inlineChildren(element) });
      return;
    }
    case 'strong':
    case 'b':
      pushWrapped('strong');
      return;
    case 'em':
    case 'i':
      pushWrapped('emphasis');
      return;
    case 'del':
    case 's':
    case 'strike':
      pushWrapped('delete');
      return;
    case 'u':
      pushWrapped('underline');
      return;
    case 'mark':
      pushWrapped('highlight');
      return;
    case 'sup':
      pushWrapped('superscript');
      return;
    case 'sub':
      pushWrapped('subscript');
      return;
    case 'span': {
      const raw = element.getAttribute('data-dock-html');
      if (raw) {
        out.push({ type: 'html', value: raw });
        return;
      }
      const color = element.style.color;
      if (color) {
        out.push({ type: 'textColor', color, children: inlineChildren(element) });
        return;
      }
      break;
    }
    default:
      break;
  }

  // <p>/<div> 等块级包装拆成行内内容；未知标签保留其子内容
  if (BLOCK_WRAPPERS.has(tag)) {
    const children = inlineChildren(element);
    if (out.length && children.length) out.push({ type: 'break' });
    out.push(...children);
    return;
  }
  element.childNodes.forEach((child) => appendInline(child, out));
}

function columnAligns(header: MdastLite): string[] {
  const aligns: string[] = [];
  for (const cell of header.children ?? []) {
    const span = Number(cell.colspan ?? 1);
    for (let index = 0; index < span; index += 1) aligns.push(String(cell.align ?? 'left'));
  }
  return aligns;
}

/**
 * 把 remark 解析出的 <table>…</table> HTML 块还原成 GFM 表格 mdast：
 * 保留 colspan/rowspan/colwidth/alignment，首行作为表头（PM 表格结构要求）。
 */
export function parseHtmlTable(html: string): MdastLite | null {
  const trimmed = html.trim();
  if (!/^<table[\s>]/i.test(trimmed) || !/<\/table>\s*$/i.test(trimmed)) return null;

  const doc = new DOMParser().parseFromString(trimmed, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;
  const htmlRows = Array.from(table.rows);
  if (!htmlRows.length) return null;

  const widths = Array.from(table.querySelectorAll('colgroup > col')).map((col) => {
    const match = /([\d.]+)px/.exec((col as HTMLElement).style.width);
    return match ? Number(match[1]) : 0;
  });

  const occupied: boolean[][] = [];
  const rows: MdastLite[] = htmlRows.map((row, rowIndex) => {
    const cells: MdastLite[] = [];
    let col = 0;
    for (const htmlCell of Array.from(row.cells)) {
      while (occupied[rowIndex]?.[col]) col += 1;
      const colspan = Math.max(1, htmlCell.colSpan || 1);
      const rowspan = Math.max(1, htmlCell.rowSpan || 1);
      for (let r = rowIndex; r < rowIndex + rowspan; r += 1) {
        occupied[r] ??= [];
        for (let c = col; c < col + colspan; c += 1) occupied[r][c] = true;
      }
      const colwidth = colspan > 0 ? widths.slice(col, col + colspan) : [];
      cells.push({
        type: 'tableCell',
        isHeader: rowIndex === 0,
        align: readAlign(htmlCell),
        colspan: colspan > 1 ? colspan : undefined,
        rowspan: rowspan > 1 ? rowspan : undefined,
        colwidth: colwidth.some((width) => width > 0) ? colwidth.map((width) => width || 0) : undefined,
        children: inlineChildren(htmlCell),
      });
      col += colspan;
    }
    return { type: 'tableRow', children: cells };
  });
  if (!rows.length) return null;

  for (const cell of rows[0].children ?? []) cell.isHeader = true;
  if (rows.length === 1) {
    const columns = (rows[0].children ?? []).reduce((sum, cell) => sum + Number(cell.colspan ?? 1), 0);
    rows.push({
      type: 'tableRow',
      children: Array.from({ length: Math.max(1, columns) }, () => ({ type: 'tableCell', children: [] })),
    });
  }

  return { type: 'table', align: columnAligns(rows[0]), children: rows };
}
