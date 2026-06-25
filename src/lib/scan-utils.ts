'use client';

// ─── BarcodeDetector 类型定义 ──────────────────────────
export interface BarcodeDetectorResult {
  rawValue: string;
  format?: string;
}
export interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>;
  getSupportedFormats?: () => Promise<string[]>;
}
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

// ─── 条码格式常量 ──────────────────────────────────────
/** 支持的所有 1D/2D 条码格式 */
export const ALL_BARCODE_FORMATS = [
  'code_128', 'code_39', 'code_93', 'codabar',
  'ean_13', 'ean_8', 'upc_a', 'upc_e',
  'itf', 'qr_code', 'data_matrix', 'aztec',
  'pdf417', 'maxi_code',
] as const;

/** 降级时的常用格式 */
export const FALLBACK_BARCODE_FORMATS = ['code_128', 'ean_13', 'upc_a', 'code_39', 'ean_8', 'itf'];

// ─── 通用工具函数 ──────────────────────────────────────

/**
 * 安全提取错误消息（兼容 Error 对象、字符串、unknown）
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return fallback;
}

/**
 * 检测微信内置浏览器（getUserMedia 被阉割，无法扫码）
 */
export function isWeChatBrowser(): boolean {
  return /MicroMessenger/i.test(navigator.userAgent);
}

/**
 * 扫描成功时触发震动反馈（移动端）
 */
export function triggerVibration(durationMs = 100): void {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(durationMs);
    }
  } catch {
    // 忽略震动失败
  }
}

// ─── 条码检测器 ────────────────────────────────────────

/**
 * 配置 zxing-wasm WASM 文件的加载路径
 *
 * WASM 文件默认从 fastly.jsdelivr.net CDN 加载，
 * 但在中国大陆可能被阻断。此函数优先尝试自托管路径，
 * 再回退到多个 CDN 源。
 *
 * 自托管：将 node_modules/.pnpm/zxing-wasm@3.1.0_@types+emscripten@1.41.5/node_modules/zxing-wasm/dist/reader/zxing_reader.wasm
 * 复制到 public/wasm/zxing_reader.wasm
 */
async function configureZXingWASM(): Promise<void> {
  try {
    const { setZXingModuleOverrides } = await import('barcode-detector');
    setZXingModuleOverrides({
      locateFile: (wasmPath: string, basePath: string) => {
        const filename = wasmPath.split('/').pop() || wasmPath;
        // 自托管路径（Next.js public 目录）
        const selfHosted = `/wasm/${filename}`;
        // 在浏览器中，如果 self-hosted 存在就用它，否则用 CDN
        // 这里无法用 fetch 探测，直接返回自托管路径；
        // 如果 404，WASM 会报加载错误，用户可手动复制 WASM 文件到 public/wasm/
        return selfHosted;
      },
    });
  } catch {
    // 忽略 — 将使用默认的 CDN 加载路径
  }
}

/**
 * 获取 BarcodeDetector 实例
 *
 * 优先使用浏览器原生 API（Android Chrome，底层 ML Kit 识别率最高），
 * 不支持时降级到 barcode-detector polyfill（zxing-wasm，覆盖 iOS Safari）。
 * 自动检测当前环境支持的条码格式，传回所有支持的格式以最大化兼容性。
 *
 * WASM 加载顺序：自托管 → 默认 CDN（fastly.jsdelivr.net）
 * 如需自托管，将 zxing_reader.wasm 复制到 public/wasm/ 目录
 */
export async function getDetector(
  allFormats: readonly string[] = ALL_BARCODE_FORMATS,
  fallbackFormats: string[] = FALLBACK_BARCODE_FORMATS,
): Promise<{ detector: BarcodeDetectorInstance; formats: string[] }> {
  // 原生 BarcodeDetector（Chrome/Edge Android、部分桌面）
  const NativeBD = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  if (NativeBD) {
    try {
      const getSupportedFormats = (NativeBD as unknown as { getSupportedFormats?: () => Promise<string[]> }).getSupportedFormats;
      if (typeof getSupportedFormats === 'function') {
        const supportedFormats = await (getSupportedFormats as () => Promise<string[]>)();
        // 取交集：我们支持的格式 ∩ 设备支持的格式
        const formats = allFormats.filter(f => supportedFormats.includes(f as string));
        if (formats.length > 0) {
          return { detector: new NativeBD({ formats }), formats };
        }
      }
      // 不支持 getSupportedFormats，回退到常用 1D 格式
      return { detector: new NativeBD({ formats: fallbackFormats }), formats: fallbackFormats };
    } catch (e: unknown) {
      console.debug('[BarcodeDetector] 原生 API 异常，降级到 polyfill:', e instanceof Error ? e.message : String(e));
    }
  }
  // 降级：动态加载 polyfill（仅在需要时，不影响首屏）
  // 先配置 WASM 加载路径，再导入 polyfill
  await configureZXingWASM();
  try {
    const mod = await import('barcode-detector');
    const PolyfillBD = mod.BarcodeDetector as BarcodeDetectorConstructor;
    return { detector: new PolyfillBD({ formats: fallbackFormats }), formats: fallbackFormats };
  } catch (e: unknown) {
    throw new Error(`条码识别库加载失败: ${e instanceof Error ? e.message : '未知错误'}`);
  }
}

// ─── 异步工具 ──────────────────────────────────────────

/**
 * 给动态 import 加超时兜底
 *
 * @example
 * const mod = await importWithTimeout(() => import('./heavy-component'), 5000);
 */
export async function importWithTimeout<T>(importFn: () => Promise<T>, timeoutMs = 10000): Promise<T> {
  return Promise.race([
    importFn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('加载超时')), timeoutMs)
    ),
  ]);
}
