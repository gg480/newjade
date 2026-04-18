export const PRICE_RANGES = ['走量', '中档', '精品'] as const;
export type PriceRange = typeof PRICE_RANGES[number];
