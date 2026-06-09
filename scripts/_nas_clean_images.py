import paramiko

PASSWORD = 'LRN86617320f'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.31.8', port=10000, username='13143360616', password=PASSWORD, timeout=10)

def sudo(cmd):
    stdin, stdout, stderr = client.exec_command(f'echo {PASSWORD} | sudo -S {cmd}')
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if err and 'password' not in err.lower():
        return f'[ERR] {err[:200]}'
    return out

# 1. 确认当前没有 jade 容器在运行
print('=== 检查 jade 容器 ===')
out = sudo('docker ps -a --filter name=jade --format "{{.Names}} {{.Status}}"')
print(out if out else '(无)')
print()

# 2. 强制删除旧镜像（同一 IMAGE ID 的三个 tag 会一并清除）
print('=== 删除旧 jadeerp 镜像 ===')
out = sudo('docker rmi -f ee35bcaf5ec7 2>&1')
print(out)
print()

# 3. 清理 dangling 镜像
print('=== 清理 dangling 镜像 ===')
out = sudo('docker image prune -f 2>&1')
print(out)
print()

# 4. 确认清理结果
print('=== 清理后 ===')
out = sudo("docker images | grep -iE 'jade|none'")
print(out if out else '(已清空)')
print()

client.close()
print('=== DONE ===')
