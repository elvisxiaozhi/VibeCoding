package handler

import (
	"encoding/json"
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

// GET /api/quotes?symbols=AAPL,NVDA&hkSymbols=06883&cryptoSymbols=BTC
func (h *Quotes) getQuotes(w http.ResponseWriter, r *http.Request) {
	symbolsParam := r.URL.Query().Get("symbols")
	hkSymbolsParam := r.URL.Query().Get("hkSymbols")
	cryptoSymbolsParam := r.URL.Query().Get("cryptoSymbols")

	if symbolsParam == "" && hkSymbolsParam == "" && cryptoSymbolsParam == "" {
		writeError(w, http.StatusBadRequest, "symbols, hkSymbols, or cryptoSymbols parameter is required")
		return
	}

	var usSymbols, hkSymbols, cryptoSymbols []string
	for _, s := range strings.Split(symbolsParam, ",") {
		if s = strings.TrimSpace(s); s != "" {
			usSymbols = append(usSymbols, s)
		}
	}
	for _, s := range strings.Split(hkSymbolsParam, ",") {
		if s = strings.TrimSpace(s); s != "" {
			hkSymbols = append(hkSymbols, s)
		}
	}
	for _, s := range strings.Split(cryptoSymbolsParam, ",") {
		if s = strings.TrimSpace(s); s != "" {
			cryptoSymbols = append(cryptoSymbols, s)
		}
	}

	if len(usSymbols)+len(hkSymbols)+len(cryptoSymbols) > 50 {
		writeError(w, http.StatusBadRequest, "too many symbols (max 50)")
		return
	}

	results, err := fetchSinaPrices(usSymbols, hkSymbols)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if len(cryptoSymbols) > 0 {
		cryptoResults, err := fetchCryptoPrices(cryptoSymbols)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		results = append(results, cryptoResults...)
	}

	writeJSON(w, http.StatusOK, results)
}

type sinaSymbolInfo struct {
	original   string
	priceField int // 美股 field[1]，港股 field[3]
}

// fetchSinaPrices 通过新浪财经 API 批量获取美股 + 港股报价
// 美股: gb_aapl → var hq_str_gb_aapl="苹果,270.23,..."  price=field[1]
// 港股: hk06883 → var hq_str_hk06883="颖通控股,2.01,1.98,1.99,..."  price=field[3]
func fetchSinaPrices(usSymbols []string, hkSymbols []string) ([]QuoteResult, error) {
	var sinaSymbols []string
	symbolMap := make(map[string]sinaSymbolInfo)

	for _, s := range usSymbols {
		key := "gb_" + strings.ToLower(s)
		sinaSymbols = append(sinaSymbols, key)
		symbolMap[key] = sinaSymbolInfo{original: s, priceField: 1}
	}
	for _, s := range hkSymbols {
		key := "hk" + s
		sinaSymbols = append(sinaSymbols, key)
		symbolMap[key] = sinaSymbolInfo{original: s, priceField: 3}
	}

	if len(sinaSymbols) == 0 {
		return []QuoteResult{}, nil
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
	results := make([]QuoteResult, 0, len(sinaSymbols))

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
		sinaKey := strings.TrimPrefix(varPart, "hq_str_")

		info, ok := symbolMap[sinaKey]
		if !ok {
			continue
		}

		// 提取引号中的数据
		dataPart := line[eqIdx+1:]
		dataPart = strings.Trim(dataPart, "\"';")

		if dataPart == "" {
			results = append(results, QuoteResult{Symbol: info.original, Error: "no data"})
			continue
		}

		fields := strings.Split(dataPart, ",")
		if len(fields) <= info.priceField {
			results = append(results, QuoteResult{Symbol: info.original, Error: "invalid data format"})
			continue
		}

		price, err := strconv.ParseFloat(fields[info.priceField], 64)
		if err != nil {
			results = append(results, QuoteResult{Symbol: info.original, Error: fmt.Sprintf("parse price failed: %v", err)})
			continue
		}

		results = append(results, QuoteResult{Symbol: info.original, Price: price})
	}

	return results, nil
}

// fetchCryptoPrices 通过 Binance Vision API 获取加密货币报价
// symbol 约定：BTC → BTCUSDT，ETH → ETHUSDT
func fetchCryptoPrices(symbols []string) ([]QuoteResult, error) {
	// Binance pair map: crypto symbol → trading pair
	pairMap := map[string]string{
		"BTC": "BTCUSDT",
		"ETH": "ETHUSDT",
	}

	var results []QuoteResult
	client := &http.Client{Timeout: 10 * time.Second}

	for _, s := range symbols {
		sym := strings.ToUpper(s)
		pair, ok := pairMap[sym]
		if !ok {
			results = append(results, QuoteResult{Symbol: sym, Error: "unsupported symbol"})
			continue
		}

		url := "https://data-api.binance.vision/api/v3/ticker/price?symbol=" + pair
		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			results = append(results, QuoteResult{Symbol: sym, Error: err.Error()})
			continue
		}

		resp, err := client.Do(req)
		if err != nil {
			results = append(results, QuoteResult{Symbol: sym, Error: fmt.Sprintf("binance request failed: %v", err)})
			continue
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		// {"symbol":"BTCUSDT","price":"87000.12"}
		var parsed struct {
			Price string `json:"price"`
		}
		if err := json.Unmarshal(body, &parsed); err != nil || parsed.Price == "" {
			results = append(results, QuoteResult{Symbol: sym, Error: "parse failed"})
			continue
		}

		price, err := strconv.ParseFloat(parsed.Price, 64)
		if err != nil {
			results = append(results, QuoteResult{Symbol: sym, Error: "parse price failed"})
			continue
		}
		results = append(results, QuoteResult{Symbol: sym, Price: price})
	}
	return results, nil
}
