package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/theodore/vibecoding-server/internal/model"
	"github.com/theodore/vibecoding-server/internal/store"
)

// Assets 持有 Store 引用，提供 HTTP handler 方法
type Assets struct {
	Store *store.Store
}

// RegisterRoutes 将 5 个 CRUD 路由注册到 mux
func (h *Assets) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/assets", h.list)
	mux.HandleFunc("GET /api/assets/{id}", h.get)
	mux.HandleFunc("POST /api/assets", h.create)
	mux.HandleFunc("PUT /api/assets/{id}", h.update)
	mux.HandleFunc("DELETE /api/assets/{id}", h.remove)
}

// GET /api/assets — 返回全部资产列表
func (h *Assets) list(w http.ResponseWriter, r *http.Request) {
	assets, err := h.Store.ListAssets()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	// 空列表返回 [] 而非 null
	if assets == nil {
		assets = []model.Asset{}
	}
	writeJSON(w, http.StatusOK, assets)
}

// GET /api/assets/{id} — 返回单条资产
func (h *Assets) get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	asset, err := h.Store.GetAsset(id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "asset not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, asset)
}

// createRequest 新增资产的请求体（不含 id / createdAt / updatedAt）
type createRequest struct {
	Symbol       string  `json:"symbol"`
	Category     string  `json:"category"`
	CostBasis    float64 `json:"costBasis"`
	CurrentPrice float64 `json:"currentPrice"`
	Quantity     float64 `json:"quantity"`
	Currency     string  `json:"currency"`
}

// POST /api/assets — 新增资产
func (h *Assets) create(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if err := validateCreate(req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)
	asset := model.Asset{
		ID:           uuid.NewString(),
		Symbol:       req.Symbol,
		Category:     req.Category,
		CostBasis:    req.CostBasis,
		CurrentPrice: req.CurrentPrice,
		Quantity:     req.Quantity,
		Currency:     req.Currency,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if asset.Currency == "" {
		asset.Currency = "CNY"
	}

	if err := h.Store.CreateAsset(asset); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, asset)
}

// updateRequest 更新资产的请求体
type updateRequest struct {
	Symbol       string  `json:"symbol"`
	Category     string  `json:"category"`
	CostBasis    float64 `json:"costBasis"`
	CurrentPrice float64 `json:"currentPrice"`
	Quantity     float64 `json:"quantity"`
	Currency     string  `json:"currency"`
}

// PUT /api/assets/{id} — 更新资产
func (h *Assets) update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	// 先确认资产存在
	existing, err := h.Store.GetAsset(id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "asset not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var req updateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)
	asset := model.Asset{
		ID:           id,
		Symbol:       req.Symbol,
		Category:     req.Category,
		CostBasis:    req.CostBasis,
		CurrentPrice: req.CurrentPrice,
		Quantity:     req.Quantity,
		Currency:     req.Currency,
		CreatedAt:    existing.CreatedAt,
		UpdatedAt:    now,
	}
	if asset.Currency == "" {
		asset.Currency = existing.Currency
	}

	if err := h.Store.UpdateAsset(asset); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, asset)
}

// DELETE /api/assets/{id} — 删除资产
func (h *Assets) remove(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.Store.DeleteAsset(id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "asset not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"deleted": id})
}

// --- helpers ---

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func validateCreate(req createRequest) error {
	if req.Symbol == "" {
		return errors.New("symbol is required")
	}
	switch req.Category {
	case model.CategoryStock, model.CategoryETF, model.CategoryCrypto, model.CategoryCash:
		// valid
	default:
		return errors.New("category must be one of: stock, etf, crypto, cash")
	}
	if req.Quantity <= 0 {
		return errors.New("quantity must be > 0")
	}
	return nil
}
