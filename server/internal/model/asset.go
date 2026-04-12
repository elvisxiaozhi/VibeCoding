package model

// AssetCategory 资产分类，与前端 src/lib/types.ts 手动保持一致
type AssetCategory = string

const (
	CategoryStock  AssetCategory = "stock"
	CategoryETF    AssetCategory = "etf"
	CategoryCrypto AssetCategory = "crypto"
	CategoryCash   AssetCategory = "cash"
)

// Asset 单条资产记录，JSON tag 与前端 Asset interface 一一对应
type Asset struct {
	ID           string  `json:"id"`
	UserID       string  `json:"-"`
	Symbol       string  `json:"symbol"`
	Category     string  `json:"category"`
	CostBasis    float64 `json:"costBasis"`
	CurrentPrice float64 `json:"currentPrice"`
	Quantity     float64 `json:"quantity"`
	Currency     string  `json:"currency"`
	CreatedAt    string  `json:"createdAt"`
	UpdatedAt    string  `json:"updatedAt"`
}
