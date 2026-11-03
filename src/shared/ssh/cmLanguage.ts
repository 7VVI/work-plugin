import { languages as codeLanguages } from '@codemirror/language-data';
import type { Extension } from '@codemirror/state';

/**
 * 按文件名/扩展名解析 CodeMirror 语言支持；解析不到返回 null（纯文本编辑器）。
 */
export async function languageExtensionFor(fileName: string): Promise<Extension | null> {
  const lower = fileName.toLowerCase();
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : '';
  const descriptor = codeLanguages.find(language =>
    language.extensions.some(candidate => candidate.toLowerCase() === ext),
  ) ?? codeLanguages.find(language => language.filename?.test(lower));
  if (!descriptor) return null;
  try {
    return await descriptor.load();
  } catch {
    return null;
  }
}
