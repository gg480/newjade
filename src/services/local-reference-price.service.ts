// ============================================================
// 本地参考行情服务（gzjn168.com 融通金）
// TODO: 实现 HTML 解析逻辑，当前返回 unavailable
// ============================================================

export interface LocalReferenceItem {
  name: string;
  sellPrice: number;
  buyPrice: number;
}

export interface LocalReferenceResponse {
  available: boolean;
  items: LocalReferenceItem[];
  message?: string;
  cachedAt?: string;
}

export async function fetchLocalReferencePrices(): Promise<LocalReferenceResponse> {
  return {
    available: false,
    items: [],
    message: 'Service not yet deployed',
  };
}

export function clearLocalReferenceCache(): void {
  // No-op
}
