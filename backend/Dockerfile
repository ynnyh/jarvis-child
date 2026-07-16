# FastAPI 后端镜像。SQLite 数据落在 /app/data（挂载 volume 持久化）。
FROM python:3.11-slim
WORKDIR /app

# 先装依赖，利用层缓存。
# 服务器内存小（~2G），优先用预编译 wheel 避免本地编译（cryptography/bcrypt 编译很吃内存）。
COPY requirements.txt ./
RUN pip install --no-cache-dir --prefer-binary -r requirements.txt

# 拷贝应用代码。
COPY app ./app

# 数据目录（SQLite 库文件 + JWT 密钥落盘处，部署时挂 volume 持久化）。
# 建非 root 用户并把 /app 交给它：容器若被攻破也没有 root 权限（纵深防御）。
RUN mkdir -p /app/data \
    && adduser --disabled-password --gecos "" --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
