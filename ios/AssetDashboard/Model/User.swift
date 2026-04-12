import Foundation

struct User: Codable {
    let id: String
    let username: String
}

struct LoginResponse: Codable {
    let id: String
    let username: String
    let createdAt: String
    let token: String
}

struct ErrorResponse: Codable {
    let error: String
}
