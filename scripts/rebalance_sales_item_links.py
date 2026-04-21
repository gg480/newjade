import json
import re
import sqlite3
from collections import defaultdict

import pandas as pd


XLSX = r"D:\02工作\ERP\shangxian_data\商品价格表.xlsx"
DB = r"D:\02工作\ERP\newjade\prisma\dev.db"


def clean_str(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s and s.lower() != "nan" else None


def parse_num(v):
    if v is None:
        return None
    s = str(v).strip().replace("¥", "").replace(",", "").replace("，", "")
    if not s or s.lower() == "nan":
        return None
    try:
        return float(s)
    except Exception:
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
    return None


def extract_mk(notes):
    if not notes:
        return None
    m = re.search(r"\[MK:([^\]]+)\]", str(notes))
    return m.group(1).strip() if m else None


def load_source_events():
    df = pd.read_excel(XLSX, sheet_name="销售统计表")

    def nn(x):
        s = x.astype(str).str.strip()
        return x.notna() & (s != "") & (s.str.lower() != "nan")

    valid = nn(df["销售单关联"]) & nn(df["销售日期"]) & nn(df["销售数量"]) & nn(df["成交价"])
    events = []
    for _, r in df[valid].iterrows():
        inv = clean_str(r.get("销售单关联"))
        sale_date = parse_date(r.get("销售日期"))
        qty = int(round(parse_num(r.get("销售数量")) or 0))
        actual = parse_num(r.get("成交价"))
        name = clean_str(r.get("商品名称")) or ""
        source_no = clean_str(r.get("销售单号"))
        if not inv or not sale_date or qty <= 0 or actual is None:
            continue
        for i in range(qty):
            events.append(
                {
                    "inventory_id": inv,
                    "sale_date": sale_date,
                    "actual_price": float(actual),
                    "name": name,
                    "source_sale_no": source_no,
                }
            )
    return events


def main():
    source_events = load_source_events()
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    cur.execute(
        """
        SELECT s.id, s.sale_no, s.sale_date, s.actual_price,
               i.id, i.name, i.notes, i.sku_code, i.status
        FROM sale_records s
        JOIN items i ON i.id = s.item_id
        ORDER BY s.id ASC
        """
    )
    sale_rows = cur.fetchall()

    sales = []
    for sid, sale_no, sale_date, actual, item_id, item_name, notes, sku, status in sale_rows:
        inv = extract_mk(notes) or (sku or "")
        sales.append(
            {
                "sale_id": sid,
                "sale_no": sale_no,
                "sale_date": clean_str(sale_date),
                "actual_price": float(actual) if actual is not None else None,
                "item_id": item_id,
                "item_name": item_name or "",
                "inventory_id": inv,
            }
        )

    # Buckets for assignment
    bucket_exact = defaultdict(list)  # (date, price, name)
    bucket_mid = defaultdict(list)    # (date, price)
    for s in sales:
        bucket_exact[(s["sale_date"], s["actual_price"], s["item_name"])].append(s)
        bucket_mid[(s["sale_date"], s["actual_price"])].append(s)

    used_sale_ids = set()
    assigned = []  # (sale_id, target_inventory_id)

    # pass1: exact key
    for e in source_events:
        k = (e["sale_date"], e["actual_price"], e["name"])
        arr = bucket_exact.get(k, [])
        picked = None
        for s in arr:
            if s["sale_id"] not in used_sale_ids:
                picked = s
                break
        if picked:
            used_sale_ids.add(picked["sale_id"])
            assigned.append((picked["sale_id"], e["inventory_id"]))
            continue
        # pass2: date + price
        k2 = (e["sale_date"], e["actual_price"])
        arr2 = bucket_mid.get(k2, [])
        for s in arr2:
            if s["sale_id"] not in used_sale_ids:
                picked = s
                break
        if picked:
            used_sale_ids.add(picked["sale_id"])
            assigned.append((picked["sale_id"], e["inventory_id"]))
            continue
        # pass3: fallback any unused
        picked = None
        for s in sales:
            if s["sale_id"] not in used_sale_ids:
                picked = s
                break
        if picked:
            used_sale_ids.add(picked["sale_id"])
            assigned.append((picked["sale_id"], e["inventory_id"]))

    # Load items by inventory id
    cur.execute("SELECT id, notes, sku_code, status, is_deleted FROM items WHERE is_deleted=0")
    items_by_inv = defaultdict(list)
    for iid, notes, sku, status, _d in cur.fetchall():
        inv = extract_mk(notes) or (sku or "")
        items_by_inv[inv].append({"item_id": iid, "status": (status or "").lower()})

    # Prepare item assignment for each inventory id (unique first, then reuse)
    assigned_by_inv = defaultdict(list)
    for sale_id, inv in assigned:
        assigned_by_inv[inv].append(sale_id)

    sale_to_item = {}
    for inv, sale_ids in assigned_by_inv.items():
        pool = items_by_inv.get(inv, [])
        if not pool:
            continue
        # prioritize in_stock items first so sold count can increase
        pool_sorted = sorted(pool, key=lambda x: 0 if x["status"] == "in_stock" else 1)
        n = len(pool_sorted)
        for idx, sale_id in enumerate(sale_ids):
            target_item = pool_sorted[idx] if idx < n else pool_sorted[idx % n]
            sale_to_item[sale_id] = target_item["item_id"]

    # apply updates in transaction
    conn.execute("BEGIN")
    relink_updates = 0
    for sale_id, target_item_id in sale_to_item.items():
        cur.execute("SELECT item_id FROM sale_records WHERE id=?", (sale_id,))
        old_item = cur.fetchone()[0]
        if old_item != target_item_id:
            cur.execute("UPDATE sale_records SET item_id=? WHERE id=?", (target_item_id, sale_id))
            relink_updates += 1

    # status sync only for inventories present in source
    source_inv_set = set(e["inventory_id"] for e in source_events)
    sold_item_ids = set(sale_to_item.values())
    status_to_sold = 0
    status_to_instock = 0
    for inv in source_inv_set:
        for it in items_by_inv.get(inv, []):
            iid = it["item_id"]
            if iid in sold_item_ids:
                cur.execute("UPDATE items SET status='sold' WHERE id=? AND status<>'sold'", (iid,))
                status_to_sold += cur.rowcount if cur.rowcount is not None else 0
            else:
                cur.execute("UPDATE items SET status='in_stock' WHERE id=? AND status<>'in_stock'", (iid,))
                status_to_instock += cur.rowcount if cur.rowcount is not None else 0

    conn.commit()

    print(
        json.dumps(
            {
                "source_events": len(source_events),
                "sales_rows": len(sales),
                "assigned_pairs": len(assigned),
                "sale_to_item_links": len(sale_to_item),
                "relink_updates": relink_updates,
                "status_to_sold": status_to_sold,
                "status_to_instock": status_to_instock,
            },
            ensure_ascii=False,
            indent=2,
        )
    )

    conn.close()


if __name__ == "__main__":
    main()

