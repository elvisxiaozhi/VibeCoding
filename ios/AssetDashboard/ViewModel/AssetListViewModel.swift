import Foundation

enum SortKey: String, CaseIterable {
    case symbol, category, marketValue, pnl, pnlRate

    var label: String {
        switch self {
        case .symbol:      return "名称"
        case .category:    return "分类"
        case .marketValue: return "市值"
        case .pnl:         return "盈亏额"
        case .pnlRate:     return "盈亏率"
        }
    }
}

@MainActor
@Observable
class AssetListViewModel {
    var assets: [Asset] = []
    var isLoading = false
    var error: String?
    var sortKey: SortKey = .symbol
    var sortAscending = true

    var sorted: [Asset] {
        assets.sorted { a, b in
            let result: Bool
            switch sortKey {
            case .symbol:
                result = a.symbol.localizedCompare(b.symbol) == .orderedAscending
            case .category:
                result = a.category.rawValue < b.category.rawValue
            case .marketValue:
                result = Calc.marketValue(a) < Calc.marketValue(b)
            case .pnl:
                result = Calc.pnlValue(a) < Calc.pnlValue(b)
            case .pnlRate:
                result = Calc.pnlRate(a) < Calc.pnlRate(b)
            }
            return sortAscending ? result : !result
        }
    }

    func toggleSort(_ key: SortKey) {
        if sortKey == key {
            sortAscending.toggle()
        } else {
            sortKey = key
            sortAscending = true
        }
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

    func addAsset(_ draft: AssetDraft) async -> Bool {
        do {
            _ = try await APIClient.shared.createAsset(draft)
            await fetchFromAPI()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    func updateAsset(id: String, _ draft: AssetDraft) async -> Bool {
        do {
            _ = try await APIClient.shared.updateAsset(id: id, draft)
            await fetchFromAPI()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    func deleteAsset(id: String) async {
        do {
            try await APIClient.shared.deleteAsset(id: id)
            await fetchFromAPI()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
