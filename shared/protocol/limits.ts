/** 笔记相关限制，客户端与服务端共用，避免两边不一致 */
export const MAX_NOTE_CONTENT = 262_144;
export const MAX_NOTE_TITLE = 512;
export const MAX_NOTEBOOK_NAME = 128;
export const MAX_TOTAL_NOTE_BYTES = 6 * 1024 * 1024;
/** 单张图片原始字节上限 */
export const MAX_ASSET_BYTES = 2 * 1024 * 1024;
/** 单次同步携带的图片原始字节总量上限（base64 后约放大 4/3，需留出快照余量） */
export const MAX_TOTAL_ASSET_BYTES = 6 * 1024 * 1024;
