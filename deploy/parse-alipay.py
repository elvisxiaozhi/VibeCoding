#!/usr/bin/env python3
"""解析支付宝交易流水 CSV，提取蚂蚁财富基金交易记录，获取历史净值，输出 seed JSON"""

import csv
import json
import os
import sys
import time
import urllib.request
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta

# 目标基金代码映射
FUND_CODES = {
    '富国天惠成长混合(LOF)A': '161005',
    '大成中证红利指数A': '090010',
    '中欧时代先锋股票A': '001938',
    '广发聚源债券(LOF)A': '162716',
    '鹏华丰禄债券': '000345',
    '国金惠安利率债债券A': '006580',
}

# 基金分类
FUND_CATEGORIES = {
    '富国天惠成长混合(LOF)A': 'stock',
    '大成中证红利指数A': 'etf',
    '中欧时代先锋股票A': 'stock',
    '广发聚源债券(LOF)A': 'etf',
    '鹏华丰禄债券': 'etf',
    '国金惠安利率债债券A': 'etf',
}

# 搜索关键字
FUND_KEYWORDS = {
    '富国天惠': '富国天惠成长混合(LOF)A',
    '大成中证红利': '大成中证红利指数A',
    '中欧时代先锋': '中欧时代先锋股票A',
    '广发聚源': '广发聚源债券(LOF)A',
    '鹏华丰禄': '鹏华丰禄债券',
    '国金惠安': '国金惠安利率债债券A',
}


@dataclass
class Transaction:
    fund: str
    date: str       # YYYY-MM-DD
    amount: float   # 金额（元）
    tx_type: str    # 'buy', 'sell', 'dividend'


def read_all_records(directory: str) -> list[list[str]]:
    """读取目录下所有 CSV，去重合并"""
    all_records = []
    seen = set()
    files = sorted(f for f in os.listdir(directory) if f.endswith('.csv'))

    for fname in files:
        path = os.path.join(directory, fname)
        with open(path, 'r', encoding='gbk') as f:
            for i, line in enumerate(f):
                if i < 5:
                    continue
                row = [c.strip() for c in line.split(',')]
                if len(row) < 16:
                    continue
                txid = row[0]
                if txid in seen:
                    continue
                seen.add(txid)
                all_records.append(row)

    return all_records


def extract_fund_transactions(records: list[list[str]]) -> list[Transaction]:
    """从支付宝记录中提取目标基金交易"""
    transactions = []

    for r in records:
        name = r[8]
        if '蚂蚁财富' not in r[7] and '蚂蚁财富' not in name:
            continue
        if '退款' in name:
            continue

        amount = float(r[9])
        date = r[2][:10]

        # 匹配基金
        matched_fund = None
        for keyword, fund_name in FUND_KEYWORDS.items():
            if keyword in name:
                matched_fund = fund_name
                break

        if not matched_fund:
            continue

        if '买入' in name or '申购' in name:
            transactions.append(Transaction(fund=matched_fund, date=date, amount=amount, tx_type='buy'))
        elif '卖出' in name:
            transactions.append(Transaction(fund=matched_fund, date=date, amount=amount, tx_type='sell'))
        elif '分红' in name:
            transactions.append(Transaction(fund=matched_fund, date=date, amount=amount, tx_type='dividend'))

    transactions.sort(key=lambda t: (t.fund, t.date))
    return transactions


def fetch_nav_history(code: str, start_date: str, end_date: str) -> dict[str, float]:
    """从天天基金获取历史净值"""
    all_navs = {}
    page = 1
    while True:
        url = (
            f'https://api.fund.eastmoney.com/f10/lsjz?callback=jQuery'
            f'&fundCode={code}&pageIndex={page}&pageSize=20'
            f'&startDate={start_date}&endDate={end_date}'
        )
        headers = {'Referer': 'https://fundf10.eastmoney.com/'}
        req = urllib.request.Request(url, headers=headers)
        resp = urllib.request.urlopen(req, timeout=15)
        data = resp.read().decode('utf-8')
        json_str = data[data.index('(') + 1: data.rindex(')')]
        result = json.loads(json_str)

        for item in result['Data']['LSJZList']:
            all_navs[item['FSRQ']] = float(item['DWJZ'])

        total = result['TotalCount']
        if page * 20 >= total:
            break
        page += 1
        time.sleep(0.15)

    return all_navs


def find_nav(navs: dict[str, float], date_str: str) -> float | None:
    """找到最近的净值（先往后找再往前找）"""
    dt = datetime.strptime(date_str, '%Y-%m-%d')
    for offset in range(0, 7):
        check = (dt + timedelta(days=offset)).strftime('%Y-%m-%d')
        if check in navs:
            return navs[check]
    for offset in range(1, 7):
        check = (dt - timedelta(days=offset)).strftime('%Y-%m-%d')
        if check in navs:
            return navs[check]
    return None


