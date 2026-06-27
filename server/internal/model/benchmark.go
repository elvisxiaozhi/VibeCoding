package model

// BenchmarkPrice 单条基准指数日线收盘价（指数原币计价）
type BenchmarkPrice struct {
	Date  string  `json:"date"`
	Close float64 `json:"close"`
}

// BenchmarkSeries 单个基准指数的完整日线序列
type BenchmarkSeries struct {
	Symbol string           `json:"symbol"`
	Prices []BenchmarkPrice `json:"prices"`
}
