package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/theodore/vibecoding-server/internal/middleware"
	"github.com/theodore/vibecoding-server/internal/model"
	"github.com/theodore/vibecoding-server/internal/store"
)

type PriceRefresh struct {
	Store *store.Store
}

type updatePriceRefreshSettingsRequest struct {
	AutoRefreshEnabled     bool `json:"autoRefreshEnabled"`
	RefreshIntervalMinutes int  `json:"refreshIntervalMinutes"`
	RefreshOnDashboardOpen bool `json:"refreshOnDashboardOpen"`
}

type refreshResponse struct {
	Updated  int                        `json:"updated"`
	Failed   int                        `json:"failed"`
	Skipped  int                        `json:"skipped"`
	Statuses []model.PriceRefreshStatus `json:"statuses"`
}

const (
	priceStatusSuccess = "success"
	priceStatusFailed  = "failed"
	priceStatusSkipped = "skipped"
)

var errNoRefreshSource = errors.New("no refresh source")
var errMarketClosed = errors.New("market closed")
var errQuoteSourceUnavailable = errors.New("quote source unavailable")

var fundCodeMap = map[string]string{
	"中欧时代先锋股票A":      "001938",
	"华夏鼎茂债券A":        "004042",
	"东方臻宝纯债债券A":      "006210",
	"国金惠安利率债A":       "008798",
	"大成中证红利指数A":      "090010",
	"富国天惠成长混合(LOF)A": "161005",
	"广发聚源债券(LOF)A":   "162715",
	"鹏华丰禄债券":         "003547",
	"东方臻宝债":          "006210",
	"华夏鼎茂债":          "004042",
	"国金惠安债券":         "008798",
	"广发聚源债":          "162715",
	"南方崇元债":          "010353",
	"天弘优选债":          "000606",
}

func (h *PriceRefresh) RegisterRoutes(mux *http.ServeMux) {
	authMw := middleware.Auth(h.Store)
	mux.Handle("GET /api/price-refresh/status", authMw(http.HandlerFunc(h.status)))
	mux.Handle("POST /api/price-refresh/all", authMw(http.HandlerFunc(h.refreshAll)))
	mux.Handle("POST /api/price-refresh/assets/{id}", authMw(http.HandlerFunc(h.refreshOne)))
	mux.Handle("GET /api/price-refresh/settings", authMw(http.HandlerFunc(h.getSettings)))
	mux.Handle("PUT /api/price-refresh/settings", authMw(http.HandlerFunc(h.updateSettings)))
}

func (h *PriceRefresh) status(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	statuses, err := h.Store.ListPriceRefreshStatus(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, statuses)
}

