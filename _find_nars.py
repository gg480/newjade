import paramiko
import sqlite3

PASSWORD = 'LRN86617320f'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.31.8', port=10000, username='13143360616', password=PASSWORD, timeout=10)

DB = '/tmp/zfsv3/nvme12/13143360616/data/docker/Xing/data/db/custom.db'

stdin, stdout, stderr = client.exec_command('cat ' + DB)
data = stdout.read()
with open('d:\\02工作\\ERP\\newjade\\_custom.db', 'wb') as f:
    f.write(data)

conn = sqlite3.connect('d:\\02工作\\ERP\\newjade\\_custom.db')
cursor = conn.cursor()

# 1. 先看贵金属材质商品有多少条有 spec，有多少条没 spec
print('='*90)
print('贵金属材质库存商品(in_stock)的克重情况:')
print('='*90)

# 有行情码的材质 ID 列表
VALID_SUBTYPE_MATERIALS = [12, 14, 7, 37, 45, 46, 47]  # Au9999, PT9995, AgT+D

cursor.execute("""
    SELECT dm.id, dm.name, dm.sub_type,
           COUNT(*) as total,
           SUM(CASE WHEN sp.weight IS NOT NULL AND sp.weight > 0 THEN 1 ELSE 0 END) as has_weight,
           SUM(CASE WHEN sp.id IS NULL OR sp.weight IS NULL OR sp.weight <= 0 THEN 1 ELSE 0 END) as no_weight
    FROM dict_material dm
    LEFT JOIN items i ON i.material_id = dm.id AND i.status = 'in_stock' AND i.is_deleted = 0
    LEFT JOIN item_spec sp ON sp.item_id = i.id
    WHERE dm.category = '贵金属'
    GROUP BY dm.id
    ORDER BY dm.sort_order
""")
rows = cursor.fetchall()
print('%-3s %-14s %-10s %-6s %-10s %-10s' % ('ID','名称','子类型','总数','有克重','无克重'))
print('-'*90)
for r in rows:
    print('%-3s %-14s %-10s %-6s %-10s %-10s' % (r[0], r[1], r[2] or '', r[3], r[4], r[5]))

# 2. 直接看 items 和 item_spec 的关系
print()
print('='*90)
print('items 与 item_spec 关联方式:')
print('='*90)
cursor.execute("PRAGMA table_info(items)")
for c in cursor.fetchall():
    print('  items.%-20s %s' % (c[1], c[2]))
cursor.execute("PRAGMA table_info(item_spec)")
for c in cursor.fetchall():
    print('  item_spec.%-20s %s' % (c[1], c[2]))

# 3. 查贵金属商品中无克重的具体明细
print()
print('='*90)
print('有行情码的材质中，无克重的库存商品明细（部分）:')
print('='*90)
cursor.execute("""
    SELECT i.id, i.sku_code, i.name, i.selling_price, dm.name as material_name, dm.sub_type
    FROM items i
    JOIN dict_material dm ON i.material_id = dm.id
    LEFT JOIN item_spec sp ON sp.item_id = i.id
    WHERE dm.category = '贵金属'
      AND i.status = 'in_stock'
      AND i.is_deleted = 0
      AND (sp.id IS NULL OR sp.weight IS NULL OR sp.weight <= 0)
    ORDER BY dm.name
    LIMIT 30
""")
rows = cursor.fetchall()
if rows:
    print('%-5s %-18s %-24s %-10s %-12s %-8s' % ('ID','SKU','名称','售价','材质','行情码'))
    print('-'*90)
    for r in rows:
        print('%-5s %-18s %-24s %-10s %-12s %-8s' % (r[0], r[1] or '', (r[2] or '')[:24], str(r[3] or ''), r[4], r[5] or ''))
    cursor.execute("""
        SELECT COUNT(*)
        FROM items i
        JOIN dict_material dm ON i.material_id = dm.id
        LEFT JOIN item_spec sp ON sp.item_id = i.id
        WHERE dm.category = '贵金属'
          AND i.status = 'in_stock'
          AND i.is_deleted = 0
          AND (sp.id IS NULL OR sp.weight IS NULL OR sp.weight <= 0)
    """)
    total_no_weight = cursor.fetchone()[0]
    print('... 共 %d 条贵金属库存商品无克重' % total_no_weight)
else:
    print('所有贵金属库存商品都有克重')

# 4. 检查全部贵金属库存商品总数
cursor.execute("""
    SELECT COUNT(*)
    FROM items i
    JOIN dict_material dm ON i.material_id = dm.id
    WHERE dm.category = '贵金属' AND i.status = 'in_stock' AND i.is_deleted = 0
""")
total_stock = cursor.fetchone()[0]
print()
print('贵金属库存商品总数: %d' % total_stock)

# 5. 查 item_spec 的总数
cursor.execute("SELECT COUNT(*) FROM item_spec")
spec_total = cursor.fetchone()[0]
cursor.execute("SELECT COUNT(*) FROM items WHERE is_deleted = 0")
item_total = cursor.fetchone()[0]
print('item_spec 总记录数: %d, items 总记录数: %d' % (spec_total, item_total))

# 6. 看 items 表中是否有 spec_id 字段
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'")
print()
print('items 建表语句:')
print(cursor.fetchone()[0][:500])

conn.close()
