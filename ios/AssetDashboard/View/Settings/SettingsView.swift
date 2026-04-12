import SwiftUI

struct SettingsView: View {
    @Environment(AuthViewModel.self) private var authVM
    @State private var showLogin = false
    @State private var serverStatus: ServerStatus = .checking

    enum ServerStatus {
        case checking, online, offline
    }

    var body: some View {
        NavigationStack {
            List {
                Section("账户") {
                    if let user = authVM.user {
                        HStack {
                            Label(user.username, systemImage: "person.circle.fill")
                            Spacer()
                            Text("已登录")
                                .font(.caption)
                                .foregroundStyle(.green)
                        }
                        Button("登出", role: .destructive) {
                            Task { await authVM.logout() }
                        }
                    } else {
                        HStack {
                            Label("游客模式", systemImage: "person.circle")
                            Spacer()
                            Text("未登录")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
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
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    HStack {
                        Text("连接状态")
                        Spacer()
                        switch serverStatus {
                        case .checking:
                            ProgressView()
                                .controlSize(.small)
                        case .online:
                            Label("在线", systemImage: "checkmark.circle.fill")
                                .font(.caption)
                                .foregroundStyle(.green)
                        case .offline:
                            Label("离线", systemImage: "xmark.circle.fill")
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
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
            .task {
                await checkServer()
            }
        }
    }

    private func checkServer() async {
        serverStatus = .checking
        do {
            let ok = try await APIClient.shared.healthCheck()
            serverStatus = ok ? .online : .offline
        } catch {
            serverStatus = .offline
        }
    }
}
