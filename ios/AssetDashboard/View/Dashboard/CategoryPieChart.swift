import SwiftUI
import Charts

struct CategoryPieChart: View {
    let data: [(category: AssetCategory, value: Double)]

    private var total: Double {
        data.reduce(0) { $0 + $1.value }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("分类占比")
                .font(.headline)

            if data.isEmpty {
                Text("暂无数据")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 160)
            } else {
                Chart(data, id: \.category) { item in
                    SectorMark(
                        angle: .value("市值", item.value),
                        innerRadius: .ratio(0.5),
                        angularInset: 1.5
                    )
                    .foregroundStyle(color(for: item.category))
                    .cornerRadius(4)
                }
                .frame(height: 180)

                // 图例
                VStack(spacing: 6) {
                    ForEach(data, id: \.category) { item in
                        HStack {
                            Circle()
                                .fill(color(for: item.category))
                                .frame(width: 10, height: 10)
                            Text(item.category.label)
                                .font(.caption)
                            Spacer()
                            Text(Fmt.percentPlain(item.value / total))
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.secondary)
                            Text(Fmt.cnyRounded(item.value))
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func color(for category: AssetCategory) -> Color {
        switch category {
        case .stock:  return .blue
        case .etf:    return .cyan
        case .crypto: return .orange
        case .cash:   return .green
        }
    }
}
