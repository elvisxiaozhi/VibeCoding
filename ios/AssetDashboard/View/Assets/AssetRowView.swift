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
                Text(Fmt.cny(mv))
                    .font(.subheadline.monospacedDigit())

                let pnl = Calc.pnlValue(asset)
                let rate = Calc.pnlRate(asset)
                HStack(spacing: 4) {
                    Text(Fmt.signedCNY(pnl))
                    Text(Fmt.percent(rate))
                }
                .font(.caption.monospacedDigit())
                .foregroundStyle(Fmt.pnlColor(pnl))
            }
        }
        .padding(.vertical, 2)
    }
}
