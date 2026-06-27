package handler

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/theodore/vibecoding-server/internal/model"
	"github.com/theodore/vibecoding-server/internal/store"
)

// Benchmarks 基准指数日线 handler。读时懒填充：库里缺历史或缺最新交易日则
// 从外部源拉取后回写（同 fx_rates 模式）。仅存储，不做任何派生计算。
type Benchmarks struct {
	Store *store.Store
}

// 支持的基准代码 → 外部源标识
const (
	benchmarkCSI300 = "000300" // 沪深300，东方财富 secid 1.000300
	benchmarkSPX    = "SPX"    // 标普500，Stooq ^spx
)

func (h *Benchmarks) RegisterRoutes(mux *http.ServeMux) {
	// 无需认证（与 quotes / fx-rates 一致）
	mux.HandleFunc("GET /api/benchmark-prices", h.getPrices)
}

// GET /api/benchmark-prices?symbols=000300,SPX
func (h *Benchmarks) getPrices(w http.ResponseWriter, r *http.Request) {
	symbolsParam := r.URL.Query().Get("symbols")
	if symbolsParam == "" {
		writeError(w, http.StatusBadRequest, "symbols parameter is required")
		return
	}

	seen := make(map[string]bool)
	var series []model.BenchmarkSeries
	for _, raw := range strings.Split(symbolsParam, ",") {
		symbol := strings.ToUpper(strings.TrimSpace(raw))
		if symbol == "" || seen[symbol] {
			continue
		}
		seen[symbol] = true
		prices := h.resolveSeries(symbol)
		series = append(series, model.BenchmarkSeries{Symbol: symbol, Prices: prices})
	}

	writeJSON(w, http.StatusOK, series)
}

// resolveSeries 加载某基准日线：空表则全量回填，最新日期落后则增量补齐，最后返回完整序列。
func (h *Benchmarks) resolveSeries(symbol string) []model.BenchmarkPrice {
	latest, err := h.Store.LatestBenchmarkDate(symbol)
	if err != nil {
		latest = ""
	}

	today := time.Now().Format("2006-01-02")
	if latest == "" || latest < today {
		if fetched, ferr := fetchBenchmarkSeries(symbol, latest); ferr == nil && len(fetched) > 0 {
			_ = h.Store.UpsertBenchmarkPrices(symbol, fetched)
		}
		// 外部源失败时静默降级：仍返回已有缓存，不阻断对照展示
	}

	prices, err := h.Store.ListBenchmarkPrices(symbol)
	if err != nil {
		return nil
	}
	return prices
}

// fetchBenchmarkSeries 按基准代码分发到对应外部源。
// since 为已缓存的最新日期（""=全量回填），用于增量请求以减小传输量。
func fetchBenchmarkSeries(symbol, since string) ([]model.BenchmarkPrice, error) {
	switch symbol {
	case benchmarkCSI300:
		return fetchEastmoneyKline("1."+benchmarkCSI300, since)
	case benchmarkSPX:
		return fetchStooqDaily("^spx", since)
	default:
		return nil, fmt.Errorf("unsupported benchmark symbol: %s", symbol)
	}
}

// fetchEastmoneyKline 东方财富日线 K 线。
// API: https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.000300&klt=101&fqt=0&fields2=f51,f53&beg=...&end=...
// 返回 data.klines: ["2010-01-04,3535.23", ...]（f51=date, f53=close）
func fetchEastmoneyKline(secid, since string) ([]model.BenchmarkPrice, error) {
	beg := "19900101"
	if since != "" {
		beg = strings.ReplaceAll(since, "-", "")
	}
	url := fmt.Sprintf(
		"https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=%s&klt=101&fqt=0&fields1=f1&fields2=f51,f53&beg=%s&end=20500101",
		secid, beg,
	)
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("eastmoney kline request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var parsed struct {
		Data struct {
			Klines []string `json:"klines"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("parse eastmoney kline: %w", err)
	}

	prices := make([]model.BenchmarkPrice, 0, len(parsed.Data.Klines))
	for _, line := range parsed.Data.Klines {
		fields := strings.Split(line, ",")
		if len(fields) < 2 {
			continue
		}
		close, err := strconv.ParseFloat(strings.TrimSpace(fields[1]), 64)
		if err != nil || close <= 0 {
			continue
		}
		prices = append(prices, model.BenchmarkPrice{Date: strings.TrimSpace(fields[0]), Close: close})
	}
	return prices, nil
}

// fetchStooqDaily Stooq 日线 CSV（免费、无需 key）。
// API: https://stooq.com/q/d/l/?s=^spx&i=d&d1=YYYYMMDD
// CSV: Date,Open,High,Low,Close,Volume
func fetchStooqDaily(symbol, since string) ([]model.BenchmarkPrice, error) {
	url := fmt.Sprintf("https://stooq.com/q/d/l/?s=%s&i=d", symbol)
	if since != "" {
		url += "&d1=" + strings.ReplaceAll(since, "-", "")
	}
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("stooq request failed: %w", err)
	}
	defer resp.Body.Close()

	reader := csv.NewReader(resp.Body)
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("parse stooq csv: %w", err)
	}

	prices := make([]model.BenchmarkPrice, 0, len(records))
	for i, row := range records {
		if i == 0 || len(row) < 5 {
			continue // 跳过表头 / 残行
		}
		close, err := strconv.ParseFloat(strings.TrimSpace(row[4]), 64)
		if err != nil || close <= 0 {
			continue
		}
		prices = append(prices, model.BenchmarkPrice{Date: strings.TrimSpace(row[0]), Close: close})
	}
	return prices, nil
}
