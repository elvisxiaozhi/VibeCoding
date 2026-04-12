package model

// User 用户，PasswordHash 不序列化到 JSON
type User struct {
	ID           string `json:"id"`
	Username     string `json:"username"`
	PasswordHash string `json:"-"`
	CreatedAt    string `json:"createdAt"`
}

// Session 登录会话
type Session struct {
	Token     string
	UserID    string
	ExpiresAt string
}
