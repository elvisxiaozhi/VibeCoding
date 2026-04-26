package model

// AssetCategory 资产分类，与前端 src/lib/types.ts 手动保持一致
type AssetCategory = string

const (
	CategoryStock    AssetCategory = "stock"
	CategoryETF      AssetCategory = "etf"
	CategoryGold     AssetCategory = "gold"
	CategoryCrypto   AssetCategory = "crypto"
	CategoryCash     AssetCategory = "cash"
	CategoryCurrency AssetCategory = "currency"
)

// MarketType 所属市场/板块
type MarketType = string

const (
	MarketCn     MarketType = "cn"
	MarketHk     MarketType = "hk"
	MarketUs     MarketType = "us"
	MarketCrypto MarketType = "crypto"
)

// Asset 单条资产记录，JSON tag 与前端 Asset interface 一一对应
type Asset struct {
	ID           string  `json:"id"`
	UserID       string  `json:"-"`
	Symbol       string  `json:"symbol"`
	Category     string  `json:"category"`
	Market       string  `json:"market"`
	CostBasis    float64 `json:"costBasis"`
	CurrentPrice float64 `json:"currentPrice"`
	Quantity     float64 `json:"quantity"`
	Currency     string  `json:"currency"`
	Dividends    float64 `json:"dividends"`
	Owner        string  `json:"owner"`
	Note         string  `json:"note"`
	PurchasedAt  string  `json:"purchasedAt"`
	CreatedAt    string  `json:"createdAt"`
	UpdatedAt    string  `json:"updatedAt"`
}
