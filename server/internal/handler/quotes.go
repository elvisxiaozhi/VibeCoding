package handler

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
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

// GET /api/quotes?symbols=AAPL,NVDA&hkSymbols=06883&cryptoSymbols=BTC&goldSymbol=Au9999
func (h *Quotes) getQuotes(w http.ResponseWriter, r *http.Request) {
	symbolsParam := r.URL.Query().Get("symbols")
	hkSymbolsParam := r.URL.Query().Get("hkSymbols")
	cryptoSymbolsParam := r.URL.Query().Get("cryptoSymbols")
	goldSymbolParam := r.URL.Query().Get("goldSymbol")

	if symbolsParam == "" && hkSymbolsParam == "" && cryptoSymbolsParam == "" && goldSymbolParam == "" {
		writeError(w, http.StatusBadRequest, "symbols, hkSymbols, cryptoSymbols, or goldSymbol parameter is required")
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

	if goldSymbolParam != "" {
		goldResult, err := fetchGoldPrice()
		if err != nil {
			results = append(results, QuoteResult{Symbol: "GOLD", Error: err.Error()})
		} else {
			results = append(results, goldResult)
		}
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
		varPart := line[:eqIdx]                       // var hq_str_gb_aapl
		varPart = strings.TrimPrefix(varPart, "var ") // hq_str_gb_aapl
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

// fetchGoldPrice 获取黄金现货价格（CNY/克）
// 仅使用新浪 Au9999（上海黄金交易所现货），非交易时段返回错误，前端会保留旧价不刷新
func fetchGoldPrice() (QuoteResult, error) {
	price, err := fetchGoldSina()
	if err != nil {
		return QuoteResult{Symbol: "GOLD"}, fmt.Errorf("gold price unavailable: %w", err)
	}
	if price <= 0 {
		return QuoteResult{Symbol: "GOLD"}, fmt.Errorf("gold market closed")
	}
	return QuoteResult{Symbol: "GOLD", Price: price}, nil
}

func fetchYahooUSPrice(symbol string) (float64, error) {
	client := &http.Client{Timeout: 4 * time.Second}
	req, err := http.NewRequest("GET", "https://query1.finance.yahoo.com/v8/finance/chart/"+url.PathEscape(symbol)+"?range=1d&interval=1d", nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("yahoo request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("read yahoo body failed: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return 0, fmt.Errorf("yahoo status %d", resp.StatusCode)
	}
	if strings.HasPrefix(strings.TrimSpace(string(body)), "<") {
		return 0, fmt.Errorf("yahoo returned html")
	}

	var parsed struct {
		Chart struct {
			Result []struct {
				Meta struct {
					RegularMarketPrice float64 `json:"regularMarketPrice"`
					PreviousClose      float64 `json:"previousClose"`
				} `json:"meta"`
			} `json:"result"`
			Error any `json:"error"`
		} `json:"chart"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return 0, fmt.Errorf("parse yahoo failed: %w", err)
	}
	if len(parsed.Chart.Result) == 0 {
		return 0, fmt.Errorf("no data")
	}
	price := parsed.Chart.Result[0].Meta.RegularMarketPrice
	if price <= 0 {
		price = parsed.Chart.Result[0].Meta.PreviousClose
	}
	if price <= 0 {
		return 0, fmt.Errorf("no data")
	}
	return price, nil
}

func fetchStooqUSPrice(symbol string) (float64, error) {
	stooqSymbol := strings.ToLower(strings.ReplaceAll(symbol, ".", "-")) + ".us"
	client := &http.Client{Timeout: 4 * time.Second}
	req, err := http.NewRequest("GET", "https://stooq.com/q/l/?s="+url.QueryEscape(stooqSymbol)+"&f=sd2t2ohlcv&h&e=csv", nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("stooq request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return 0, fmt.Errorf("stooq status %d", resp.StatusCode)
	}

	records, err := csv.NewReader(resp.Body).ReadAll()
	if err != nil {
		return 0, fmt.Errorf("parse stooq failed: %w", err)
	}
	if len(records) < 2 || len(records[1]) < 7 {
		return 0, fmt.Errorf("no data")
	}
	closeValue := strings.TrimSpace(records[1][6])
	if closeValue == "" || strings.EqualFold(closeValue, "N/D") {
		return 0, fmt.Errorf("no data")
	}
	price, err := strconv.ParseFloat(closeValue, 64)
	if err != nil {
		return 0, fmt.Errorf("parse stooq price failed: %w", err)
	}
	if price <= 0 {
		return 0, fmt.Errorf("no data")
	}
	return price, nil
}

// fetchGoldSina 通过新浪财经获取 Au9999 现货价格（CNY/克），非交易时段返回 0
func fetchGoldSina() (float64, error) {
	client := &http.Client{Timeout: 8 * time.Second}
	req, err := http.NewRequest("GET", "https://hq.sinajs.cn/list=Au9999", nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Referer", "https://finance.sina.com.cn")

	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	line := strings.TrimSpace(string(body))
	eqIdx := strings.Index(line, "=")
	if eqIdx < 0 {
		return 0, fmt.Errorf("unexpected sina format")
	}
	dataPart := strings.Trim(line[eqIdx+1:], "\"';")
	if dataPart == "" {
		return 0, nil // 非交易时段
	}
	fields := strings.Split(dataPart, ",")
	if len(fields) < 2 {
		return 0, fmt.Errorf("insufficient fields")
	}
	return strconv.ParseFloat(strings.TrimSpace(fields[1]), 64)
}

// fetchCryptoPrices 通过 Binance Vision API 获取加密货币报价
// symbol 约定：BTC → BTCUSDT，PYTH → PYTHUSDT，USDT 固定为 1
func fetchCryptoPrices(symbols []string) ([]QuoteResult, error) {
	var results []QuoteResult
	client := &http.Client{Timeout: 10 * time.Second}

	for _, s := range symbols {
		sym := strings.ToUpper(s)
		if sym == "USDT" {
			results = append(results, QuoteResult{Symbol: sym, Price: 1})
			continue
		}
		pair := sym + "USDT"

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

		var parsed struct {
			Price string `json:"price"`
			Msg   string `json:"msg"`
		}
		if err := json.Unmarshal(body, &parsed); err != nil || parsed.Price == "" {
			if parsed.Msg != "" {
				results = append(results, QuoteResult{Symbol: sym, Error: parsed.Msg})
				continue
			}
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
