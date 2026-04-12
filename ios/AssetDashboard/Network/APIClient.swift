import Foundation

/// 后端 API 客户端，使用 URLSession + Bearer token
actor APIClient {
    static let shared = APIClient()

    let baseURL = "http://62.234.19.227"

    private var token: String? {
        KeychainHelper.load()
    }

    // MARK: - Auth

    func login(username: String, password: String) async throws -> LoginResponse {
        let body: [String: String] = ["username": username, "password": password]
        let resp: LoginResponse = try await post("/api/login", body: body, auth: false)
        KeychainHelper.save(token: resp.token)
        return resp
    }

    func logout() async {
        do {
            let _: [String: String] = try await post("/api/logout", body: Optional<String>.none, auth: true)
        } catch {}
        KeychainHelper.delete()
    }

    func fetchMe() async throws -> User {
        try await get("/api/me")
    }

    // MARK: - Health

    func healthCheck() async throws -> Bool {
        var request = URLRequest(url: URL(string: baseURL + "/api/health")!)
        request.httpMethod = "GET"
        request.timeoutInterval = 5
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { return false }
        return (200...299).contains(http.statusCode)
    }

    // MARK: - Assets

    func fetchAssets() async throws -> [Asset] {
        try await get("/api/assets")
    }

    func createAsset(_ draft: AssetDraft) async throws -> Asset {
        try await post("/api/assets", body: draft, auth: true)
    }

    func updateAsset(id: String, _ draft: AssetDraft) async throws -> Asset {
        try await put("/api/assets/\(id)", body: draft)
    }

    func deleteAsset(id: String) async throws {
        let _: [String: String] = try await delete("/api/assets/\(id)")
    }

    // MARK: - Private

    private func get<T: Decodable>(_ path: String) async throws -> T {
        var request = URLRequest(url: URL(string: baseURL + path)!)
        request.httpMethod = "GET"
        applyAuth(&request)
        return try await perform(request)
    }

    private func post<T: Decodable, B: Encodable>(_ path: String, body: B?, auth: Bool) async throws -> T {
        var request = URLRequest(url: URL(string: baseURL + path)!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if auth { applyAuth(&request) }
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
        }
        return try await perform(request)
    }

    private func put<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        var request = URLRequest(url: URL(string: baseURL + path)!)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        applyAuth(&request)
        request.httpBody = try JSONEncoder().encode(body)
        return try await perform(request)
    }

    private func delete<T: Decodable>(_ path: String) async throws -> T {
        var request = URLRequest(url: URL(string: baseURL + path)!)
        request.httpMethod = "DELETE"
        applyAuth(&request)
        return try await perform(request)
    }

    private func applyAuth(_ request: inout URLRequest) {
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.unknown
        }
        if http.statusCode == 401 {
            throw APIError.unauthorized
        }
        guard (200...299).contains(http.statusCode) else {
            if let err = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw APIError.server(err.error)
            }
            throw APIError.httpError(http.statusCode)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}

enum APIError: LocalizedError {
    case unauthorized
    case httpError(Int)
    case server(String)
    case unknown

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "未授权，请重新登录"
        case .httpError(let code): return "请求失败（\(code)）"
        case .server(let msg): return msg
        case .unknown: return "未知错误"
        }
    }
}

/// 新增/编辑资产的请求体
struct AssetDraft: Codable {
    var symbol: String
    var category: AssetCategory
    var costBasis: Double
    var currentPrice: Double
    var quantity: Double
    var currency: String
}
