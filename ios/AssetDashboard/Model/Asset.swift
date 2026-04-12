import Foundation

enum AssetCategory: String, Codable, CaseIterable {
    case stock, etf, crypto, cash

    var label: String {
        switch self {
        case .stock:  return "股票"
        case .etf:    return "ETF"
        case .crypto: return "加密货币"
        case .cash:   return "现金"
        }
    }
}

struct Asset: Codable, Identifiable {
    let id: String
    var symbol: String
    var category: AssetCategory
    var costBasis: Double
    var currentPrice: Double
    var quantity: Double
    var currency: String
    let createdAt: String
    let updatedAt: String
}
