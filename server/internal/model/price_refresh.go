package model

type PriceRefreshSettings struct {
	UserID                 string `json:"-"`
	AutoRefreshEnabled     bool   `json:"autoRefreshEnabled"`
	RefreshIntervalMinutes int    `json:"refreshIntervalMinutes"`
	RefreshOnDashboardOpen bool   `json:"refreshOnDashboardOpen"`
	UpdatedAt              string `json:"updatedAt"`
}

type AssetPriceStatus struct {
	AssetID       string  `json:"assetId"`
	UserID        string  `json:"-"`
	Source        string  `json:"source"`
	LastPrice     float64 `json:"lastPrice"`
	LastSuccessAt string  `json:"lastSuccessAt"`
	LastAttemptAt string  `json:"lastAttemptAt"`
	Status        string  `json:"status"`
	ErrorMessage  string  `json:"errorMessage,omitempty"`
	UpdatedAt     string  `json:"updatedAt"`
}

type PriceRefreshStatus struct {
	AssetPriceStatus
	Symbol       string  `json:"symbol"`
	Market       string  `json:"market"`
	Category     string  `json:"category"`
	Currency     string  `json:"currency"`
	CurrentPrice float64 `json:"currentPrice"`
	Quantity     float64 `json:"quantity"`
	Owner        string  `json:"owner"`
}
