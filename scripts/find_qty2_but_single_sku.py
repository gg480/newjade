import csv
import re
import sqlite3
from collections import defaultdict


CSV_PATH = r"C:\Users\1\Desktop\初始化\货品导入模板4.csv"
DB_PATH = r"D:\02工作\ERP\newjade\prisma\dev.db"
OUT_PATH = r"D:\02工作\ERP\shangxian_data\qty2_single_sku_mismatch.csv"


def to_float(v):
    if v is None:
        return 0.0
    s = str(v).strip().replace("¥", "").replace(",", "").replace("，", "")
    if not s:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def extract_mk(notes):
    if not notes:
        return None
    m = re.search(r"\[MK:([^\]]+)\]", str(notes))
    return m.group(1).strip() if m else None


def main():
    # 1) 源数据按匹配码汇总销售数量
    src_qty = defaultdict(float)
    with open(CSV_PATH, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            mk = (row.get("匹配码") or row.get("matchKey") or row.get("关联码") or "").strip()
            qty = to_float(row.get("销售数量") or row.get("quantity") or row.get("qty"))
            if mk:
                src_qty[mk] += qty

    # 2) 系统按匹配码统计子SKU数量
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT sku_code, notes FROM items WHERE is_deleted=0")
    mk_to_skus = defaultdict(set)
    for sku, notes in cur.fetchall():
        mk = extract_mk(notes)
        if mk:
            mk_to_skus[mk].add(sku)
    conn.close()

    # 3) 条件筛选：源数量>=2，系统sku_count==1
    rows = []
    for mk, qty in src_qty.items():
        sku_count = len(mk_to_skus.get(mk, set()))
        if qty >= 2 and sku_count == 1:
            rows.append(
                {
                    "match_code": mk,
                    "source_sales_qty": qty,
                    "system_sku_count": sku_count,
                    "system_skus": "|".join(sorted(mk_to_skus.get(mk, set()))),
                }
            )

    rows.sort(key=lambda x: (-x["source_sales_qty"], x["match_code"]))

    # 4) 输出文件
    with open(OUT_PATH, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["match_code", "source_sales_qty", "system_sku_count", "system_skus"],
        )
        w.writeheader()
        w.writerows(rows)

    print(f"matched_rows={len(rows)}")
    for r in rows[:30]:
        print(f"{r['match_code']}\tqty={r['source_sales_qty']}\tsku_count={r['system_sku_count']}\t{r['system_skus']}")
    print(f"output={OUT_PATH}")


if __name__ == "__main__":
    main()

