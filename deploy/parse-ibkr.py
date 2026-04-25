#!/usr/bin/env python3
"""解析 IBKR Activity Statement CSV，提取交易记录，FIFO 匹配卖出，输出剩余持仓 + 卖出记录 JSON"""

import csv
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass

# ETF 标的列表
ETFS = {'BOXX', 'QQQM', 'SPYM', 'SPLG', 'TLT', 'VTWO', 'SGOV'}

# 标的描述映射
DESCRIPTIONS = {
    'AAPL': 'Apple',
    'BOXX': 'Alpha Architect 1-3M Box',
    'BRK B': 'Berkshire Hathaway B',
    'META': 'Meta Platforms',
    'MSFT': 'Microsoft',
    'NVDA': 'Nvidia',
    'OXY': 'Occidental Petroleum',
    'QQQM': 'Invesco Nasdaq 100 ETF',
    'SPYM': 'SPDR Portfolio S&P 500 ETF',
    'SPLG': 'SPDR Portfolio S&P 500 ETF',
    'TLT': 'iShares 20+ Year Treasury',
    'TSLA': 'Tesla',
    'UNH': 'UnitedHealth',
    'VTWO': 'Vanguard Russell 2000 ETF',
    'RUM': 'Rumble',
    'SGOV': 'iShares 0-3M Treasury Bond',
}

# SPLG → SPYM 的 ticker 重命名
TICKER_RENAME = {'SPLG': 'SPYM'}


@dataclass
class Trade:
    symbol: str
    date: str       # YYYY-MM-DD
    datetime: str   # full datetime for dedup
    quantity: float  # positive=buy, negative=sell
    price: float
    code: str


@dataclass
class Lot:
    symbol: str
    date: str
    price: float
    quantity: float


@dataclass
class SellRecord:
    symbol: str
    date: str        # sell date
    sell_price: float
    cost_basis: float  # FIFO cost basis of the sold shares
    quantity: float    # positive number (will be negated in output)


@dataclass
class DividendRecord:
    symbol: str
    date: str        # dividend payment date
    amount: float    # dividend amount


def parse_trades_from_csv(filepath: str) -> list[Trade]:
    """从 IBKR CSV 中提取 Stocks 交易"""
    trades = []
    with open(filepath, 'r') as f:
        for line in f:
            if not line.startswith('Trades,Data,Order,Stocks,'):
                continue
            row = list(csv.reader([line]))[0]
            if len(row) < 16:
                continue
            symbol = row[5]
            dt_str = row[6].strip().strip('"')
            date = dt_str.split(',')[0]
            quantity = float(row[7])
            price = float(row[8])
            code = row[15].strip()

            trades.append(Trade(
                symbol=symbol,
                date=date,
                datetime=dt_str,
                quantity=quantity,
                price=price,
                code=code,
            ))
    return trades


def deduplicate_trades(trades: list[Trade]) -> list[Trade]:
    """去重：相同 symbol + datetime + quantity + price 视为重复"""
    seen = set()
    result = []
    for t in trades:
        key = (t.symbol, t.datetime, t.quantity, t.price)
        if key in seen:
            continue
        seen.add(key)
        result.append(t)
    return result


def process_fifo(trades: list[Trade]) -> tuple[list[Lot], list[SellRecord]]:
    """按标的分组，FIFO 处理卖出，返回 (剩余持仓 lots, 卖出记录)"""
    by_symbol: dict[str, list[Trade]] = defaultdict(list)
    for t in trades:
        sym = TICKER_RENAME.get(t.symbol, t.symbol)
        t.symbol = sym
        by_symbol[sym].append(t)

    all_lots = []
    all_sells = []

    for symbol, sym_trades in sorted(by_symbol.items()):
        sym_trades.sort(key=lambda t: t.datetime)

        lots: list[Lot] = []

        for t in sym_trades:
            if t.quantity > 0:
                # 买入 → 新增 lot
                lots.append(Lot(symbol=symbol, date=t.date, price=t.price, quantity=t.quantity))
            elif t.quantity < 0:
                # 卖出 → FIFO 消耗 lots，生成 sell records
                to_sell = abs(t.quantity)
                while to_sell > 0 and lots:
                    lot = lots[0]
                    sold_qty = min(lot.quantity, to_sell)
                    all_sells.append(SellRecord(
                        symbol=symbol,
                        date=t.date,
                        sell_price=t.price,
                        cost_basis=lot.price,
                        quantity=sold_qty,
                    ))
                    lot.quantity -= sold_qty
                    to_sell -= sold_qty
                    if lot.quantity <= 0:
                        lots.pop(0)

        all_lots.extend(lots)

    return all_lots, all_sells


