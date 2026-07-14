#!/usr/bin/env bash
# 发布脚本：把项目源码打包上传到服务器，在服务器上用 Docker 构建并运行。
# 用法：bash deploy.sh
# 依赖：本地 ssh/scp/tar，服务器已有 docker。
set -euo pipefail

# ---- 配置 ----
SSH_HOST="spark"                 # ~/.ssh/config 中的主机别名 (111.228.10.230)
APP_NAME="jarvis-child"          # 镜像名 / 容器名
HOST_PORT="712"                  # 对外端口
REMOTE_DIR="/root/${APP_NAME}"   # 服务器上的构建目录
ARCHIVE="/tmp/${APP_NAME}-src.tar.gz"

echo "==> 打包源码（排除 node_modules/dist/.git）"
tar --exclude='./node_modules' \
    --exclude='./dist' \
    --exclude='./.git' \
    --exclude='./*.tar.gz' \
    -czf "${ARCHIVE}" -C "$(dirname "$0")" .

echo "==> 上传到 ${SSH_HOST}:${REMOTE_DIR}"
ssh "${SSH_HOST}" "mkdir -p ${REMOTE_DIR}"
scp "${ARCHIVE}" "${SSH_HOST}:${REMOTE_DIR}/src.tar.gz"

echo "==> 在服务器上构建并运行"
ssh "${SSH_HOST}" bash -s <<REMOTE
set -euo pipefail
cd ${REMOTE_DIR}
tar -xzf src.tar.gz
echo "  -> docker build"
docker build -t ${APP_NAME}:latest .
echo "  -> 替换容器"
docker rm -f ${APP_NAME} 2>/dev/null || true
docker run -d --name ${APP_NAME} --restart unless-stopped -p ${HOST_PORT}:80 ${APP_NAME}:latest
echo "  -> 清理"
rm -f src.tar.gz
docker image prune -f >/dev/null 2>&1 || true
REMOTE

echo "==> 完成！访问 http://111.228.10.230:${HOST_PORT}/"
rm -f "${ARCHIVE}"
