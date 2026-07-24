/**
 * 将值深拷贝为「纯对象」，剥离 Vue 响应式 Proxy 以及函数、Symbol 等
 * IndexedDB 结构化克隆算法无法处理的内容。
 *
 * 用于所有 Dexie 写入（put/add/update）前，避免：
 *   DataCloneError: Failed to execute 'put' on 'IDBObjectStore':
 *   #<Object> could not be cloned.
 *
 * 数据均为 JSON 可序列化（字符串 / 数字 / 布尔 / 普通对象 / 数组 / 时间戳数字），
 * 因此用 JSON 往返是最稳妥的深剥离方式。
 */
export function toPlain<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value)) as T;
}
