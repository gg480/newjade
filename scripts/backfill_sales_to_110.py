import json
import re
import sqlite3
from collections import defaultdict
from datetime import datetime

import pandas as pd


XLSX_PATH = r"D:\02工作\ERP\shangxian_data\商品价格表.xlsx"
DB_PATH = r"D:\02工作\ERP\newjade\prisma\dev.db"


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


def key3(name, retail, actual):
    return (name or "", float(retail), float(actual))


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

    src_entries = []
    for _, r in df.iterrows():
        name = clean_str(r.get("商品名称"))
        inv_id = clean_str(r.get("销售单关联"))
        sale_date = parse_date(r.get("销售日期"))
        qty_raw = parse_num(r.get("销售数量"))
        retail = parse_num(r.get("零售价"))
        actual = parse_num(r.get("成交价"))
        if qty_raw is None or qty_raw <= 0:
            continue
        qty = int(round(qty_raw))
        if not name or not inv_id or not sale_date or retail is None or actual is None:
            continue
        for _i in range(qty):
            src_entries.append(
                {
                    "name": name,
                    "inventory_id": inv_id,
                    "sale_date": sale_date,
                    "retail": retail,
                    "actual": actual,
                }
            )

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Load item data
    cur.execute("SELECT id, sku_code, name, selling_price, notes, status, is_deleted FROM items")
    item_rows = cur.fetchall()
    items_by_inv = defaultdict(list)
    items_by_key = defaultdict(list)
    for iid, sku, name, selling_price, notes, status, is_deleted in item_rows:
        if is_deleted:
            continue
        inv = extract_mk(notes) or sku
        items_by_inv[inv].append((iid, name, float(selling_price), status))
        items_by_key[(name or "", float(selling_price))].append((iid, inv, status))

    # Existing sales aggregated by 3-key
    cur.execute(
        """
        SELECT i.name, i.selling_price, s.actual_price, COUNT(*)
        FROM sale_records s
        JOIN items i ON i.id = s.item_id
        GROUP BY i.name, i.selling_price, s.actual_price
        """
    )
    existing_counts = {key3(n, sp, ap): int(c) for n, sp, ap, c in cur.fetchall()}

    desired_by_key = defaultdict(list)
    for e in src_entries:
        desired_by_key[key3(e["name"], e["retail"], e["actual"])].append(e)

    to_insert = []
    for k, entries in desired_by_key.items():
        have = existing_counts.get(k, 0)
        need = len(entries)
        if need > have:
            to_insert.extend(entries[have:need])

    inserted = 0
    skipped_no_item = 0

    # Insert missing records
    for e in to_insert:
        # Prefer exact inventory_id + name + retail match
        candidates = []
        for iid, nm, sp, st in items_by_inv.get(e["inventory_id"], []):
            if (nm or "") == e["name"] and abs(float(sp) - float(e["retail"])) < 1e-8:
                candidates.append((iid, st))
        if not candidates:
            # fallback by name+retail
            for iid, inv, st in items_by_key.get((e["name"], float(e["retail"])), []):
                candidates.append((iid, st))
        if not candidates:
            skipped_no_item += 1
            continue

        item_id = candidates[0][0]
        sale_no = get_next_sale_no(cur, e["sale_date"])
        cur.execute(
            """
            INSERT INTO sale_records (sale_no, item_id, actual_price, channel, sale_date, customer_id, bundle_id, note, created_at)
            VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, CURRENT_TIMESTAMP)
            """,
            (sale_no, item_id, float(e["actual"]), "store", e["sale_date"], "补录：按名称+售价+成交价去重补齐"),
        )
        cur.execute("UPDATE items SET status='sold' WHERE id=?", (item_id,))
        inserted += 1

    conn.commit()

    cur.execute("SELECT COUNT(*) FROM sale_records")
    total_sales_after = int(cur.fetchone()[0])

    conn.close()

    print(
        json.dumps(
            {
                "source_rows": int(len(df)),
                "source_expanded_qty": int(len(src_entries)),
                "need_insert": int(len(to_insert)),
                "inserted": int(inserted),
                "skipped_no_item": int(skipped_no_item),
                "total_sales_after": int(total_sales_after),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

