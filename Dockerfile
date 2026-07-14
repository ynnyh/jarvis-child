# ---- 构建阶段：安装依赖、生成笔画数据、打包 ----
FROM node:20-alpine AS build
WORKDIR /app

# 先装依赖（利用层缓存）
COPY package.json package-lock.json ./
RUN npm ci

# 拷贝源码并构建。extract-chars 会把用到的字的笔画数据生成到 public/char-data/，
# 再由 vite build 打包进 dist/，实现完全离线的描红。
COPY . .
RUN npm run extract-chars && npm run build

# ---- 运行阶段：nginx 托管静态产物 ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