def to_json(lots: list[Lot], sells: list[SellRecord], close_prices: dict[str, float], div_records: list[DividendRecord]) -> list[dict]:
    """将 lots + sells + dividends 转为 seed-real.json 格式"""
    result = []

    # 买入持仓（正数 quantity）
    for lot in lots:
        desc = DESCRIPTIONS.get(lot.symbol, lot.symbol)
        cat = 'etf' if lot.symbol in ETFS else 'stock'
        current_price = close_prices.get(lot.symbol, lot.price)

        result.append({
            'symbol': f'{lot.symbol} {desc}',
            'category': cat,
            'market': 'us',
            'costBasis': round(lot.price, 6),
            'currentPrice': round(current_price, 2),
            'quantity': lot.quantity,
            'currency': 'USD',
            'dividends': 0,
            'purchasedAt': lot.date,
        })

    # 卖出记录（负数 quantity）
    for sell in sells:
        desc = DESCRIPTIONS.get(sell.symbol, sell.symbol)
        cat = 'etf' if sell.symbol in ETFS else 'stock'

        result.append({
            'symbol': f'{sell.symbol} {desc}',
            'category': cat,
            'market': 'us',
            'costBasis': round(sell.cost_basis, 6),
            'currentPrice': round(sell.sell_price, 6),
            'quantity': -sell.quantity,  # 负数表示卖出
            'currency': 'USD',
            'dividends': 0,
            'purchasedAt': sell.date,
        })

    # 分红记录（quantity=0，dividends=金额）
    for div in div_records:
        desc = DESCRIPTIONS.get(div.symbol, div.symbol)
        cat = 'etf' if div.symbol in ETFS else 'stock'

        result.append({
            'symbol': f'{div.symbol} {desc}',
            'category': cat,
            'market': 'us',
            'costBasis': 0,
            'currentPrice': 0,
            'quantity': 0,
            'currency': 'USD',
            'dividends': round(div.amount, 2),
            'purchasedAt': div.date,
        })

    # 按 symbol 再按日期排序
    result.sort(key=lambda x: (x['symbol'], x['purchasedAt']))

    return result


_DIV_SUFFIX_RE = re.compile(r'\s*\([^()]*\)\s*$')  # 末尾 " (Ordinary Dividend)" 之类
_WHT_SUFFIX = ' - US Tax'


def _normalize_div_desc(desc: str) -> str:
    return _DIV_SUFFIX_RE.sub('', desc).strip()


def _normalize_wht_desc(desc: str) -> str:
    if desc.endswith(_WHT_SUFFIX):
        return desc[:-len(_WHT_SUFFIX)].strip()
    return desc.strip()


def parse_dividends(filepaths: list[str]) -> list[DividendRecord]:
    """从所有 CSV 中提取每笔分红毛额，扣预扣税、加退税，得到净分红"""
    # 1. 收集分红毛额：(date, normalized_desc) → (sym, gross)
    gross: dict[tuple, tuple[str, float]] = {}
    for filepath in filepaths:
        with open(filepath, 'r') as f:
            for line in f:
                if not line.startswith('Dividends,Data,'):
                    continue
                row = list(csv.reader([line]))[0]
                if len(row) < 6 or row[2] == 'Total':
                    continue
                date, desc, amount = row[3], row[4], float(row[5])
                sym_raw = desc.split('(')[0].strip()
                if not sym_raw:
                    continue
                norm = _normalize_div_desc(desc)
                key = (date, norm)
                if key in gross:
                    continue  # 跨文件去重
                sym = TICKER_RENAME.get(sym_raw, sym_raw)
                gross[key] = (sym, amount)

    # 2. 收集税务调整：每个文件单独，跨文件按 (date, desc, amount) 取最大计数（避免重叠期重复）
    file_tax: list[list[tuple]] = []
    for filepath in filepaths:
        rows: list[tuple] = []
        with open(filepath, 'r') as f:
            for line in f:
                if not line.startswith('Withholding Tax,Data,'):
                    continue
                row = list(csv.reader([line]))[0]
                if len(row) < 6 or row[2] == 'Total':
                    continue
                date, desc_tax, amount = row[3], row[4], float(row[5])
                rows.append((date, desc_tax, amount))
        file_tax.append(rows)

    occ_max: dict[tuple, int] = defaultdict(int)
    for rows in file_tax:
        local: dict[tuple, int] = defaultdict(int)
        for r in rows:
            local[r] += 1
        for k, n in local.items():
            occ_max[k] = max(occ_max[k], n)

    tax_adj: dict[tuple, float] = defaultdict(float)
    for (date, desc_tax, amount), n in occ_max.items():
        norm = _normalize_wht_desc(desc_tax)
        tax_adj[(date, norm)] += amount * n

    # 3. 合并：净分红 = 毛额 + 税务调整（负扣正退，全退则 net = gross）
    records: list[DividendRecord] = []
    for (date, desc), (sym, gross_amt) in gross.items():
        net = gross_amt + tax_adj.get((date, desc), 0.0)
        if abs(net) < 0.01:
            continue  # 极少数 net=0 跳过
        records.append(DividendRecord(symbol=sym, date=date, amount=net))

    return records


