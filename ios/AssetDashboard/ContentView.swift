import SwiftUI

struct ContentView: View {
    @Environment(AuthViewModel.self) private var authVM

    var body: some View {
        Group {
            if authVM.isInitializing {
                ProgressView("加载中...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(.systemBackground))
            } else {
                TabView {
                    Tab("总览", systemImage: "chart.pie") {
                        DashboardView()
                    }
                    Tab("资产", systemImage: "list.bullet") {
                        Text("资产列表（Step 16 实现）")
                    }
                    Tab("设置", systemImage: "gearshape") {
                        SettingsView()
                    }
                }
            }
        }
    }
}