def main():
    directory = 'deploy/alipay'

    # 1. 读取所有支付宝记录
    print('读取支付宝 CSV...', file=sys.stderr)
    records = read_all_records(directory)
    print(f'  总记录: {len(records)} 条', file=sys.stderr)

    # 2. 提取目标基金交易
    transactions = extract_fund_transactions(records)
    print(f'  目标基金交易: {len(transactions)} 条', file=sys.stderr)

    # 按基金分组统计
    by_fund = defaultdict(list)
    for t in transactions:
        by_fund[t.fund].append(t)

    for fund, txs in sorted(by_fund.items()):
        buys = [t for t in txs if t.tx_type == 'buy']
        sells = [t for t in txs if t.tx_type == 'sell']
        divs = [t for t in txs if t.tx_type == 'dividend']
        print(f'  {fund}: {len(buys)}买 {len(sells)}卖 {len(divs)}分红', file=sys.stderr)

    # 3. 获取历史净值
    print('\n获取历史净值...', file=sys.stderr)
    nav_cache: dict[str, dict[str, float]] = {}

    for fund_name, code in FUND_CODES.items():
        fund_txs = by_fund.get(fund_name, [])
        if not fund_txs:
            continue

        # 确定日期范围
        dates = [t.date for t in fund_txs]
        min_date = min(dates)
        max_date = '2026-04-21'  # 获取到最新

        print(f'  {fund_name} ({code}): {min_date} ~ {max_date}...', file=sys.stderr, end=' ')

        navs = fetch_nav_history(code, min_date, max_date)
        nav_cache[fund_name] = navs
        print(f'{len(navs)} 天净值', file=sys.stderr)
        time.sleep(0.5)

    # 4. 匹配净值，计算份额
    print('\n匹配净值计算份额...', file=sys.stderr)
    result = []

    for fund_name in sorted(FUND_CODES.keys()):
        fund_txs = by_fund.get(fund_name, [])
        if not fund_txs:
            continue

        navs = nav_cache.get(fund_name, {})
        # 最新净值
        latest_date = max(navs.keys()) if navs else None
        current_nav = navs[latest_date] if latest_date else 0
        cat = FUND_CATEGORIES.get(fund_name, 'etf')

        total_shares_bought = 0
        total_shares_sold = 0
        unmatched = 0

        for t in fund_txs:
            if t.tx_type == 'dividend':
                # 分红记录：quantity=0, dividends=金额
                result.append({
                    'symbol': fund_name,
                    'category': cat,
                    'market': 'cn',
                    'costBasis': 0,
                    'currentPrice': 0,
                    'quantity': 0,
                    'currency': 'CNY',
                    'dividends': round(t.amount, 2),
                    'purchasedAt': t.date,
                })
                continue

            nav = find_nav(navs, t.date)
            if nav is None or nav == 0:
                unmatched += 1
                print(f'  ⚠️ {fund_name} {t.date} 无净值数据', file=sys.stderr)
                continue

            shares = round(t.amount / nav, 2)

            if t.tx_type == 'buy':
                total_shares_bought += shares
                result.append({
                    'symbol': fund_name,
                    'category': cat,
                    'market': 'cn',
                    'costBasis': round(nav, 4),
                    'currentPrice': round(current_nav, 4),
                    'quantity': shares,
                    'currency': 'CNY',
                    'dividends': 0,
                    'purchasedAt': t.date,
                })
            elif t.tx_type == 'sell':
                total_shares_sold += shares
                result.append({
                    'symbol': fund_name,
                    'category': cat,
                    'market': 'cn',
                    'costBasis': round(nav, 4),
                    'currentPrice': round(nav, 4),  # 卖出价=确认净值
                    'quantity': -shares,  # 负数表示卖出
                    'currency': 'CNY',
                    'dividends': 0,
                    'purchasedAt': t.date,
                })

        current_shares = round(total_shares_bought - total_shares_sold, 2)
        current_value = round(current_shares * current_nav, 2)
        print(f'  {fund_name}: 买入{total_shares_bought:.2f}份 - 卖出{total_shares_sold:.2f}份 = 持仓{current_shares:.2f}份, 市值¥{current_value:.2f} (NAV={current_nav}, {latest_date})', file=sys.stderr)
        if unmatched:
            print(f'    ⚠️ {unmatched} 笔无法匹配净值', file=sys.stderr)

    # 按 symbol + 日期排序
    result.sort(key=lambda x: (x['symbol'], x['purchasedAt']))

    print(f'\n总记录数: {len(result)}', file=sys.stderr)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
