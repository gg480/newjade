import json
import re
import sqlite3
from collections import defaultdict
from datetime import datetime

import pandas as pd


XLSX_PATH = r"D:\02工作\ERP\shangxian_data\商品价格表.xlsx"
DB_PATH = r"D:\02工作\ERP\newjade\prisma\dev.db"
NOTE_MARKER = "补录：按名称+售价+成交价去重补齐"
TARGET_TOTAL = 110


def clean_str(v):
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.lower() == "nan":
        return None
    return s


def parse_num(v):
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.lower() == "nan":
        return None
    s = s.replace("¥", "").replace(",", "").replace("，", "")
    try:
        return float(s)
    except ValueError:
        return None


def parse_date(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        try:
            return pd.to_datetime(v, unit="D", origin="1899-12-30").strftime("%Y-%m-%d")
        except Exception:
            pass
    s = str(v).strip()
    if not s or s.lower() == "nan":
        return None
    if re.match(r"^\d+(\.\d+)?$", s):
        try:
            return pd.to_datetime(float(s), unit="D", origin="1899-12-30").strftime("%Y-%m-%d")
        except Exception:
            pass
    m = re.match(r"^(\d{4})年(\d{1,2})月(\d{1,2})日$", s)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def extract_mk(notes):
    if not notes:
        return None
    m = re.search(r"\[MK:([^\]]+)\]", str(notes))
    return m.group(1).strip() if m else None


def get_next_sale_no(cur, sale_date):
    ds = sale_date.replace("-", "")
    prefix = f"S-{ds}-"
    cur.execute(
        "SELECT sale_no FROM sale_records WHERE sale_no LIKE ? ORDER BY sale_no DESC LIMIT 1",
        (f"{prefix}%",),
    )
    row = cur.fetchone()
    seq = 1
    if row and row[0]:
        try:
            seq = int(str(row[0]).split("-")[-1]) + 1
        except Exception:
            seq = 1
    return f"{prefix}{str(seq).zfill(3)}"


def main():
    df = pd.read_excel(XLSX_PATH, sheet_name="销售统计表")

    src_rows = []
    for _, r in df.iterrows():
        name = clean_str(r.get("商品名称"))
        inv_id = clean_str(r.get("销售单关联"))
        sale_date = parse_date(r.get("销售日期"))
        qty_raw = parse_num(r.get("销售数量"))
        retail = parse_num(r.get("零售价"))
        actual = parse_num(r.get("成交价"))
        if not name or not inv_id or not sale_date or qty_raw is None or retail is None or actual is None:
            continue
        qty = int(round(qty_raw))
        if qty <= 0:
            continue
        src_rows.append(
            {
                "name": name,
                "inventory_id": inv_id,
                "sale_date": sale_date,
                "qty": qty,
                "retail": float(retail),
                "actual": float(actual),
            }
        )

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # rollback previous auto backfill by marker
    cur.execute("DELETE FROM sale_records WHERE note = ?", (NOTE_MARKER,))
    rolled_back = cur.rowcount if cur.rowcount is not None else 0
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM sale_records")
    current_total = int(cur.fetchone()[0])
    need_to_insert = max(0, TARGET_TOTAL - current_total)

    # preload items and existing sales
    cur.execute("SELECT id, sku_code, name, selling_price, notes FROM items WHERE is_deleted = 0")
    items = cur.fetchall()
    items_by_inv = defaultdict(list)
    for iid, sku, nm, sp, notes in items:
        inv = extract_mk(notes) or sku
        items_by_inv[inv].append({"item_id": iid, "name": nm or "", "selling_price": float(sp)})

    # existing count by row key: inv + date + name + retail + actual
    cur.execute(
        """
        SELECT s.sale_date, s.actual_price, i.name, i.selling_price, i.notes, i.sku_code
        FROM sale_records s
        JOIN items i ON i.id = s.item_id
        """
    )
    existing_count = defaultdict(int)
    for sale_date, actual, nm, retail, notes, sku in cur.fetchall():
        inv = extract_mk(notes) or sku
        key = (inv or "", sale_date or "", nm or "", float(retail), float(actual))
        existing_count[key] += 1

    candidates = []
    for r in src_rows:
        key = (r["inventory_id"], r["sale_date"], r["name"], r["retail"], r["actual"])
        have = existing_count.get(key, 0)
        miss = max(0, r["qty"] - have)
        if miss <= 0:
            continue

        # pick item by inventory + name + retail
        pick_item_id = None
        for it in items_by_inv.get(r["inventory_id"], []):
            if it["name"] == r["name"] and abs(it["selling_price"] - r["retail"]) < 1e-8:
                pick_item_id = it["item_id"]
                break
        if pick_item_id is None and items_by_inv.get(r["inventory_id"]):
            pick_item_id = items_by_inv[r["inventory_id"]][0]["item_id"]
        if pick_item_id is None:
            continue

        for _ in range(miss):
            candidates.append(
                {
                    "item_id": pick_item_id,
                    "sale_date": r["sale_date"],
                    "actual": r["actual"],
                }
            )

    to_insert = candidates[:need_to_insert]
    inserted = 0
    for rec in to_insert:
        sale_no = get_next_sale_no(cur, rec["sale_date"])
        cur.execute(
            """
            INSERT INTO sale_records (sale_no, item_id, actual_price, channel, sale_date, customer_id, bundle_id, note, created_at)
            VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, CURRENT_TIMESTAMP)
            """,
            (sale_no, rec["item_id"], rec["actual"], "store", rec["sale_date"], NOTE_MARKER),
        )
        cur.execute("UPDATE items SET status='sold' WHERE id=?", (rec["item_id"],))
        inserted += 1

    conn.commit()
    cur.execute("SELECT COUNT(*) FROM sale_records")
    final_total = int(cur.fetchone()[0])
    conn.close()

    print(
        json.dumps(
            {
                "source_rows_valid": len(src_rows),
                "rolled_back": rolled_back,
                "before_total": current_total,
                "target_total": TARGET_TOTAL,
                "need_to_insert": need_to_insert,
                "candidate_missing": len(candidates),
                "inserted": inserted,
                "final_total": final_total,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

