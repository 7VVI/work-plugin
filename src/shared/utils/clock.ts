/**
 * 把 Date 格式化为 HH:MM:SS（24 小时制，两位补零）。
 * 用于状态栏实时时钟。
 */
export function formatClockHHMMSS(date: Date): string {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}