func (h *PriceRefresh) getSettings(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	settings, err := h.Store.GetPriceRefreshSettings(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (h *PriceRefresh) updateSettings(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	var req updatePriceRefreshSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if req.RefreshIntervalMinutes <= 0 {
		req.RefreshIntervalMinutes = 30
	}
	settings := model.PriceRefreshSettings{
		UserID:                 userID,
		AutoRefreshEnabled:     req.AutoRefreshEnabled,
		RefreshIntervalMinutes: req.RefreshIntervalMinutes,
		RefreshOnDashboardOpen: req.RefreshOnDashboardOpen,
		UpdatedAt:              time.Now().UTC().Format(time.RFC3339Nano),
	}
	if err := h.Store.UpsertPriceRefreshSettings(settings); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (h *PriceRefresh) refreshAll(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	assets, err := h.Store.ListAssets(userID, "")
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	results := h.refreshAssets(userID, assets)
	h.writeRefreshResponse(w, userID, results)
}

func (h *PriceRefresh) refreshOne(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	asset, err := h.Store.GetAsset(r.PathValue("id"), userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "asset not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	results := h.refreshAssets(userID, []model.Asset{asset})
	h.writeRefreshResponse(w, userID, results)
}

func (h *PriceRefresh) writeRefreshResponse(w http.ResponseWriter, userID string, results []model.AssetPriceStatus) {
	updated, failed, skipped := 0, 0, 0
	for _, result := range results {
		switch result.Status {
		case priceStatusSuccess:
			updated++
		case priceStatusFailed:
			failed++
		default:
			skipped++
		}
	}
	statuses, err := h.Store.ListPriceRefreshStatus(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, refreshResponse{Updated: updated, Failed: failed, Skipped: skipped, Statuses: statuses})
}

func (h *PriceRefresh) refreshAssets(userID string, assets []model.Asset) []model.AssetPriceStatus {
	now := time.Now().UTC().Format(time.RFC3339Nano)
	results := make([]model.AssetPriceStatus, 0, len(assets))

	for _, asset := range assets {
		status := model.AssetPriceStatus{
			AssetID:       asset.ID,
			UserID:        userID,
			Source:        priceSource(asset),
			LastPrice:     asset.CurrentPrice,
			LastAttemptAt: now,
			Status:        priceStatusSkipped,
			ErrorMessage:  "",
			UpdatedAt:     now,
		}
		if asset.Category == model.CategoryCash || asset.Category == model.CategoryCurrency {
			status.ErrorMessage = "fixed price"
			_ = h.Store.UpsertAssetPriceStatus(status)
			results = append(results, status)
			continue
		}

		price, source, err := fetchAssetPrice(asset)
		status.Source = source
		if errors.Is(err, errNoRefreshSource) {
			status.Status = priceStatusSkipped
			status.ErrorMessage = "no refresh source"
		} else if errors.Is(err, errMarketClosed) {
			status.Status = priceStatusSkipped
			status.ErrorMessage = "market closed"
		} else if errors.Is(err, errQuoteSourceUnavailable) {
			status.Status = priceStatusSkipped
			status.ErrorMessage = "quote source unavailable"
		} else if err != nil {
			status.Status = priceStatusFailed
			status.ErrorMessage = err.Error()
		} else if price <= 0 {
			status.Status = priceStatusFailed
			status.ErrorMessage = "price unavailable"
		} else {
			status.Status = priceStatusSuccess
			status.LastPrice = price
			status.LastSuccessAt = now
			if absFloat(asset.CurrentPrice-price) > priceTolerance(asset) {
				asset.CurrentPrice = price
				asset.UpdatedAt = now
				if err := h.Store.UpdateAsset(asset); err != nil {
					status.Status = priceStatusFailed
					status.ErrorMessage = err.Error()
					status.LastPrice = asset.CurrentPrice
					status.LastSuccessAt = ""
				}
			}
		}

		if status.Status == priceStatusSkipped && status.ErrorMessage == "" {
			status.ErrorMessage = "no refresh source"
		}
		_ = h.Store.UpsertAssetPriceStatus(status)
		results = append(results, status)
	}
	return results
}

func fetchAssetPrice(asset model.Asset) (float64, string, error) {
	if asset.Quantity <= 0 {
		return 0, "none", fmt.Errorf("not an active holding")
	}
	if code := fundCodeMap[asset.Symbol]; code != "" {
		nav := fetchOneNav(code)
		if nav.Error != "" {
			return 0, "eastmoney", errors.New(nav.Error)
		}
		return nav.Nav, "eastmoney", nil
	}
	if asset.Category == model.CategoryGold || asset.Market == "gold" {
		quote, err := fetchGoldPrice()
		if err != nil {
			if strings.Contains(err.Error(), "gold market closed") {
				return 0, "sina-gold", errMarketClosed
			}
			return 0, "sina-gold", err
		}
		return quote.Price, "sina-gold", nil
	}

	ticker := normalizeTicker(asset.Symbol, asset.Market)
	switch asset.Market {
	case "us":
		price, source, err := fetchUSPrice(ticker)
		return price, source, err
	case "hk":
		quotes, err := fetchSinaPrices(nil, []string{ticker})
		return quotePrice(ticker, "sina-hk", quotes, err)
	case "crypto":
		quotes, err := fetchCryptoPrices([]string{ticker})
		price, source, quoteErr := quotePrice(ticker, "binance", quotes, err)
		if quoteErr != nil && isUnsupportedSymbolError(quoteErr) {
			return 0, source, errNoRefreshSource
		}
		return price, source, quoteErr
	default:
		return 0, "none", errNoRefreshSource
	}
}

func isUnsupportedSymbolError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "unsupported symbol") ||
		strings.Contains(message, "invalid symbol") ||
		strings.Contains(message, "symbol is not valid")
}

func normalizeTicker(symbol string, market string) string {
	fields := strings.Fields(strings.ToUpper(strings.TrimSpace(symbol)))
	if len(fields) == 0 {
		return ""
	}
	if market == "us" && len(fields) >= 2 && len(fields[1]) == 1 {
		return fields[0] + "-" + fields[1]
	}
	return strings.ReplaceAll(fields[0], ".", "-")
}

func fetchUSPrice(ticker string) (float64, string, error) {
	sinaTicker := strings.ReplaceAll(ticker, "-", "")
	quotes, err := fetchSinaPrices([]string{sinaTicker}, nil)
	price, _, quoteErr := quotePrice(sinaTicker, "sina-us", quotes, err)
	if quoteErr == nil && price > 0 {
		return price, "sina-us", nil
	}

	stooqPrice, stooqErr := fetchStooqUSPrice(ticker)
	if stooqErr == nil && stooqPrice > 0 {
		return stooqPrice, "stooq-us", nil
	}
	yahooPrice, yahooErr := fetchYahooUSPrice(ticker)
	if yahooErr == nil && yahooPrice > 0 {
		return yahooPrice, "yahoo-us", nil
	}
	if quoteErr != nil {
		return 0, "sina-us", quoteErr
	}
	if isTemporaryQuoteSourceError(stooqErr) || isTemporaryQuoteSourceError(yahooErr) {
		return 0, "market-data", errQuoteSourceUnavailable
	}
	return 0, "stooq-us", stooqErr
}

func isTemporaryQuoteSourceError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "timeout") ||
		strings.Contains(message, "deadline exceeded") ||
		strings.Contains(message, "returned html") ||
		strings.Contains(message, "status 429") ||
		strings.Contains(message, "status 403")
}

func quotePrice(symbol, source string, quotes []QuoteResult, err error) (float64, string, error) {
	if err != nil {
		return 0, source, err
	}
	for _, quote := range quotes {
		if strings.EqualFold(quote.Symbol, symbol) {
			if quote.Error != "" {
				return 0, source, errors.New(quote.Error)
			}
			return quote.Price, source, nil
		}
	}
	return 0, source, fmt.Errorf("quote not found")
}

func priceSource(asset model.Asset) string {
	if asset.Category == model.CategoryCash || asset.Category == model.CategoryCurrency {
		return "fixed"
	}
	if fundCodeMap[asset.Symbol] != "" {
		return "eastmoney"
	}
	if asset.Category == model.CategoryGold || asset.Market == "gold" {
		return "sina-gold"
	}
	switch asset.Market {
	case "us":
		return "sina-us"
	case "hk":
		return "sina-hk"
	case "crypto":
		return "binance"
	default:
		return "none"
	}
}

func priceTolerance(asset model.Asset) float64 {
	if asset.Category == model.CategoryGold {
		return 0.01
	}
	if fundCodeMap[asset.Symbol] != "" {
		return 0.0001
	}
	return 0.001
}

func absFloat(value float64) float64 {
	if value < 0 {
		return -value
	}
	return value
}
