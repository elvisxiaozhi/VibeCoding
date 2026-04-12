import SwiftUI

/// 全局数字格式化工具，消除各 View 中的重复格式化函数
enum Fmt {
    /// ¥123,456.78
    static func cny(_ n: Double) -> String {
        "¥" + n.formatted(.number.precision(.fractionLength(2)).grouping(.automatic))
    }

    /// +¥1,234.56 / -¥1,234.56
    static func signedCNY(_ n: Double) -> String {
        let prefix = n >= 0 ? "+" : ""
        return prefix + cny(n)
    }

    /// ¥123,457（无小数，用于饼图图例等）
    static func cnyRounded(_ n: Double) -> String {
        "¥" + n.formatted(.number.precision(.fractionLength(0)).grouping(.automatic))
    }

    /// +12.34% / -12.34%
    static func percent(_ n: Double) -> String {
        let prefix = n >= 0 ? "+" : ""
        return prefix + (n * 100).formatted(.number.precision(.fractionLength(2))) + "%"
    }

    /// 12.3%（无符号，用于饼图图例等）
    static func percentPlain(_ n: Double) -> String {
        (n * 100).formatted(.number.precision(.fractionLength(1))) + "%"
    }

    /// 盈亏颜色：正绿负红
    static func pnlColor(_ n: Double) -> Color {
        n >= 0 ? .green : .red
    }
}
