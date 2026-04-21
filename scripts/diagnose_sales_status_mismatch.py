import re
import sqlite3

import pandas as pd


xlsx = r"D:\02工作\ERP\shangxian_data\商品价格表.xlsx"
db_path = r"D:\02工作\ERP\newjade\prisma\dev.db"


def nn(x):
    s = x.astype(str).str.strip()
    return x.notna() & (s != "") & (s.str.lower() != "nan")


def num(v):
    if v is None:
        return None
    s = str(v).strip().replace("¥", "").replace(",", "").replace("，", "")
    if not s or s.lower() == "nan":
        return None
    try:
        return float(s)
    except Exception:
        return None


def main():
    df = pd.read_excel(xlsx, sheet_name="销售统计表")
    valid = nn(df["销售单关联"]) & nn(df["销售日期"]) & nn(df["销售数量"]) & nn(df["成交价"])

    source_expanded = []
    for _, r in df[valid].iterrows():
        inv = str(r["销售单关联"]).strip()
        qty = int(round(num(r["销售数量"]) or 0))
        for _ in range(max(qty, 0)):
            source_expanded.append(inv)

    source_need = {}
    for inv in source_expanded:
        source_need[inv] = source_need.get(inv, 0) + 1

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute(
        """
        SELECT s.id, i.status, i.notes, i.sku_code
        FROM sale_records s
        JOIN items i ON i.id = s.item_id
        """
    )
    sales_rows = cur.fetchall()
    sales_linked_instock = 0
    sales_count_by_mk = {}
    for _sid, status, notes, sku in sales_rows:
        m = re.search(r"\[MK:([^\]]+)\]", notes or "")
        inv = (m.group(1).strip() if m else (sku or "").strip())
        sales_count_by_mk[inv] = sales_count_by_mk.get(inv, 0) + 1
        if (status or "").lower() == "in_stock":
            sales_linked_instock += 1

    cur.execute("SELECT status, notes, sku_code FROM items WHERE is_deleted=0")
    sold_by_mk = {}
    all_by_mk = {}
    for status, notes, sku in cur.fetchall():
        m = re.search(r"\[MK:([^\]]+)\]", notes or "")
        inv = (m.group(1).strip() if m else (sku or "").strip())
        all_by_mk[inv] = all_by_mk.get(inv, 0) + 1
        if (status or "").lower() == "sold":
            sold_by_mk[inv] = sold_by_mk.get(inv, 0) + 1

    mismatch = []
    for inv, need in sorted(source_need.items()):
        sold = sold_by_mk.get(inv, 0)
        sales = sales_count_by_mk.get(inv, 0)
        if sold != need or sales != need:
            mismatch.append((inv, need, sold, sales, all_by_mk.get(inv, 0)))

    print("sales_total", len(sales_rows))
    print("sales_linked_instock", sales_linked_instock)
    print("source_qty_total", len(source_expanded))
    print("mk_mismatch_count", len(mismatch))
    print("top20")
    for t in mismatch[:20]:
        print(t)

    conn.close()


if __name__ == "__main__":
    main()

