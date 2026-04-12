package store

import (
	"database/sql"
	"fmt"

	"github.com/theodore/vibecoding-server/internal/model"
)

// CreateUser 插入一个用户
func (s *Store) CreateUser(u model.User) error {
	_, err := s.db.Exec(`INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)`,
		u.ID, u.Username, u.PasswordHash, u.CreatedAt)
	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

// GetUserByUsername 按用户名查询
func (s *Store) GetUserByUsername(username string) (model.User, error) {
	var u model.User
	err := s.db.QueryRow(`SELECT id, username, password_hash, created_at FROM users WHERE username = ?`, username).
		Scan(&u.ID, &u.Username, &u.PasswordHash, &u.CreatedAt)
	if err != nil {
		return u, fmt.Errorf("get user by username %s: %w", username, err)
	}
	return u, nil
}

// GetUserByID 按 ID 查询
func (s *Store) GetUserByID(id string) (model.User, error) {
	var u model.User
	err := s.db.QueryRow(`SELECT id, username, password_hash, created_at FROM users WHERE id = ?`, id).
		Scan(&u.ID, &u.Username, &u.PasswordHash, &u.CreatedAt)
	if err != nil {
		return u, fmt.Errorf("get user by id %s: %w", id, err)
	}
	return u, nil
}

// UserCount 返回用户总数
func (s *Store) UserCount() (int, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

// CreateSession 插入一个会话
func (s *Store) CreateSession(sess model.Session) error {
	_, err := s.db.Exec(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
		sess.Token, sess.UserID, sess.ExpiresAt)
	if err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	return nil
}

// GetSession 按 token 查询会话，同时检查是否过期
func (s *Store) GetSession(token string) (model.Session, error) {
	var sess model.Session
	err := s.db.QueryRow(`SELECT token, user_id, expires_at FROM sessions WHERE token = ? AND expires_at > datetime('now')`, token).
		Scan(&sess.Token, &sess.UserID, &sess.ExpiresAt)
	if err != nil {
		return sess, fmt.Errorf("get session: %w", err)
	}
	return sess, nil
}

// DeleteSession 按 token 删除会话
func (s *Store) DeleteSession(token string) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE token = ?`, token)
	if err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

// DeleteExpiredSessions 清理过期会话
func (s *Store) DeleteExpiredSessions() error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE expires_at <= datetime('now')`)
	if err != nil {
		return fmt.Errorf("delete expired sessions: %w", err)
	}
	return nil
}

// FirstUserID 返回第一个用户的 ID（用于迁移归属）
func (s *Store) FirstUserID() (string, error) {
	var id string
	err := s.db.QueryRow(`SELECT id FROM users ORDER BY created_at LIMIT 1`).Scan(&id)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", fmt.Errorf("first user id: %w", err)
	}
	return id, nil
}
