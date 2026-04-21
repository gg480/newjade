import csv
import json
import os
import re
import sqlite3
from collections import Counter, defaultdict

import pandas as pd


ROOT = r"D:\02工作\ERP\newjade"
SRC_XLSX = r"D:\02工作\ERP\shangxian_data\商品价格表.xlsx"
DB_PATH = os.path.join(ROOT, "prisma", "dev.db")
OUT_DIR = os.path.join(ROOT, "tmp")
OUT_MD = os.path.join(OUT_DIR, "inventory_reconcile_report.md")
OUT_CSV = os.path.join(OUT_DIR, "inventory_diff.csv")


def ensure_dir(path: str):
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)


def clean_str(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s and s.lower() != "nan" else None


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


def parse_qty(v):
    n = parse_num(v)
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


def load_source():
    df = pd.read_excel(SRC_XLSX, sheet_name="入库登记")
    rows = []
    invalid = []
    for i, r in df.iterrows():
        rownum = i + 2
        product_id = clean_str(r.get("产品ID"))
        qty = parse_qty(r.get("初始库存"))
        cost = parse_num(r.get("成本价"))
        price = parse_num(r.get("零售价（直售）"))
        name = clean_str(r.get("产品名称"))

        rec = {
            "rownum": int(rownum),
            "product_id": product_id,
            "qty": qty,
            "cost_price": cost,
            "selling_price": price,
            "name": name,
        }
        missing = []
        if not product_id:
            missing.append("产品ID")
        if qty is None:
            missing.append("初始库存")
        if cost is None:
            missing.append("成本价")
        if price is None:
            missing.append("零售价（直售）")
        if missing:
            rec["invalid_reason"] = "字段缺失/格式异常: " + "、".join(missing)
            invalid.append(rec)
        else:
            rows.append(rec)
    return rows, invalid, len(df)


def load_system_items():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, sku_code, name, cost_price, selling_price, status, is_deleted, notes
        FROM items
        """
    )
    rows = cur.fetchall()
    conn.close()

    items = []
    for r in rows:
        mk = extract_mk(r["notes"])
        key = mk if mk else clean_str(r["sku_code"])
        items.append(
            {
                "item_id": r["id"],
                "product_id": key,
                "sku_code": clean_str(r["sku_code"]),
                "name": clean_str(r["name"]),
                "cost_price": float(r["cost_price"]) if r["cost_price"] is not None else None,
                "selling_price": float(r["selling_price"]) if r["selling_price"] is not None else None,
                "status": clean_str(r["status"]),
                "is_deleted": int(r["is_deleted"]) if r["is_deleted"] is not None else 0,
            }
        )
    return items


def agg_source_by_key(source_rows):
    by_key = defaultdict(lambda: {"qty": 0.0, "cost_total": 0.0, "value_total": 0.0, "cost_unit": None, "price_unit": None, "name": None})
    for r in source_rows:
        k = r["product_id"]
        g = by_key[k]
        q = float(r["qty"])
        g["qty"] += q
        g["cost_total"] += q * float(r["cost_price"])
        g["value_total"] += q * float(r["selling_price"])
        g["cost_unit"] = float(r["cost_price"])
        g["price_unit"] = float(r["selling_price"])
        g["name"] = r.get("name")
    return by_key


def agg_system_by_key(items):
    by_key = defaultdict(lambda: {"qty": 0.0, "cost_total": 0.0, "value_total": 0.0, "cost_units": set(), "price_units": set(), "statuses": Counter()})
    for r in items:
        k = r["product_id"]
        if not k:
            continue
        g = by_key[k]
        g["qty"] += 1.0
        g["cost_total"] += float(r["cost_price"] or 0.0)
        g["value_total"] += float(r["selling_price"] or 0.0)
        if r["cost_price"] is not None:
            g["cost_units"].add(float(r["cost_price"]))
        if r["selling_price"] is not None:
            g["price_units"].add(float(r["selling_price"]))
        g["statuses"][r["status"] or ""] += 1
    return by_key


def level1_totals(source_rows, system_items):
    src_qty = sum(float(r["qty"]) for r in source_rows)
    src_cost = sum(float(r["qty"]) * float(r["cost_price"]) for r in source_rows)
    src_value = sum(float(r["qty"]) * float(r["selling_price"]) for r in source_rows)
    sys_qty = float(len(system_items))
    sys_cost = sum(float(r["cost_price"] or 0.0) for r in system_items)
    sys_value = sum(float(r["selling_price"] or 0.0) for r in system_items)
    return {
        "src_qty": src_qty,
        "src_cost": src_cost,
        "src_value": src_value,
        "sys_qty": sys_qty,
        "sys_cost": sys_cost,
        "sys_value": sys_value,
        "diff_qty": sys_qty - src_qty,
        "diff_cost": sys_cost - src_cost,
        "diff_value": sys_value - src_value,
    }


def pct(diff, base):
    if base == 0:
        return 0.0 if diff == 0 else 100.0
    return diff / base * 100.0


def reconcile_key_level(source_by, system_by):
    all_keys = set(source_by.keys()) | set(system_by.keys())
    diffs = []
    for k in all_keys:
        s = source_by.get(k, {})
        t = system_by.get(k, {})
        s_qty = float(s.get("qty", 0.0))
        t_qty = float(t.get("qty", 0.0))
        s_cost = float(s.get("cost_total", 0.0))
        t_cost = float(t.get("cost_total", 0.0))
        s_val = float(s.get("value_total", 0.0))
        t_val = float(t.get("value_total", 0.0))
        if abs(s_qty - t_qty) > 1e-8 or abs(s_cost - t_cost) > 1e-8 or abs(s_val - t_val) > 1e-8:
            diffs.append(
                {
                    "product_id": k,
                    "source_qty": s_qty,
                    "system_qty": t_qty,
                    "source_cost_total": s_cost,
                    "system_cost_total": t_cost,
                    "source_value_total": s_val,
                    "system_value_total": t_val,
                    "qty_diff": t_qty - s_qty,
                    "cost_diff": t_cost - s_cost,
                    "value_diff": t_val - s_val,
                    "source_cost_unit": s.get("cost_unit"),
                    "source_price_unit": s.get("price_unit"),
                    "system_cost_unit_set": sorted(list(t.get("cost_units", set()))),
                    "system_price_unit_set": sorted(list(t.get("price_units", set()))),
                    "statuses": dict(t.get("statuses", {})),
                    "possible_reason": "",
                }
            )
    return diffs


def classify_reason(d):
    s_qty = d["source_qty"]
    t_qty = d["system_qty"]
    s_cost_u = d.get("source_cost_unit")
    s_price_u = d.get("source_price_unit")
    sys_cost_set = d.get("system_cost_unit_set") or []
    sys_price_set = d.get("system_price_unit_set") or []
    if t_qty == 0:
        return "漏录（系统无该匹配码）"
    if t_qty > s_qty and abs(d["cost_diff"]) < 1e-8 and abs(d["value_diff"]) < 1e-8:
        return "需确认（件数异常但金额对齐）"
    if t_qty < s_qty:
        return "漏录数量"
    if t_qty > s_qty:
        return "多录数量"
    # qty same, amount mismatch
    if s_cost_u is not None and (len(sys_cost_set) > 1 or (len(sys_cost_set) == 1 and abs(sys_cost_set[0] - s_cost_u) > 1e-8)):
        return "单价异常（成本价）"
    if s_price_u is not None and (len(sys_price_set) > 1 or (len(sys_price_set) == 1 and abs(sys_price_set[0] - s_price_u) > 1e-8)):
        return "单价异常（零售价）"
    return "需确认"


def write_diff_csv(path, diffs):
    fields = [
        "product_id",
        "source_qty",
        "system_qty",
        "source_cost_total",
        "system_cost_total",
        "source_value_total",
        "system_value_total",
        "qty_diff",
        "cost_diff",
        "value_diff",
        "possible_reason",
        "source_cost_unit",
        "source_price_unit",
        "system_cost_unit_set",
        "system_price_unit_set",
        "statuses",
    ]
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for d in diffs:
            row = dict(d)
            row["system_cost_unit_set"] = ",".join(str(x) for x in row.get("system_cost_unit_set", []))
            row["system_price_unit_set"] = ",".join(str(x) for x in row.get("system_price_unit_set", []))
            row["statuses"] = json.dumps(row.get("statuses", {}), ensure_ascii=False)
            w.writerow({k: row.get(k, "") for k in fields})


def top5_abs(diffs, key):
    return sorted(diffs, key=lambda x: abs(x.get(key, 0.0)), reverse=True)[:5]


def summarize_amount_sign(diffs, field):
    pos = sum(d[field] for d in diffs if d[field] > 0)
    neg = sum(d[field] for d in diffs if d[field] < 0)
    return pos, neg


def pass_fail(level_pass):
    return "通过" if level_pass else "未通过"


def write_report(path, meta):
    l1_all = meta["l1_all"]
    l1_instock = meta["l1_instock"]
    diffs_all = meta["diffs_all"]
    diffs_instock = meta["diffs_instock"]
    reason_count = Counter(d["possible_reason"] for d in diffs_all)
    pos_cost, neg_cost = summarize_amount_sign(diffs_all, "cost_diff")
    pos_val, neg_val = summarize_amount_sign(diffs_all, "value_diff")

    level1_pass_all = abs(l1_all["diff_qty"]) < 1e-8 and abs(l1_all["diff_cost"]) < 1e-8 and abs(l1_all["diff_value"]) < 1e-8
    level2_pass_all = len(diffs_all) == 0
    # Level3: no unit inconsistency in diff keys
    level3_pass_all = all(
        len(d.get("system_cost_unit_set", [])) <= 1
        and len(d.get("system_price_unit_set", [])) <= 1
        for d in diffs_all
    )

    lines = []
    lines.append("# 库存核对报告")
    lines.append("")
    lines.append("## 核对范围与口径")
    lines.append("- 源数据：`商品价格表.xlsx` 工作表 `入库登记`")
    lines.append("- 匹配键（你确认）：`产品ID`")
    lines.append("- 系统成本字段：`costPrice`")
    lines.append("- 系统零售价字段：`sellingPrice`")
    lines.append("- 系统状态字段：`isDeleted + status`")
    lines.append("- 在库判定：`isDeleted = 0 且 status = in_stock`")
    lines.append("")
    lines.append("## 三级核对结论（系统全量：isDeleted=0）")
    lines.append(f"- 第一级（总量总额）：**{pass_fail(level1_pass_all)}**")
    lines.append(f"- 第二级（按匹配码汇总）：**{pass_fail(level2_pass_all)}**")
    lines.append(f"- 第三级（差异匹配码单价核对）：**{pass_fail(level3_pass_all)}**")
    lines.append("")
    lines.append("## 第一级：总量核对")
    lines.append("")
    lines.append("### 源数据 vs 系统全量（isDeleted=0）")
    lines.append(f"- 源总件数：{l1_all['src_qty']:.2f}；系统总条数：{l1_all['sys_qty']:.2f}；差额：{l1_all['diff_qty']:.2f}（{pct(l1_all['diff_qty'], l1_all['src_qty']):.4f}%）")
    lines.append(f"- 源总成本：{l1_all['src_cost']:.2f}；系统总成本：{l1_all['sys_cost']:.2f}；差额：{l1_all['diff_cost']:.2f}（{pct(l1_all['diff_cost'], l1_all['src_cost']):.4f}%）")
    lines.append(f"- 源总货值：{l1_all['src_value']:.2f}；系统总货值：{l1_all['sys_value']:.2f}；差额：{l1_all['diff_value']:.2f}（{pct(l1_all['diff_value'], l1_all['src_value']):.4f}%）")
    lines.append("")
    lines.append("### 源数据 vs 系统仅在库（isDeleted=0 且 status=in_stock）")
    lines.append(f"- 源总件数：{l1_instock['src_qty']:.2f}；系统在库条数：{l1_instock['sys_qty']:.2f}；差额：{l1_instock['diff_qty']:.2f}（{pct(l1_instock['diff_qty'], l1_instock['src_qty']):.4f}%）")
    lines.append(f"- 源总成本：{l1_instock['src_cost']:.2f}；系统在库成本：{l1_instock['sys_cost']:.2f}；差额：{l1_instock['diff_cost']:.2f}（{pct(l1_instock['diff_cost'], l1_instock['src_cost']):.4f}%）")
    lines.append(f"- 源总货值：{l1_instock['src_value']:.2f}；系统在库货值：{l1_instock['sys_value']:.2f}；差额：{l1_instock['diff_value']:.2f}（{pct(l1_instock['diff_value'], l1_instock['src_value']):.4f}%）")
    lines.append("")
    lines.append("## 第二级：按匹配码汇总核对")
    lines.append(f"- 对不上的匹配码数量（系统全量）：**{len(diffs_all)}**")
    lines.append(f"- 对不上的匹配码数量（系统仅在库）：**{len(diffs_instock)}**")
    lines.append("")
    lines.append("## 差异金额统计（系统全量）")
    lines.append(f"- 成本差额正向合计：{pos_cost:.2f}")
    lines.append(f"- 成本差额负向合计：{neg_cost:.2f}")
    lines.append(f"- 货值差额正向合计：{pos_val:.2f}")
    lines.append(f"- 货值差额负向合计：{neg_val:.2f}")
    lines.append("")
    lines.append("## 可能原因分布（系统全量）")
    for k, v in reason_count.most_common():
        lines.append(f"- {k}: {v}")
    if not reason_count:
        lines.append("- 无差异")
    lines.append("")
    lines.append("## 最大单笔差异 Top 5（按 |货值差额|）")
    top5 = top5_abs(diffs_all, "value_diff")
    if top5:
        for i, d in enumerate(top5, 1):
            lines.append(
                f"{i}. {d['product_id']} | 源货值={d['source_value_total']:.2f} | 系统货值={d['system_value_total']:.2f} | 差额={d['value_diff']:.2f} | 原因={d['possible_reason']}"
            )
    else:
        lines.append("- 无")
    lines.append("")
    lines.append("## 软删除/状态拆分统计（系统）")
    lines.append(f"- 全量记录（items）：{meta['sys_total_rows']}")
    lines.append(f"- 软删除记录（isDeleted=1）：{meta['sys_deleted_rows']}")
    lines.append(f"- 非软删除记录（isDeleted=0）：{meta['sys_active_rows']}")
    lines.append(f"- 在库记录（isDeleted=0 且 status=in_stock）：{meta['sys_instock_rows']}")
    lines.append(f"- 已售记录（isDeleted=0 且 status=sold）：{meta['sys_sold_rows']}")
    lines.append("")
    lines.append("## 备注")
    lines.append("- 本报告未对数据库做任何写操作，仅做只读核对。")
    lines.append("- 拆分逻辑未直接执行验证；核对采用“源数量与系统子SKU条数应相等”的业务假设。")
    lines.append("- 详细差异已写入 `tmp/inventory_diff.csv`。")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main():
    ensure_dir(OUT_DIR)

    source_rows, source_invalid, source_total = load_source()
    sys_items_all = load_system_items()

    sys_items_active = [x for x in sys_items_all if x["is_deleted"] == 0]
    sys_items_instock = [x for x in sys_items_active if (x["status"] or "").lower() == "in_stock"]

    source_by = agg_source_by_key(source_rows)
    sys_by_all = agg_system_by_key(sys_items_active)
    sys_by_instock = agg_system_by_key(sys_items_instock)

    diffs_all = reconcile_key_level(source_by, sys_by_all)
    diffs_instock = reconcile_key_level(source_by, sys_by_instock)

    for d in diffs_all:
        d["possible_reason"] = classify_reason(d)

    # Output CSV should contain all mismatched keys (full scope)
    write_diff_csv(OUT_CSV, diffs_all)

    l1_all = level1_totals(source_rows, sys_items_active)
    l1_instock = level1_totals(source_rows, sys_items_instock)

    status_counter = Counter((x["status"] or "").lower() for x in sys_items_active)
    meta = {
        "l1_all": l1_all,
        "l1_instock": l1_instock,
        "diffs_all": diffs_all,
        "diffs_instock": diffs_instock,
        "sys_total_rows": len(sys_items_all),
        "sys_deleted_rows": len([x for x in sys_items_all if x["is_deleted"] == 1]),
        "sys_active_rows": len(sys_items_active),
        "sys_instock_rows": status_counter.get("in_stock", 0),
        "sys_sold_rows": status_counter.get("sold", 0),
        "source_total_rows": source_total,
        "source_valid_rows": len(source_rows),
        "source_invalid_rows": len(source_invalid),
    }
    write_report(OUT_MD, meta)

    print(
        json.dumps(
            {
                "source_total_rows": source_total,
                "source_valid_rows": len(source_rows),
                "source_invalid_rows": len(source_invalid),
                "system_total_rows": len(sys_items_all),
                "system_active_rows": len(sys_items_active),
                "system_instock_rows": len(sys_items_instock),
                "diff_keys_all": len(diffs_all),
                "diff_keys_instock": len(diffs_instock),
                "report": OUT_MD,
                "diff_csv": OUT_CSV,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

