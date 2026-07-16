#!/usr/bin/env bash
# 后端发布脚本：构建并运行 FastAPI 后端容器。
# 用法：bash deploy-backend.sh
# 前提：先跑过 deploy.sh（它已把含 backend/ 的源码上传到服务器 REMOTE_DIR）。
#
# 关键点：
#   1. 容器以非 root（uid 10001）运行 —— 但挂载的 volume 里旧数据文件属主是 root，
#      挂载会覆盖镜像内 chown，导致 appuser 无法写库。故部署前用一次性容器把
#      volume 内容 chown 给 10001。
#   2. JWT_SECRET 从当前运行的后端容器里读出并沿用 —— 既不把密钥写进 git，
#      又保证现有登录 token 不失效。读不到则留空，由 config.py 自动生成并持久化。
set -euo pipefail

SSH_HOST="spark"
APP_NAME="jarvis-child-backend"
IMAGE="jarvis-child-backend:latest"
HOST_PORT="713"
REMOTE_DIR="/root/jarvis-child"        # deploy.sh 上传源码到这里
NETWORK="jarvis-child-net"
VOLUME="jarvis-child-data"

ssh "${SSH_HOST}" bash -s <<REMOTE
set -euo pipefail
cd ${REMOTE_DIR}

echo "  -> 读取现有 JWT_SECRET（沿用，避免现有 token 失效）"
OLD_SECRET=\$(docker inspect ${APP_NAME} --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | sed -n 's/^JWT_SECRET=//p' || true)
if [ -n "\${OLD_SECRET}" ]; then echo "     沿用现有密钥"; else echo "     未取到，将由后端自动生成并持久化到 volume"; fi

echo "  -> 构建后端镜像"
docker build -t ${IMAGE} ./backend

echo "  -> 确保 volume 存在，并把内容属主改为 uid 10001（appuser），否则非 root 容器无法写库"
docker volume create ${VOLUME} >/dev/null 2>&1 || true
docker run --rm -v ${VOLUME}:/data alpine chown -R 10001:10001 /data

echo "  -> 替换容器"
docker rm -f ${APP_NAME} 2>/dev/null || true
docker run -d --name ${APP_NAME} --network ${NETWORK} --restart unless-stopped \
  -p ${HOST_PORT}:8000 \
  -v ${VOLUME}:/app/data \
  \${OLD_SECRET:+-e JWT_SECRET=\${OLD_SECRET}} \
  ${IMAGE}

echo "  -> 健康检查"
sleep 2
docker exec ${APP_NAME} python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/health').read().decode())" || echo '(健康检查未通过，可稍后手动确认)'
echo ""
docker image prune -f >/dev/null 2>&1 || true
REMOTE

echo "==> 后端发布完成"
