/** 笔记相关限制，客户端与服务端共用，避免两边不一致 */
export const MAX_NOTE_CONTENT = 262_144;
export const MAX_NOTE_TITLE = 512;
export const MAX_NOTEBOOK_NAME = 128;
export const MAX_TOTAL_NOTE_BYTES = 6 * 1024 * 1024;
