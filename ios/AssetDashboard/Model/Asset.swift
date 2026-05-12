import Foundation

enum AssetCategory: String, Codable, CaseIterable {
    case stock, etf, gold, crypto, cash, currency, providentFund = "provident_fund", option

    var label: String {
        switch self {
        case .stock:  return "股票"
        case .etf:    return "ETF"
        case .gold:   return "黄金"
        case .crypto: return "加密货币"
        case .cash:   return "现金"
        case .currency: return "货币"
        case .providentFund: return "公积金"
        case .option: return "期权"
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
    var contractMultiplier: Double?
    let createdAt: String
    let updatedAt: String
}
