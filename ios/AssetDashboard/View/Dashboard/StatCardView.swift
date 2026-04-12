import SwiftUI

struct StatCardView: View {
    let title: String
    let value: String
    var subtitle: String?
    var icon: String = "dollarsign.circle"
    var valueColor: Color = .white

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            Text(value)
                .font(.title2.monospacedDigit().bold())
                .foregroundStyle(valueColor)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            HStack {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let subtitle {
                    Spacer()
                    Text(subtitle)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(valueColor)
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}
