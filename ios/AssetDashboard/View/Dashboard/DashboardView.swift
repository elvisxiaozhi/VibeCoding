import SwiftUI

struct DashboardView: View {
    @Environment(AuthViewModel.self) private var authVM
    @State private var vm = DashboardViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    // 游客 banner
                    if !authVM.isLoggedIn {
                        demoBanner
                    }

                    if vm.isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 200)
                    } else if let error = vm.error {
                        errorState(error)
                    } else if vm.assets.isEmpty {
                        emptyState
                    } else {
                        content
                    }
                }
                .padding()
            }
            .navigationTitle("总览")
            .refreshable {
                await vm.load(isLoggedIn: authVM.isLoggedIn)
            }
            .task {
                await vm.load(isLoggedIn: authVM.isLoggedIn)
            }
            .onChange(of: authVM.isLoggedIn) {
                Task { await vm.load(isLoggedIn: authVM.isLoggedIn) }
            }
        }
    }

    // MARK: - Subviews

    private var demoBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: "eye")
            Text("当前为演示模式，登录后管理您的资产")
                .font(.callout)
        }
        .foregroundStyle(.blue)
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.blue.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("加载失败")
                .font(.subheadline)
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await vm.load(isLoggedIn: authVM.isLoggedIn) }
            } label: {
                Label("重试", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, minHeight: 200)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "wallet.bifold")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("暂无资产数据")
                .font(.subheadline)
            Text("请前往「资产」页面添加")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 200)
    }

    private var content: some View {
        VStack(spacing: 16) {
            // 统计卡片
            statCards

            // 分类饼图
            CategoryPieChart(data: vm.categoryBreakdown)

            // Top 5 涨跌排行
            top5Section
        }
    }

    private var statCards: some View {
        HStack(spacing: 12) {
            StatCardView(
                title: "总资产",
                value: Fmt.cny(vm.totalValue),
                icon: "wallet.bifold"
            )
            StatCardView(
                title: "浮动盈亏",
                value: Fmt.signedCNY(vm.totalPnL),
                subtitle: Fmt.percent(vm.pnlRate),
                icon: vm.totalPnL >= 0 ? "arrow.up.right" : "arrow.down.right",
                valueColor: Fmt.pnlColor(vm.totalPnL)
            )
            StatCardView(
                title: "投入本金",
                value: Fmt.cny(vm.totalCost),
                icon: "dollarsign.circle"
            )
        }
    }

    private var top5Section: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("涨跌排行 Top 5")
                .font(.headline)

            ForEach(vm.top5) { asset in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(asset.symbol)
                            .font(.subheadline)
                            .lineLimit(1)
                        Text(asset.category.label)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        let pnl = Calc.pnlValue(asset)
                        let rate = Calc.pnlRate(asset)
                        Text(Fmt.signedCNY(pnl))
                            .font(.subheadline.monospacedDigit())
                            .foregroundStyle(Fmt.pnlColor(pnl))
                        Text(Fmt.percent(rate))
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(Fmt.pnlColor(pnl))
                    }
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

}
