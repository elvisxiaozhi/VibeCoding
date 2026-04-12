import SwiftUI

struct SettingsView: View {
    @Environment(AuthViewModel.self) private var authVM
    @State private var showLogin = false

    var body: some View {
        NavigationStack {
            List {
                Section("账户") {
                    if let user = authVM.user {
                        HStack {
                            Label(user.username, systemImage: "person.circle")
                            Spacer()
                            Text("已登录")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Button("登出", role: .destructive) {
                            Task { await authVM.logout() }
                        }
                    } else {
                        Button {
                            showLogin = true
                        } label: {
                            Label("登录", systemImage: "person.badge.key")
                        }
                    }
                }

                Section("服务器") {
                    HStack {
                        Text("API 地址")
                        Spacer()
                        Text("62.234.19.227")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                }

                Section("关于") {
                    HStack {
                        Text("版本")
                        Spacer()
                        Text("1.0.0")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("设置")
            .sheet(isPresented: $showLogin) {
                LoginView()
            }
        }
    }
}
