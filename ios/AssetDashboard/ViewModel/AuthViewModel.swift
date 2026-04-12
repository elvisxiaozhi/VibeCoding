import Foundation

@MainActor
@Observable
class AuthViewModel {
    var user: User?
    var isInitializing = true
    var loginError: String?

    var isLoggedIn: Bool { user != nil }

    init() {
        Task {
            await checkSession()
        }
    }

    /// 启动时从 Keychain 读 token，调 /api/me 验证
    func checkSession() async {
        defer { isInitializing = false }
        guard KeychainHelper.load() != nil else { return }
        do {
            let me = try await APIClient.shared.fetchMe()
            user = me
        } catch {
            // token 无效，清除
            KeychainHelper.delete()
        }
    }

    func login(username: String, password: String) async {
        loginError = nil
        do {
            let resp = try await APIClient.shared.login(username: username, password: password)
            user = User(id: resp.id, username: resp.username)
        } catch let error as APIError {
            loginError = error.errorDescription
        } catch {
            loginError = "网络连接失败"
        }
    }

    func logout() async {
        await APIClient.shared.logout()
        user = nil
    }
}
