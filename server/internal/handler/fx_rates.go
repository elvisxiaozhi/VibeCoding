package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/theodore/vibecoding-server/internal/store"
)

// FXRates 历史汇率代理 handler，所有汇率均以 1 unit currency = N CNY 表示
type FXRates struct {
	Store *store.Store
}

type fxRateResult struct {
	Currency string  `json:"currency"`
	Date     string  `json:"date"`
	Rate     float64 `json:"rate"`
	Fallback bool    `json:"fallback,omitempty"`
}

// RegisterRoutes 注册汇率路由（无需认证）
func (h *FXRates) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/fx-rates", h.getRates)
}

// GET /api/fx-rates?pairs=USD:2024-01-15,HKD:2024-02-20,USD:2024-03-01
// 同一对 (currency, date) 自动去重；最大 200 对。
func (h *FXRates) getRates(w http.ResponseWriter, r *http.Request) {
	pairsParam := r.URL.Query().Get("pairs")
	if pairsParam == "" {
		writeError(w, http.StatusBadRequest, "pairs parameter is required")
		return
	}

	parts := strings.Split(pairsParam, ",")
	if len(parts) > 200 {
		writeError(w, http.StatusBadRequest, "too many pairs (max 200)")
		return
	}

	type pair struct{ currency, date string }
	var pairs []pair
	seen := make(map[string]bool)
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		kv := strings.SplitN(p, ":", 2)
		if len(kv) != 2 {
			continue
		}
		currency := strings.ToUpper(strings.TrimSpace(kv[0]))
		date := strings.TrimSpace(kv[1])
		if currency == "" || date == "" {
			continue
		}
		key := currency + ":" + date
		if seen[key] {
			continue
		}
		seen[key] = true
		pairs = append(pairs, pair{currency, date})
	}

	results := make([]fxRateResult, len(pairs))
	var wg sync.WaitGroup
	for i, p := range pairs {
		wg.Add(1)
		go func(idx int, currency, date string) {
			defer wg.Done()
			results[idx] = h.resolveRate(currency, date)
		}(i, p.currency, p.date)
	}
	wg.Wait()

	writeJSON(w, http.StatusOK, results)
}

// resolveRate 解析单条汇率：CNY 直接返回 1，USDT 按 USD 处理；
// 否则先查本地缓存，未命中则拉 Frankfurter，失败回退到今日汇率并标记 fallback。
func (h *FXRates) resolveRate(currency, date string) fxRateResult {
	if currency == "CNY" {
		return fxRateResult{Currency: currency, Date: date, Rate: 1.0}
	}

	queryCurr := currency
	if currency == "USDT" || currency == "USDC" {
		queryCurr = "USD"
	}

	// 1) 本地缓存命中（永久缓存）
	if rate, err := h.Store.GetFXRate(queryCurr, date); err == nil {
		return fxRateResult{Currency: currency, Date: date, Rate: rate}
	} else if !errors.Is(err, sql.ErrNoRows) {
		// 真实 DB 错误，仍尝试外部 API
	}

	// 2) Frankfurter 拉历史
	if rate, err := fetchFrankfurter(queryCurr, date); err == nil && rate > 0 {
		_ = h.Store.UpsertFXRate(queryCurr, date, rate)
		return fxRateResult{Currency: currency, Date: date, Rate: rate}
	}

	// 3) 回退到今日汇率（DB 缓存或现拉 latest）
	today := time.Now().UTC().Format("2006-01-02")
	if rate, err := h.Store.GetFXRate(queryCurr, today); err == nil {
		return fxRateResult{Currency: currency, Date: date, Rate: rate, Fallback: true}
	}
	if rate, err := fetchFrankfurter(queryCurr, "latest"); err == nil && rate > 0 {
		_ = h.Store.UpsertFXRate(queryCurr, today, rate)
		return fxRateResult{Currency: currency, Date: date, Rate: rate, Fallback: true}
	}

	// 4) 兜底：返回 0，由前端自行处理
	return fxRateResult{Currency: currency, Date: date, Rate: 0}
}

// fetchFrankfurter 调 frankfurter.app 拉某币种相对 CNY 的汇率
// API: https://api.frankfurter.app/2024-01-15?from=USD&to=CNY
//      → {"amount":1.0,"base":"USD","date":"2024-01-15","rates":{"CNY":7.18}}
// date 可以是 "YYYY-MM-DD" 或 "latest"。周末/节假日 Frankfurter 自动返回最近交易日。
func fetchFrankfurter(currency, date string) (float64, error) {
	url := fmt.Sprintf("https://api.frankfurter.app/%s?from=%s&to=CNY", date, currency)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return 0, fmt.Errorf("frankfurter request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("frankfurter returned %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("read frankfurter body: %w", err)
	}

	var parsed struct {
		Rates map[string]float64 `json:"rates"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return 0, fmt.Errorf("parse frankfurter response: %w", err)
	}
	rate, ok := parsed.Rates["CNY"]
	if !ok || rate <= 0 {
		return 0, fmt.Errorf("CNY rate missing in frankfurter response")
	}
	return rate, nil
}
