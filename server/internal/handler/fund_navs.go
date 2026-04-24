package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// FundNavResult 单个基金最新净值
type FundNavResult struct {
	Code  string  `json:"code"`
	Nav   float64 `json:"nav"`
	Date  string  `json:"date,omitempty"`
	Error string  `json:"error,omitempty"`
}

// FundNavs 基金净值代理 handler
type FundNavs struct{}

// RegisterRoutes 注册基金净值路由（无需认证）
func (h *FundNavs) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/fund-navs", h.getNavs)
}

// GET /api/fund-navs?codes=161005,004042,162716
func (h *FundNavs) getNavs(w http.ResponseWriter, r *http.Request) {
	codesParam := r.URL.Query().Get("codes")
	if codesParam == "" {
		writeError(w, http.StatusBadRequest, "codes parameter is required")
		return
	}

	codes := strings.Split(codesParam, ",")
	if len(codes) > 50 {
		writeError(w, http.StatusBadRequest, "too many codes (max 50)")
		return
	}

	var cleanCodes []string
	for _, c := range codes {
		c = strings.TrimSpace(c)
		if c != "" {
			cleanCodes = append(cleanCodes, c)
		}
	}

	results := fetchEastmoneyNavs(cleanCodes)
	writeJSON(w, http.StatusOK, results)
}

// fetchEastmoneyNavs 并发从天天基金 API 获取最新净值
// API: https://api.fund.eastmoney.com/f10/lsjz?fundCode=161005&pageSize=1
func fetchEastmoneyNavs(codes []string) []FundNavResult {
	results := make([]FundNavResult, len(codes))
	var wg sync.WaitGroup
	for i, code := range codes {
		wg.Add(1)
		go func(idx int, c string) {
			defer wg.Done()
			results[idx] = fetchOneNav(c)
		}(i, code)
	}
	wg.Wait()
	return results
}

func fetchOneNav(code string) FundNavResult {
	res := FundNavResult{Code: code}

	url := fmt.Sprintf(
		"https://api.fund.eastmoney.com/f10/lsjz?fundCode=%s&pageIndex=1&pageSize=1",
		code,
	)
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		res.Error = err.Error()
		return res
	}
	req.Header.Set("Referer", "https://fundf10.eastmoney.com/")
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := client.Do(req)
	if err != nil {
		res.Error = fmt.Sprintf("request failed: %v", err)
		return res
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		res.Error = fmt.Sprintf("read body failed: %v", err)
		return res
	}

	// 响应结构：{"Data":{"LSJZList":[{"FSRQ":"2026-04-23","DWJZ":"3.1595",...}]}}
	var parsed struct {
		Data struct {
			LSJZList []struct {
				FSRQ string `json:"FSRQ"`
				DWJZ string `json:"DWJZ"`
			} `json:"LSJZList"`
		} `json:"Data"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		res.Error = fmt.Sprintf("parse failed: %v", err)
		return res
	}

	if len(parsed.Data.LSJZList) == 0 {
		res.Error = "no data"
		return res
	}

	latest := parsed.Data.LSJZList[0]
	var nav float64
	if _, err := fmt.Sscanf(latest.DWJZ, "%f", &nav); err != nil {
		res.Error = fmt.Sprintf("parse nav failed: %v", err)
		return res
	}

	res.Nav = nav
	res.Date = latest.FSRQ
	return res
}
