package model

// FXRate 单条历史汇率记录，rate 表示 1 单位 currency 等于多少 CNY
type FXRate struct {
	Currency string  `json:"currency"`
	Date     string  `json:"date"`
	Rate     float64 `json:"rate"`
}
