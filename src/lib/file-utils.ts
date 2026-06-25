/**
 * 文件处理工具函数
 */

// ─── 图片魔数（Magic Bytes） ──────────────────────────────

/** 常见图片格式的魔数字节前缀 */
const IMAGE_MAGIC_BYTES: Record<string, Uint8Array[]> = {
  'image/jpeg': [
    new Uint8Array([0xFF, 0xD8, 0xFF]),
  ],
  'image/png': [
    new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
  ],
  'image/gif': [
    new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), // GIF87a
    new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), // GIF89a
  ],
  'image/webp': [
    // WEBP: RIFF....WEBP (starts with RIFF, offset 8 has WEBP)
    new Uint8Array([0x52, 0x49, 0x46, 0x46]), // RIFF
  ],
};

/** 允许的图片 MIME 类型列表 */
export const ALLOWED_IMAGE_TYPES = Object.keys(IMAGE_MAGIC_BYTES);

/** 允许的图片扩展名集合 */
export const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

/**
 * 通过文件头魔数验证文件是否为真实的图片文件
 * 读取文件前若干字节，与已知图片格式的魔数进行比对
 * @param buffer 文件二进制数据
 * @returns 检测到的 MIME 类型，无法识别则返回 false
 */
export function detectImageMime(buffer: Uint8Array): string | false {
  if (buffer.length < 12) return false;

  for (const [mime, magics] of Object.entries(IMAGE_MAGIC_BYTES)) {
    for (const magic of magics) {
      if (magic.length <= buffer.length) {
        let match = true;
        for (let i = 0; i < magic.length; i++) {
          if (buffer[i] !== magic[i]) {
            match = false;
            break;
          }
        }
        if (match) {
          // WEBP 需要额外验证 offset 8-11 是 "WEBP"
          if (mime === 'image/webp') {
            if (buffer.length >= 12) {
              const webpMarker = new TextDecoder().decode(buffer.slice(8, 12));
              if (webpMarker === 'WEBP') return mime;
            }
            return false;
          }
          return mime;
        }
      }
    }
  }

  return false;
}
