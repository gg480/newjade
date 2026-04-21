import csv
import json
import os
import re
from collections import Counter, defaultdict
from datetime import datetime
from urllib.request import urlopen

import pandas as pd


ROOT = r"D:\02工作\ERP\newjade"
SRC_XLSX = r"D:\02工作\ERP\shangxian_data\商品价格表.xlsx"
API_BASE = "http://localhost:5000/api"
OUT_DIR = os.path.join(ROOT, "tmp")
OUT_MD = os.path.join(OUT_DIR, "reconcile_report.md")
OUT_CSV = os.path.join(OUT_DIR, "failed_records.csv")


def ensure_dir(path: str):
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)


def parse_cn_date(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        # Excel serial date (1900 date system)
        try:
            return pd.to_datetime(value, unit="D", origin="1899-12-30").strftime("%Y-%m-%d")
        except Exception:
            pass
    s = str(value).strip()
    if not s:
        return None
    if re.match(r"^\d+(\.\d+)?$", s):
        try:
            return pd.to_datetime(float(s), unit="D", origin="1899-12-30").strftime("%Y-%m-%d")
        except Exception:
            pass
    m = re.match(r"^(\d{4})年(\d{1,2})月(\d{1,2})日$", s)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    try:
        return pd.to_datetime(s).strftime("%Y-%m-%d")
    except Exception:
        return None


def parse_num(value):
    if value is None:
        return None
    s = str(value).strip()
    if not s or s.lower() == "nan":
        return None
    s = s.replace("¥", "").replace(",", "").replace("，", "")
    try:
        return float(s)
    except ValueError:
        return None


def parse_qty(value):
    n = parse_num(value)
    if n is None:
        return None
    if abs(n - round(n)) < 1e-8:
        return int(round(n))
    return n


def extract_mk(notes):
    if not notes:
        return None
    m = re.search(r"\[MK:([^\]]+)\]", str(notes))
    return m.group(1).strip() if m else None


def clean_str(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s and s.lower() != "nan" else None


def key_of(inv_id, sale_date, qty):
    return (inv_id or "", sale_date or "", qty if qty is not None else "")


def load_source_sales():
    df = pd.read_excel(SRC_XLSX, sheet_name="销售统计表")
    rows = []
    invalid_rows = []
    for i, row in df.iterrows():
        rownum = int(i) + 2
        status = clean_str(row.get("销售状态"))
        inv_id = clean_str(row.get("销售单关联"))  # 用户确认：库存ID映射此列
        sale_date = parse_cn_date(row.get("销售日期"))
        qty = parse_qty(row.get("销售数量"))
        amount = parse_num(row.get("实付金额"))  # 用户确认：成交金额用实付金额
        customer_id = clean_str(row.get("客户ID"))
        sale_no = clean_str(row.get("销售单号"))
        item_name = clean_str(row.get("商品名称"))

        rec = {
            "rownum": rownum,
            "source_sale_no": sale_no,
            "inventory_id": inv_id,
            "sale_date": sale_date,
            "sales_qty": qty,
            "paid_amount": amount,
            "customer_id": customer_id,
            "item_name": item_name,
            "sale_status": status,
        }
        missing = []
        if not inv_id:
            missing.append("销售单关联(库存ID)")
        if not sale_date:
            missing.append("销售日期")
        if qty is None:
            missing.append("销售数量")
        if amount is None:
            missing.append("实付金额")

        if missing:
            rec["invalid_reason"] = f"字段缺失/格式异常: {','.join(missing)}"
            invalid_rows.append(rec)
        else:
            rows.append(rec)
    return rows, invalid_rows, len(df)


def load_stock_initial_qty():
    try:
        df = pd.read_excel(SRC_XLSX, sheet_name="入库登记")
    except Exception:
        return {}, {"id_col": None, "qty_col": None}

    id_candidates = ["产品ID", "产品GUID", "入货单号", "库存ID", "销售单关联"]
    qty_candidates = ["初始库存", "初始库存数量", "库存数量", "数量"]
    id_col = next((c for c in id_candidates if c in df.columns), None)
    qty_col = next((c for c in qty_candidates if c in df.columns), None)

    if not id_col or not qty_col:
        return {}, {"id_col": id_col, "qty_col": qty_col}

    mapping = {}
    for _, row in df.iterrows():
        inv = clean_str(row.get(id_col))
        qty = parse_qty(row.get(qty_col))
        if inv:
            mapping[inv] = qty
    return mapping, {"id_col": id_col, "qty_col": qty_col}


def fetch_json(url):
    with urlopen(url, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_all_items(endpoint, page_size=500):
    page = 1
    all_items = []
    while True:
        payload = fetch_json(f"{API_BASE}{endpoint}?page={page}&size={page_size}")
        data = payload.get("data", {})
        items = data.get("items", [])
        pagination = data.get("pagination", {})
        all_items.extend(items)
        pages = pagination.get("pages", page)
        if page >= pages:
            break
        page += 1
    return all_items


def load_system_sales():
    rows = fetch_all_items("/sales", page_size=500)
    system = []
    for r in rows:
        item = r.get("item") or {}
        inv_id = extract_mk(item.get("notes")) or clean_str(item.get("skuCode"))
        system.append(
            {
                "sale_id": r.get("id"),
                "sale_no": clean_str(r.get("saleNo")),
                "inventory_id": inv_id,
                "sale_date": clean_str(r.get("saleDate")),
                "sales_qty": 1,  # 系统销售表无数量字段，按1条=1件
                "paid_amount": float(r["actualPrice"]) if r.get("actualPrice") is not None else None,
                "customer_id": clean_str((r.get("customer") or {}).get("customerCode")),
                "item_id": item.get("id"),
                "item_status": clean_str(item.get("status")),
                "item_is_deleted": int(bool(item.get("isDeleted"))),
            }
        )

    item_rows = fetch_all_items("/items", page_size=500)
    items_by_inventory = defaultdict(list)
    for r in item_rows:
        inv_id = extract_mk(r.get("notes")) or clean_str(r.get("skuCode"))
        if inv_id:
            items_by_inventory[inv_id].append(
                {
                    "item_id": r.get("id"),
                    "item_status": clean_str(r.get("status")),
                    "item_is_deleted": int(bool(r.get("isDeleted"))),
                }
            )

    return system, items_by_inventory


def build_reconcile(source_rows, invalid_source_rows, system_rows):
    source_by_key = defaultdict(list)
    for r in source_rows:
        source_by_key[key_of(r["inventory_id"], r["sale_date"], r["sales_qty"])].append(r)

    system_by_key = defaultdict(list)
    for r in system_rows:
        system_by_key[key_of(r["inventory_id"], r["sale_date"], r["sales_qty"])].append(r)

    A, B, C = [], [], []
    d_count = 0

    all_keys = set(source_by_key.keys()) | set(system_by_key.keys())
    for k in all_keys:
        src = source_by_key.get(k, [])
        sys = system_by_key.get(k, [])
        n = min(len(src), len(sys))

        # matched pairs -> C or D
        for i in range(n):
            s = src[i]
            t = sys[i]
            mismatches = []
            if s["paid_amount"] is not None and t["paid_amount"] is not None:
                if abs(float(s["paid_amount"]) - float(t["paid_amount"])) > 1e-8:
                    mismatches.append("实付金额不一致")
            elif s["paid_amount"] != t["paid_amount"]:
                mismatches.append("实付金额不一致")

            if (s.get("customer_id") or "") != (t.get("customer_id") or ""):
                mismatches.append("客户ID不一致")

            if mismatches:
                C.append(
                    {
                        "inventory_id": s["inventory_id"],
                        "sale_date": s["sale_date"],
                        "sales_qty": s["sales_qty"],
                        "source_paid_amount": s["paid_amount"],
                        "system_paid_amount": t["paid_amount"],
                        "source_customer_id": s.get("customer_id"),
                        "system_customer_id": t.get("customer_id"),
                        "sale_no": t.get("sale_no"),
                        "mismatches": "；".join(mismatches),
                    }
                )
            else:
                d_count += 1

        # source leftovers -> A
        for s in src[n:]:
            A.append(
                {
                    "rownum": s["rownum"],
                    "inventory_id": s["inventory_id"],
                    "sale_date": s["sale_date"],
                    "sales_qty": s["sales_qty"],
                    "paid_amount": s["paid_amount"],
                    "customer_id": s.get("customer_id"),
                    "item_name": s.get("item_name"),
                    "source_sale_no": s.get("source_sale_no"),
                    "reason": "系统无匹配记录",
                }
            )

        # system leftovers -> B
        for t in sys[n:]:
            B.append(
                {
                    "inventory_id": t["inventory_id"],
                    "sale_date": t["sale_date"],
                    "sales_qty": t["sales_qty"],
                    "paid_amount": t["paid_amount"],
                    "customer_id": t.get("customer_id"),
                    "sale_no": t.get("sale_no"),
                    "item_id": t.get("item_id"),
                }
            )

    # invalid source rows also treated as A (import-failed candidates)
    for s in invalid_source_rows:
        A.append(
            {
                "rownum": s["rownum"],
                "inventory_id": s.get("inventory_id"),
                "sale_date": s.get("sale_date"),
                "sales_qty": s.get("sales_qty"),
                "paid_amount": s.get("paid_amount"),
                "customer_id": s.get("customer_id"),
                "item_name": s.get("item_name"),
                "source_sale_no": s.get("source_sale_no"),
                "reason": s.get("invalid_reason", "字段不合法"),
            }
        )

    return A, B, C, d_count


def diagnose_A(A_rows, items_by_inventory, system_rows, stock_init_qty):
    # existing sales count by inventory id
    sales_count_by_inv = Counter()
    for r in system_rows:
        if r.get("inventory_id"):
            sales_count_by_inv[r["inventory_id"]] += 1

    out = []
    reason_tags = Counter()
    for r in A_rows:
        inv = r.get("inventory_id")
        qty = r.get("sales_qty")
        candidates = items_by_inventory.get(inv, []) if inv else []
        exists = len(candidates) > 0
        item_status = candidates[0]["item_status"] if exists else None
        related_sales = sales_count_by_inv.get(inv, 0) if inv else 0
        init_qty = stock_init_qty.get(inv)

        if r.get("reason", "").startswith("字段缺失/格式异常"):
            tag = "字段不合法"
        elif not inv:
            tag = "字段不合法"
        elif not exists:
            tag = "库存不存在"
        elif item_status == "sold":
            tag = "已标记售出"
        elif init_qty is not None and qty is not None and related_sales + float(qty) > float(init_qty):
            tag = "销售数量超过初始库存"
        else:
            tag = "其他"

        reason_tags[tag] += 1
        out.append(
            {
                **r,
                "inventory_exists": "是" if exists else "否",
                "item_status": item_status or "",
                "existing_sales_count": related_sales,
                "initial_stock_qty": "" if init_qty is None else init_qty,
                "failure_reason_tag": tag,
            }
        )
    return out, reason_tags


def write_failed_csv(rows):
    fieldnames = [
        "rownum",
        "source_sale_no",
        "inventory_id",
        "sale_date",
        "sales_qty",
        "paid_amount",
        "customer_id",
        "item_name",
        "reason",
        "inventory_exists",
        "item_status",
        "existing_sales_count",
        "initial_stock_qty",
        "failure_reason_tag",
    ]
    with open(OUT_CSV, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})


def write_report(
    source_total,
    source_valid,
    source_invalid,
    system_total,
    A_rows,
    B_rows,
    C_rows,
    d_count,
    reason_tags,
    stock_sheet_meta,
):
    lines = []
    lines.append("# 销售对账报告")
    lines.append("")
    lines.append("## 数据范围")
    lines.append(f"- 源数据文件：`{SRC_XLSX}`（工作表：`销售统计表`）")
    lines.append(f"- 系统销售表：`sale_records`（只读查询）")
    lines.append("")
    lines.append("## 总量统计")
    lines.append(f"- 源数据总条数：**{source_total}**")
    lines.append(f"- 源数据可参与对账条数（键字段齐全）：**{source_valid}**")
    lines.append(f"- 源数据键字段缺失/异常条数：**{source_invalid}**")
    lines.append(f"- 系统数据总条数：**{system_total}**")
    lines.append("")
    lines.append("## A/B/C/D 分类结果")
    lines.append(f"- A. 源有系统无（导入失败）：**{len(A_rows)}**")
    lines.append(f"- B. 系统有源无（多余记录）：**{len(B_rows)}**")
    lines.append(f"- C. 两边都有但关键字段不一致：**{len(C_rows)}**")
    lines.append(f"- D. 两边完全一致：**{d_count}**")
    lines.append("")
    lines.append("## A 类失败原因分布")
    lines.append("")
    lines.append("| 失败原因 | 条数 |")
    lines.append("|---|---:|")
    for k, v in reason_tags.most_common():
        lines.append(f"| {k} | {v} |")
    if not reason_tags:
        lines.append("| （无） | 0 |")
    lines.append("")
    lines.append("## 诊断说明")
    lines.append(f"- 入库登记表初始库存识别列：ID列=`{stock_sheet_meta.get('id_col')}`，数量列=`{stock_sheet_meta.get('qty_col')}`")
    if not stock_sheet_meta.get("id_col") or not stock_sheet_meta.get("qty_col"):
        lines.append("- 初始库存数量字段识别不完整：**需确认**")
    lines.append("- 对账匹配键：`库存ID(销售单关联) + 销售日期 + 销售数量`")
    lines.append("- 关键字段比对：`实付金额`、`客户ID`")
    lines.append("- 系统销售表无“销售数量”字段，按每条记录数量=1参与对账：**需确认**")
    lines.append("")
    lines.append("## 处理建议（批量）")
    lines.append("- 对 A 类中 `库存不存在`：先补库存（或修正库存ID）后再补销售。")
    lines.append("- 对 A 类中 `已标记售出`：若业务允许同库存多次销售，需要改导入/库存模型；否则人工判重跳过。")
    lines.append("- 对 A 类中 `字段不合法`：先在源文件修正键字段，再重跑导入。")
    lines.append("- 对 C 类不一致：优先以在线表为准，逐条校正金额/客户映射。")
    lines.append("- 如需彻底减少漏导，建议新增“预检模式”（先生成 A/B/C 报告再入库）。")
    lines.append("")
    lines.append("## 文件输出")
    lines.append(f"- 失败明细：`{OUT_CSV}`")

    with open(OUT_MD, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main():
    ensure_dir(OUT_DIR)

    source_rows, invalid_source_rows, source_total = load_source_sales()
    stock_init_qty, stock_sheet_meta = load_stock_initial_qty()
    system_rows, items_by_inventory = load_system_sales()

    A, B, C, d_count = build_reconcile(source_rows, invalid_source_rows, system_rows)
    A_diag, reason_tags = diagnose_A(A, items_by_inventory, system_rows, stock_init_qty)

    write_failed_csv(A_diag)
    write_report(
        source_total=source_total,
        source_valid=len(source_rows),
        source_invalid=len(invalid_source_rows),
        system_total=len(system_rows),
        A_rows=A_diag,
        B_rows=B,
        C_rows=C,
        d_count=d_count,
        reason_tags=reason_tags,
        stock_sheet_meta=stock_sheet_meta,
    )

    print(
        json.dumps(
            {
                "source_total": source_total,
                "source_valid": len(source_rows),
                "source_invalid": len(invalid_source_rows),
                "system_total": len(system_rows),
                "A": len(A_diag),
                "B": len(B),
                "C": len(C),
                "D": d_count,
                "report": OUT_MD,
                "failed_csv": OUT_CSV,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

