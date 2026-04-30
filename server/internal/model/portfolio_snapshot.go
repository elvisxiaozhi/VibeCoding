package model

type PortfolioSnapshotBreakdown struct {
	Dimension string  `json:"dimension"`
	Key       string  `json:"key"`
	Label     string  `json:"label"`
	ValueCNY  float64 `json:"valueCNY"`
	CostCNY   float64 `json:"costCNY"`
	PnLCNY    float64 `json:"pnlCNY"`
	Ratio     float64 `json:"ratio"`
}

type PortfolioSnapshot struct {
	ID               string                       `json:"id"`
	UserID           string                       `json:"-"`
	SnapshotDate     string                       `json:"snapshotDate"`
	TotalValueCNY    float64                      `json:"totalValueCNY"`
	TotalCostCNY     float64                      `json:"totalCostCNY"`
	TotalPnLCNY      float64                      `json:"totalPnLCNY"`
	TotalDividendCNY float64                      `json:"totalDividendCNY"`
	AssetCount       int                          `json:"assetCount"`
	RatesJSON        string                       `json:"-"`
	AssetsJSON       string                       `json:"-"`
	Breakdowns       []PortfolioSnapshotBreakdown `json:"breakdowns,omitempty"`
	CreatedAt        string                       `json:"createdAt"`
	UpdatedAt        string                       `json:"updatedAt"`
}
