package main

import (
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/pressly/goose/v3"
	_ "modernc.org/sqlite"

	"github.com/theodore/vibecoding-server/internal/handler"
	"github.com/theodore/vibecoding-server/internal/middleware"
	"github.com/theodore/vibecoding-server/internal/store"
)

//go:embed migrations/*.sql
var migrations embed.FS

func main() {
	// 1. 打开 SQLite 数据库
	db, err := sql.Open("sqlite", "./data.db")
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	// 2. 运行 goose 迁移
	goose.SetBaseFS(migrations)
	if err := goose.SetDialect("sqlite3"); err != nil {
		log.Fatalf("goose dialect: %v", err)
	}
	if err := goose.Up(db, "migrations"); err != nil {
		log.Fatalf("goose up: %v", err)
	}

	// 3. 初始化 Store 并填充 Seed 数据
	s := store.New(db)
	if err := seed(s); err != nil {
		log.Fatalf("seed: %v", err)
	}

	// 4. 路由注册
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	authHandler := &handler.Auth{Store: s}
	authHandler.RegisterRoutes(mux)

	assetsHandler := &handler.Assets{Store: s}
	assetsHandler.RegisterRoutes(mux)

	// 5. 启动 HTTP server（包裹 CORS 中间件）
	addr := ":8080"
	fmt.Printf("server listening on %s\n", addr)
	log.Fatal(http.ListenAndServe(addr, middleware.CORS(mux)))
}
