import Foundation

/// 与 Web 前端 src/data/mock.ts 一致的 10 条示例数据
let mockAssets: [Asset] = [
    Asset(id: "mock-600519", symbol: "600519 贵州茅台", category: .stock, costBasis: 1680, currentPrice: 1582.4, quantity: 20, currency: "CNY", createdAt: "2026-03-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z"),
    Asset(id: "mock-00700", symbol: "00700 腾讯控股", category: .stock, costBasis: 320, currentPrice: 385.6, quantity: 100, currency: "CNY", createdAt: "2026-03-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z"),
    Asset(id: "mock-300750", symbol: "300750 宁德时代", category: .stock, costBasis: 210, currentPrice: 176.8, quantity: 150, currency: "CNY", createdAt: "2026-03-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z"),
    Asset(id: "mock-510300", symbol: "510300 沪深300ETF", category: .etf, costBasis: 4.18, currentPrice: 4.05, quantity: 5000, currency: "CNY", createdAt: "2026-03-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z"),
    Asset(id: "mock-513100", symbol: "513100 纳指ETF", category: .etf, costBasis: 1.52, currentPrice: 1.684, quantity: 8000, currency: "CNY", createdAt: "2026-03-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z"),
    Asset(id: "mock-btc", symbol: "BTC 比特币", category: .crypto, costBasis: 420000, currentPrice: 586000, quantity: 0.15, currency: "CNY", createdAt: "2026-03-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z"),
    Asset(id: "mock-eth", symbol: "ETH 以太坊", category: .crypto, costBasis: 18200, currentPrice: 22450, quantity: 2, currency: "CNY", createdAt: "2026-03-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z"),
    Asset(id: "mock-sol", symbol: "SOL Solana", category: .crypto, costBasis: 920, currentPrice: 1210, quantity: 30, currency: "CNY", createdAt: "2026-03-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z"),
    Asset(id: "mock-cash-demand", symbol: "活期存款", category: .cash, costBasis: 1, currentPrice: 1, quantity: 50000, currency: "CNY", createdAt: "2026-03-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z"),
    Asset(id: "mock-cash-mmf", symbol: "货币基金", category: .cash, costBasis: 1, currentPrice: 1.0023, quantity: 80000, currency: "CNY", createdAt: "2026-03-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z"),
]
