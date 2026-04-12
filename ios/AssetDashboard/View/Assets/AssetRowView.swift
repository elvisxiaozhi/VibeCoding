import SwiftUI

struct AssetRowView: View {
    let asset: Asset

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(asset.symbol)
                    .font(.subheadline.bold())
                    .lineLimit(1)
                Text(asset.category.label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                let mv = Calc.marketValue(asset)
                Text("¥" + mv.formatted(.number.precision(.fractionLength(2)).grouping(.automatic)))
                    .font(.subheadline.monospacedDigit())

                let pnl = Calc.pnlValue(asset)
                let rate = Calc.pnlRate(asset)
                HStack(spacing: 4) {
                    Text(signedCNY(pnl))
                    Text(formatPercent(rate))
                }
                .font(.caption.monospacedDigit())
                .foregroundStyle(pnl >= 0 ? .green : .red)
            }
        }
        .padding(.vertical, 2)
    }

    private func signedCNY(_ n: Double) -> String {
        let prefix = n >= 0 ? "+" : ""
        return prefix + "¥" + n.formatted(.number.precision(.fractionLength(2)).grouping(.automatic))
    }

    private func formatPercent(_ n: Double) -> String {
        let prefix = n >= 0 ? "+" : ""
        return prefix + (n * 100).formatted(.number.precision(.fractionLength(2))) + "%"
    }
}
