package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/theodore/vibecoding-server/internal/store"
)

type contextKey string

const userIDKey contextKey = "userID"

// UserIDFromContext 从 context 中取出 user_id
func UserIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(userIDKey).(string)
	return v
}

// ExtractToken 从请求中提取 session token：优先 Authorization header，fallback Cookie
func ExtractToken(r *http.Request) string {
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer ")
	}
	if c, err := r.Cookie("session_token"); err == nil {
		return c.Value
	}
	return ""
}

// Auth 认证中间件，支持 Bearer token 和 Cookie 两种方式
func Auth(s *store.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := ExtractToken(r)
			if token == "" {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			sess, err := s.GetSession(token)
			if err != nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), userIDKey, sess.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
