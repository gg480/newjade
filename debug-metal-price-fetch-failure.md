# Debug Session: metal-price-fetch-failure

## 症状
用户报告：更新到生产环境后，贵金属行情获取失败

## 时间
2026-06-06

## 代码链路
```
GET /api/metal-prices/market?source=auto
  → fetchMarketPricesWithRef('auto')
    → fetchMarketPrices('auto')
      → try fetchFromGzjn168()
          → fetchLocalReferencePrices()  [STUB: available=false]
          → throws AppError(502)
      → catch → fallback fetchFromTanshu()
          → needs tanshu_api_key from SysConfig
          → if key missing: throws AppError(400)
```

