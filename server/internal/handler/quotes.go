package handler

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// QuoteResult 单个标的报价
type QuoteResult struct {
	Symbol string  `json:"symbol"`
	Price  float64 `json:"price"`
	Error  string  `json:"error,omitempty"`
}

// Quotes 报价代理 handler
type Quotes struct{}

// RegisterRoutes 注册报价路由（无需认证）
func (h *Quotes) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/quotes", h.getQuotes)
}

// GET /api/quotes?symbols=AAPL,NVDA,MSFT
func (h *Quotes) getQuotes(w http.ResponseWriter, r *http.Request) {
	symbolsParam := r.URL.Query().Get("symbols")
	if symbolsParam == "" {
		writeError(w, http.StatusBadRequest, "symbols parameter is required")
		return
	}

	symbols := strings.Split(symbolsParam, ",")
	if len(symbols) > 50 {
		writeError(w, http.StatusBadRequest, "too many symbols (max 50)")
		return
	}

	// 清理并构建 Sina 查询参数
	var cleanSymbols []string
	for _, s := range symbols {
		s = strings.TrimSpace(s)
		if s != "" {
			cleanSymbols = append(cleanSymbols, s)
		}
	}

	results, err := fetchSinaPrices(cleanSymbols)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, results)
}

// fetchSinaPrices 通过新浪财经 API 批量获取美股报价
// API: https://hq.sinajs.cn/list=gb_aapl,gb_nvda,...
// 返回格式: var hq_str_gb_aapl="苹果,270.23,..."
func fetchSinaPrices(symbols []string) ([]QuoteResult, error) {
	// 构建 sina 参数：美股前缀 gb_，小写
	var sinaSymbols []string
	symbolMap := make(map[string]string) // gb_aapl -> AAPL
	for _, s := range symbols {
		sinaKey := "gb_" + strings.ToLower(s)
		sinaSymbols = append(sinaSymbols, sinaKey)
		symbolMap[sinaKey] = s
	}

	url := "https://hq.sinajs.cn/list=" + strings.Join(sinaSymbols, ",")

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Referer", "https://finance.sina.com.cn")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sina request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body failed: %w", err)
	}

	// 解析返回数据
	// 每行格式: var hq_str_gb_aapl="name,price,...";
	lines := strings.Split(string(body), "\n")
	results := make([]QuoteResult, 0, len(symbols))

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// 提取 hq_str_gb_xxx
		eqIdx := strings.Index(line, "=")
		if eqIdx < 0 {
			continue
		}
		varPart := line[:eqIdx]                           // var hq_str_gb_aapl
		varPart = strings.TrimPrefix(varPart, "var ")     // hq_str_gb_aapl
		sinaKey := strings.TrimPrefix(varPart, "hq_str_") // gb_aapl

		originalSymbol, ok := symbolMap[sinaKey]
		if !ok {
			continue
		}

		// 提取引号中的数据
		dataPart := line[eqIdx+1:]
		dataPart = strings.Trim(dataPart, "\"';")

		if dataPart == "" {
			results = append(results, QuoteResult{
				Symbol: originalSymbol,
				Error:  "no data",
			})
			continue
		}

		// 逗号分隔，第2个字段是最新价
		fields := strings.Split(dataPart, ",")
		if len(fields) < 2 {
			results = append(results, QuoteResult{
				Symbol: originalSymbol,
				Error:  "invalid data format",
			})
			continue
		}

		price, err := strconv.ParseFloat(fields[1], 64)
		if err != nil {
			results = append(results, QuoteResult{
				Symbol: originalSymbol,
				Error:  fmt.Sprintf("parse price failed: %v", err),
			})
			continue
		}

		results = append(results, QuoteResult{
			Symbol: originalSymbol,
			Price:  price,
		})
	}

	return results, nil
}
