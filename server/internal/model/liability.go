package model

type LiabilityCategory = string

const (
	LiabilityMortgage   LiabilityCategory = "mortgage"
	LiabilityCreditCard LiabilityCategory = "credit_card"
	LiabilityLoan       LiabilityCategory = "loan"
	LiabilityOther      LiabilityCategory = "other"
)

// Liability 当前负债余额。还款流水后续用独立表扩展，不混入资产历史。
type Liability struct {
	ID           string  `json:"id"`
	UserID       string  `json:"-"`
	Name         string  `json:"name"`
	Category     string  `json:"category"`
	Principal    float64 `json:"principal"`
	Currency     string  `json:"currency"`
	InterestRate float64 `json:"interestRate"`
	DueDate      string  `json:"dueDate"`
	Owner        string  `json:"owner"`
	Note         string  `json:"note"`
	CreatedAt    string  `json:"createdAt"`
	UpdatedAt    string  `json:"updatedAt"`
}