def parse_close_prices(filepath: str) -> dict[str, float]:
    """从 Open Positions 提取最新收盘价"""
    prices = {}
    with open(filepath, 'r') as f:
        for line in f:
            if not line.startswith('Open Positions,Data,Summary,Stocks,'):
                continue
            row = list(csv.reader([line]))[0]
            symbol = TICKER_RENAME.get(row[5], row[5])
            close_price = float(row[10])
            prices[symbol] = close_price
    return prices


def parse_cash_balances(filepath: str) -> list[dict]:
    """从 Cash Report 提取各币种 Ending Cash 余额"""
    balances = []
    with open(filepath, 'r') as f:
        for line in f:
            if not line.startswith('Cash Report,Data,Ending Cash,'):
                continue
            row = list(csv.reader([line]))[0]
            currency = row[3]
            # 跳过 Base Currency Summary（是汇总，不是实际币种）
            if 'Summary' in currency:
                continue
            amount = float(row[4])
            if abs(amount) < 0.01:
                continue
            balances.append({
                'symbol': f'{currency} Cash',
                'category': 'cash',
                'market': 'us',
                'costBasis': 1,
                'currentPrice': 1,
                'quantity': round(amount, 2),
                'currency': currency,
                'purchasedAt': '',  # 后端会用当前时间填充
            })
    return balances


def main():
    files = [
        'deploy/IBKR/U15119982_20241003_20251003.csv',
        'deploy/IBKR/U15119982_20250901_20260417.csv',
        'deploy/IBKR/U15119982_20260101_20260423.csv',
    ]

    # 解析所有交易
    all_trades = []
    for f in files:
        trades = parse_trades_from_csv(f)
        all_trades.extend(trades)
        print(f'  {f}: {len(trades)} trades', file=sys.stderr)

    # 去重
    all_trades = deduplicate_trades(all_trades)
    print(f'  去重后: {len(all_trades)} trades', file=sys.stderr)

    buys = [t for t in all_trades if t.quantity > 0]
    sells = [t for t in all_trades if t.quantity < 0]
    print(f'  买入: {len(buys)}, 卖出: {len(sells)}', file=sys.stderr)

    # FIFO 处理
    lots, sell_records = process_fifo(all_trades)
    print(f'  剩余 lots: {len(lots)}, 卖出记录: {len(sell_records)}', file=sys.stderr)

    # 规则 3：最终持仓为 0 的 symbol，整体不导入（含分红、卖出记录）
    held_symbols = {lot.symbol for lot in lots if lot.quantity > 0}
    cleared_symbols = {s.symbol for s in sell_records} - held_symbols
    if cleared_symbols:
        before = len(sell_records)
        sell_records = [s for s in sell_records if s.symbol in held_symbols]
        print(f'  规则 3 排除清仓 symbol {sorted(cleared_symbols)}：卖出记录 {before} → {len(sell_records)}', file=sys.stderr)

    # 按标的汇总数量
    qty_by_sym: dict[str, float] = defaultdict(float)
    for lot in lots:
        qty_by_sym[lot.symbol] += lot.quantity
    print(f'\n  持仓汇总:', file=sys.stderr)
    for sym, qty in sorted(qty_by_sym.items()):
        print(f'    {sym}: {qty}', file=sys.stderr)

    sold_by_sym: dict[str, float] = defaultdict(float)
    for s in sell_records:
        sold_by_sym[s.symbol] += s.quantity
    if sold_by_sym:
        print(f'\n  卖出汇总:', file=sys.stderr)
        for sym, qty in sorted(sold_by_sym.items()):
            print(f'    {sym}: {qty}', file=sys.stderr)

    # 获取最新收盘价
    close_prices = parse_close_prices(files[-1])

    # 解析分红记录（逐笔，含税务调整）
    div_records = parse_dividends(files)
    # 规则 3 同样排除清仓 symbol 的分红
    div_records = [d for d in div_records if d.symbol in held_symbols]
    if div_records:
        div_by_sym: dict[str, float] = defaultdict(float)
        for d in div_records:
            div_by_sym[d.symbol] += d.amount
        total_div = sum(div_by_sym.values())
        print(f'\n  分红汇总 ({len(div_records)} 笔, ${total_div:.2f}):', file=sys.stderr)
        for sym, div in sorted(div_by_sym.items()):
            print(f'    {sym}: ${div:.2f}', file=sys.stderr)

    # 解析现金余额
    cash_balances = parse_cash_balances(files[-1])
    if cash_balances:
        print(f'\n  现金余额:', file=sys.stderr)
        for cb in cash_balances:
            print(f'    {cb["currency"]}: {cb["quantity"]}', file=sys.stderr)

    # 生成 JSON
    result = to_json(lots, sell_records, close_prices, div_records)
    result.extend(cash_balances)
    print(f'\n  总记录数: {len(result)} (持仓 {len(lots)} + 卖出 {len(sell_records)} + 分红 {len(div_records)} + 现金 {len(cash_balances)})', file=sys.stderr)

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
