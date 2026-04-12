import Foundation

@MainActor
@Observable
class DashboardViewModel {
    var assets: [Asset] = []
    var isLoading = false
    var error: String?

    var totalValue: Double { Calc.totalMarketValue(assets) }
    var totalCost: Double { Calc.totalCostValue(assets) }
    var totalPnL: Double { Calc.totalPnLValue(assets) }
    var pnlRate: Double {
        guard totalCost > 0 else { return 0 }
        return totalPnL / totalCost
    }

    /// 按分类汇总市值
    var categoryBreakdown: [(category: AssetCategory, value: Double)] {
        var map: [AssetCategory: Double] = [:]
        for asset in assets {
            map[asset.category, default: 0] += Calc.marketValue(asset)
        }
        return AssetCategory.allCases.compactMap { cat in
            guard let v = map[cat], v > 0 else { return nil }
            return (cat, v)
        }
    }

    /// 按盈亏率排序的 Top 5
    var top5: [Asset] {
        Array(assets.sorted { Calc.pnlRate($0) > Calc.pnlRate($1) }.prefix(5))
    }

    func load(isLoggedIn: Bool) async {
        if isLoggedIn {
            await fetchFromAPI()
        } else {
            assets = mockAssets
        }
    }

    func fetchFromAPI() async {
        isLoading = true
        error = nil
        do {
            assets = try await APIClient.shared.fetchAssets()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
