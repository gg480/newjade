import csv
import re
import sqlite3
from collections import defaultdict
from difflib import SequenceMatcher

import pandas as pd


SALES_XLSX = r"D:\02工作\ERP\shangxian_data\商品价格表.xlsx"
INV_CSV = r"C:\Users\1\Desktop\初始化\货品导入模板4.csv"
DB_PATH = r"D:\02工作\ERP\newjade\prisma\dev.db"
OUT_CSV = r"D:\02工作\ERP\shangxian_data\sku_pairing_candidates.csv"


def to_float(v):
    if v is None:
        return 0.0
    s = str(v).strip().replace("¥", "").replace(",", "").replace("，", "")
    if not s or s.lower() == "nan":
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


def similarity(a, b):
    a = (a or "").strip()
    b = (b or "").strip()
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def main():
    # source inventory qty by match code
    inv_qty = defaultdict(float)
    with open(INV_CSV, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            mk = (row.get("匹配码") or row.get("matchKey") or row.get("关联码") or "").strip()
            qty = to_float(row.get("数量") or row.get("quantity") or row.get("qty") or row.get("初始库存"))
            if mk:
                inv_qty[mk] += qty

    # source sales qty + name + retail by match code
    df = pd.read_excel(SALES_XLSX, sheet_name="销售统计表")
    sales_qty = defaultdict(float)
    sales_name = {}
    sales_retail = {}
    for _, r in df.iterrows():
        mk = str(r.get("销售单关联") or "").strip()
        if not mk or mk.lower() == "nan":
            continue
        q = to_float(r.get("销售数量"))
        if q <= 0:
            continue
        sales_qty[mk] += q
        nm = str(r.get("商品名称") or "").strip()
        if nm and nm.lower() != "nan":
            sales_name[mk] = nm
        retail = to_float(r.get("零售价"))
        if retail > 0:
            sales_retail[mk] = retail

    # problem match codes: sales qty > inventory qty
    problem_codes = sorted([mk for mk, q in sales_qty.items() if q > inv_qty.get(mk, 0.0)])

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, sku_code, name, selling_price, status, notes FROM items WHERE is_deleted=0")
    items = cur.fetchall()
    conn.close()

    # build current mk usage and candidate pool
    rows = []
    for mk in problem_codes:
        target_name = sales_name.get(mk, "")
        target_price = sales_retail.get(mk, 0.0)
        shortage = sales_qty.get(mk, 0.0) - inv_qty.get(mk, 0.0)

        # current skus under this mk
        current = []
        for iid, sku, name, price, status, notes in items:
            item_mk = extract_mk(notes)
            if item_mk == mk:
                current.append(sku)
        current_skus = "|".join(sorted(current))

        # candidate: same selling price, in_stock first, different mk
        cands = []
        for iid, sku, name, price, status, notes in items:
            item_mk = extract_mk(notes)
            if item_mk == mk:
                continue
            if abs(float(price or 0.0) - float(target_price or 0.0)) > 1e-8:
                continue
            sim = similarity(target_name, name or "")
            if sim <= 0:
                continue
            cands.append(
                {
                    "sku": sku,
                    "item_name": name or "",
                    "status": status or "",
                    "item_match_code": item_mk or "",
                    "sim": sim,
                }
            )
        # sort by in_stock first, then similarity desc
        cands.sort(key=lambda x: (0 if (x["status"] or "").lower() == "in_stock" else 1, -x["sim"], x["sku"]))

        top = cands[:10]
        if not top:
            rows.append(
                {
                    "problem_match_code": mk,
                    "sales_qty": sales_qty.get(mk, 0.0),
                    "inventory_qty": inv_qty.get(mk, 0.0),
                    "shortage_qty": shortage,
                    "source_name": target_name,
                    "source_retail_price": target_price,
                    "current_skus_under_code": current_skus,
                    "candidate_sku": "",
                    "candidate_name": "",
                    "candidate_status": "",
                    "candidate_match_code": "",
                    "name_similarity": "",
                }
            )
        else:
            for c in top:
                rows.append(
                    {
                        "problem_match_code": mk,
                        "sales_qty": sales_qty.get(mk, 0.0),
                        "inventory_qty": inv_qty.get(mk, 0.0),
                        "shortage_qty": shortage,
                        "source_name": target_name,
                        "source_retail_price": target_price,
                        "current_skus_under_code": current_skus,
                        "candidate_sku": c["sku"],
                        "candidate_name": c["item_name"],
                        "candidate_status": c["status"],
                        "candidate_match_code": c["item_match_code"],
                        "name_similarity": round(c["sim"], 4),
                    }
                )

    with open(OUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "problem_match_code",
                "sales_qty",
                "inventory_qty",
                "shortage_qty",
                "source_name",
                "source_retail_price",
                "current_skus_under_code",
                "candidate_sku",
                "candidate_name",
                "candidate_status",
                "candidate_match_code",
                "name_similarity",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"problem_match_codes={len(problem_codes)}")
    print(f"output={OUT_CSV}")
    for mk in problem_codes:
        print(f"- {mk}: sales_qty={sales_qty.get(mk,0.0)}, inv_qty={inv_qty.get(mk,0.0)}")


if __name__ == "__main__":
    main()

