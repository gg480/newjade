import paramiko

PASSWORD = 'LRN86617320f'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.31.8', port=10000, username='13143360616', password=PASSWORD, timeout=10)

def sudo(cmd):
    stdin, stdout, stderr = client.exec_command(f'echo {PASSWORD} | sudo -S bash -c "{cmd}"')
    return stdout.read().decode().strip()

# Check existing state
print('=== 当前容器状态 ===')
out = sudo('docker ps -a --filter name=jade --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"')
print(out)

print()
print('=== docker-compose.yml 是否存在 ===')
out = sudo('ls -la /tmp/zfsv3/nvme12/13143360616/data/docker/Xing/docker-compose.yml 2>&1 || echo "not found"')
print(out)

print()
print('=== 检查 compose 项目目录 ===')
out = sudo('find /tmp/zfsv3 -name "docker-compose*" -o -name "compose*" 2>/dev/null | head -10')
print(out if out else 'not found')

print()
print('=== 建议操作 ===')
print('请告诉我原来 docker-compose.yml 放在 NAS 的哪个目录下？')
print('我帮你：')
print('1. 在该目录创建正确的 docker-compose.yml（port 25888 + 正确挂载路径）')
print('2. 使用 docker compose pull 拉取新镜像')
print('3. 用 docker compose up -d 重启容器')

client.close()
