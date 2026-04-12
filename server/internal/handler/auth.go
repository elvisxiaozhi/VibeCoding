package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/theodore/vibecoding-server/internal/middleware"
	"github.com/theodore/vibecoding-server/internal/model"
	"github.com/theodore/vibecoding-server/internal/store"
)

// Auth 认证相关 handler
type Auth struct {
	Store *store.Store
}

// RegisterRoutes 注册认证路由
func (h *Auth) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/login", h.login)
	mux.HandleFunc("POST /api/logout", h.logout)
	mux.HandleFunc("GET /api/me", h.me)
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// POST /api/login
func (h *Auth) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "username and password are required")
		return
	}

	user, err := h.Store.GetUserByUsername(req.Username)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "invalid username or password")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid username or password")
		return
	}

	// 创建 session
	token := uuid.NewString()
	expiresAt := time.Now().UTC().Add(7 * 24 * time.Hour).Format(time.RFC3339)
	sess := model.Session{
		Token:     token,
		UserID:    user.ID,
		ExpiresAt: expiresAt,
	}
	if err := h.Store.CreateSession(sess); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   7 * 24 * 3600,
	})

	// 响应同时包含 user 信息和 token（方便非浏览器客户端提取）
	writeJSON(w, http.StatusOK, loginResponse{
		ID:        user.ID,
		Username:  user.Username,
		CreatedAt: user.CreatedAt,
		Token:     token,
	})
}

type loginResponse struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	CreatedAt string `json:"createdAt"`
	Token     string `json:"token"`
}

// POST /api/logout
func (h *Auth) logout(w http.ResponseWriter, r *http.Request) {
	token := middleware.ExtractToken(r)
	if token != "" {
		_ = h.Store.DeleteSession(token)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GET /api/me
func (h *Auth) me(w http.ResponseWriter, r *http.Request) {
	token := middleware.ExtractToken(r)
	if token == "" {
		writeError(w, http.StatusUnauthorized, "not logged in")
		return
	}

	sess, err := h.Store.GetSession(token)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "session expired")
		return
	}

	user, err := h.Store.GetUserByID(sess.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, user)
}

// RequireAuth 包装一个 handler，要求认证
func RequireAuth(s *store.Store, handler http.Handler) http.Handler {
	return middleware.Auth(s)(handler)
}
