package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/theodore/vibecoding-server/internal/middleware"
	"github.com/theodore/vibecoding-server/internal/model"
	"github.com/theodore/vibecoding-server/internal/store"
)

type PortfolioSnapshots struct {
	Store *store.Store
}

type snapshotRequest struct {
	SnapshotDate string             `json:"snapshotDate"`
	Rates        map[string]float64 `json:"rates"`
}

type snapshotResponse struct {
	model.PortfolioSnapshot
	Assets json.RawMessage `json:"assets,omitempty"`
	Rates  json.RawMessage `json:"rates,omitempty"`
}

type snapshotBucket struct {
	label    string
	valueCNY float64
	costCNY  float64
	pnlCNY   float64
}

func (h *PortfolioSnapshots) RegisterRoutes(mux *http.ServeMux) {
	authMw := middleware.Auth(h.Store)
	mux.Handle("GET /api/portfolio-snapshots", authMw(http.HandlerFunc(h.list)))
	mux.Handle("GET /api/portfolio-snapshots/{date}", authMw(http.HandlerFunc(h.get)))
	mux.Handle("POST /api/portfolio-snapshots", authMw(http.HandlerFunc(h.create)))
}

func (h *PortfolioSnapshots) list(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	snapshots, err := h.Store.ListPortfolioSnapshots(userID, r.URL.Query().Get("from"), r.URL.Query().Get("to"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if snapshots == nil {
		snapshots = []model.PortfolioSnapshot{}
	}
	writeJSON(w, http.StatusOK, snapshots)
}

func (h *PortfolioSnapshots) get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	snapshot, err := h.Store.GetPortfolioSnapshot(userID, r.PathValue("date"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "snapshot not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, snapshotToResponse(snapshot))
}

func (h *PortfolioSnapshots) create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	var req snapshotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if req.SnapshotDate == "" {
		req.SnapshotDate = time.Now().Format("2006-01-02")
	}
	if _, err := time.Parse("2006-01-02", req.SnapshotDate); err != nil {
		writeError(w, http.StatusBadRequest, "snapshotDate must be YYYY-MM-DD")
		return
	}
	if req.Rates == nil {
		req.Rates = map[string]float64{"USD": 1, "CNY": 7.25, "HKD": 7.82}
	}

	assets, err := h.Store.ListAssets(userID, "")
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	snapshot, err := buildSnapshot(userID, req.SnapshotDate, assets, req.Rates)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := h.Store.UpsertPortfolioSnapshot(snapshot); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	stored, err := h.Store.GetPortfolioSnapshot(userID, req.SnapshotDate)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, snapshotToResponse(stored))
}

func buildSnapshot(userID, snapshotDate string, assets []model.Asset, rates map[string]float64) (model.PortfolioSnapshot, error) {
	now := time.Now().UTC().Format(time.RFC3339Nano)
	assetsJSON, err := json.Marshal(assets)
	if err != nil {
		return model.PortfolioSnapshot{}, err
	}
	ratesJSON, err := json.Marshal(rates)
	if err != nil {
		return model.PortfolioSnapshot{}, err
	}

	marketBuckets := map[string]*snapshotBucket{}
	currencyBuckets := map[string]*snapshotBucket{}
	ownerBuckets := map[string]*snapshotBucket{}

	var totalValueCNY float64
	var totalCostCNY float64
	var totalDividendCNY float64
	holdingCount := 0

	for _, asset := range assets {
		if asset.Quantity > 0 {
			holdingCount++
			valueCNY := toSnapshotCNY(asset.CurrentPrice*asset.Quantity, asset.Currency, rates)
			costCNY := toSnapshotCNY(asset.CostBasis*asset.Quantity, asset.Currency, rates)
			pnlCNY := valueCNY - costCNY
			totalValueCNY += valueCNY
			totalCostCNY += costCNY
			addSnapshotBucket(marketBuckets, asset.Market, marketLabel(asset.Market), valueCNY, costCNY, pnlCNY)
			addSnapshotBucket(currencyBuckets, asset.Currency, asset.Currency, valueCNY, costCNY, pnlCNY)
			addSnapshotBucket(ownerBuckets, asset.Owner, ownerLabel(asset.Owner), valueCNY, costCNY, pnlCNY)
		}
		if asset.Quantity == 0 && asset.Dividends > 0 {
			dividendCNY := toSnapshotCNY(asset.Dividends, asset.Currency, rates)
			totalDividendCNY += dividendCNY
			addSnapshotBucket(marketBuckets, asset.Market, marketLabel(asset.Market), 0, 0, dividendCNY)
			addSnapshotBucket(currencyBuckets, asset.Currency, asset.Currency, 0, 0, dividendCNY)
			addSnapshotBucket(ownerBuckets, asset.Owner, ownerLabel(asset.Owner), 0, 0, dividendCNY)
		}
	}

	totalPnLCNY := totalValueCNY - totalCostCNY + totalDividendCNY
	breakdowns := make([]model.PortfolioSnapshotBreakdown, 0)
	breakdowns = append(breakdowns, snapshotBreakdowns("market", marketBuckets, totalValueCNY)...)
	breakdowns = append(breakdowns, snapshotBreakdowns("currency", currencyBuckets, totalValueCNY)...)
	breakdowns = append(breakdowns, snapshotBreakdowns("owner", ownerBuckets, totalValueCNY)...)

	return model.PortfolioSnapshot{
		ID:               uuid.NewString(),
		UserID:           userID,
		SnapshotDate:     snapshotDate,
		TotalValueCNY:    totalValueCNY,
		TotalCostCNY:     totalCostCNY,
		TotalPnLCNY:      totalPnLCNY,
		TotalDividendCNY: totalDividendCNY,
		AssetCount:       holdingCount,
		RatesJSON:        string(ratesJSON),
		AssetsJSON:       string(assetsJSON),
		Breakdowns:       breakdowns,
		CreatedAt:        now,
		UpdatedAt:        now,
	}, nil
}

func toSnapshotCNY(amount float64, currency string, rates map[string]float64) float64 {
	if currency == "CNY" {
		return amount
	}
	cnyRate := rates["CNY"]
	if cnyRate == 0 {
		cnyRate = 7.25
	}
	fromRate := rates[currency]
	if fromRate == 0 {
		fromRate = 1
	}
	return (amount / fromRate) * cnyRate
}

func addSnapshotBucket(buckets map[string]*snapshotBucket, key, label string, valueCNY, costCNY, pnlCNY float64) {
	if key == "" {
		key = "unknown"
	}
	if label == "" {
		label = key
	}
	bucket := buckets[key]
	if bucket == nil {
		bucket = &snapshotBucket{label: label}
		buckets[key] = bucket
	}
	bucket.valueCNY += valueCNY
	bucket.costCNY += costCNY
	bucket.pnlCNY += pnlCNY
}

func snapshotBreakdowns(dimension string, buckets map[string]*snapshotBucket, totalValueCNY float64) []model.PortfolioSnapshotBreakdown {
	items := make([]model.PortfolioSnapshotBreakdown, 0, len(buckets))
	for key, bucket := range buckets {
		ratio := 0.0
		if totalValueCNY > 0 {
			ratio = bucket.valueCNY / totalValueCNY
		}
		items = append(items, model.PortfolioSnapshotBreakdown{
			Dimension: dimension,
			Key:       key,
			Label:     bucket.label,
			ValueCNY:  bucket.valueCNY,
			CostCNY:   bucket.costCNY,
			PnLCNY:    bucket.pnlCNY,
			Ratio:     ratio,
		})
	}
	return items
}

func marketLabel(market string) string {
	switch market {
	case "cn":
		return "人民币资产"
	case "hk":
		return "港股资产"
	case "us":
		return "美股资产"
	case "crypto":
		return "加密货币资产"
	case "gold":
		return "黄金资产"
	default:
		return market
	}
}

func ownerLabel(owner string) string {
	switch owner {
	case "me":
		return "我的"
	case "wife":
		return "老婆的"
	default:
		return owner
	}
}

func snapshotToResponse(snapshot model.PortfolioSnapshot) snapshotResponse {
	return snapshotResponse{
		PortfolioSnapshot: snapshot,
		Assets:            json.RawMessage(snapshot.AssetsJSON),
		Rates:             json.RawMessage(snapshot.RatesJSON),
	}
}
