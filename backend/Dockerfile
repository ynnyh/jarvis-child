# FastAPI 后端镜像。SQLite 数据落在 /app/data（挂载 volume 持久化）。
FROM python:3.11-slim
WORKDIR /app

# 先装依赖，利用层缓存。
# 服务器内存小（~2G），优先用预编译 wheel 避免本地编译（cryptography/bcrypt 编译很吃内存）。
COPY requirements.txt ./
RUN pip install --no-cache-dir --prefer-binary -r requirements.txt

# 拷贝应用代码。
COPY app ./app

# 数据目录（SQLite 库文件位置，部署时挂 volume 持久化）。
RUN mkdir -p /app/data

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
