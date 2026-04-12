import Foundation

/// 派生计算，与 Web 前端 calc.ts 逻辑一致
enum Calc {
    static func marketValue(_ asset: Asset) -> Double {
        asset.currentPrice * asset.quantity
    }

    static func costValue(_ asset: Asset) -> Double {
        asset.costBasis * asset.quantity
    }

    static func pnlValue(_ asset: Asset) -> Double {
        marketValue(asset) - costValue(asset)
    }

    static func pnlRate(_ asset: Asset) -> Double {
        let cost = costValue(asset)
        guard cost > 0 else { return 0 }
        return pnlValue(asset) / cost
    }

    static func totalMarketValue(_ assets: [Asset]) -> Double {
        assets.reduce(0) { $0 + marketValue($1) }
    }

    static func totalCostValue(_ assets: [Asset]) -> Double {
        assets.reduce(0) { $0 + costValue($1) }
    }

    static func totalPnLValue(_ assets: [Asset]) -> Double {
        totalMarketValue(assets) - totalCostValue(assets)
    }
}
