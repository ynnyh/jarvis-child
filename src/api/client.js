// 后端 API 客户端：封装 fetch，自动带 JWT、统一错误处理。
// 基址走相对路径 /api，由 nginx 反代到后端容器；本地开发用 vite 代理（见 vite.config.js）。
//
// 设计：所有方法失败时抛错，调用方（同步层）自行决定是否降级到纯本地。
// 自用场景：token 存 localStorage，30 天有效。

const TOKEN_KEY = 'jarvis-child-token';
const BASE = '/api';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 忽略（隐私模式）
  }
}

export function isLoggedIn() {
  return !!getToken();
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    // 鉴权请求收到 401：token 已过期/失效，清掉本地 token，让 UI 回到未登录态。
    // 仅限带 token 的鉴权请求——login/register（auth:false）的 401 是密码错，不该清。
    if (res.status === 401 && auth && getToken()) {
      setToken(null);
    }
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {
      // 非 JSON 响应
    }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  // 204 无内容
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // ---- 认证 ----
  async register(username, password) {
    const data = await request('/auth/register', {
      method: 'POST',
      body: { username, password },
      auth: false,
    });
    setToken(data.access_token);
    return data;
  },
  async login(username, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: { username, password },
      auth: false,
    });
    setToken(data.access_token);
    return data;
  },
  logout() {
    setToken(null);
  },

  // ---- 档案 ----
  listProfiles() {
    return request('/profiles');
  },
  createProfile(nickname, avatar = '🐼') {
    return request('/profiles', { method: 'POST', body: { nickname, avatar } });
  },
  deleteProfile(profileId) {
    return request(`/profiles/${profileId}`, { method: 'DELETE' });
  },

  // ---- 同步 ----
  sync(payload) {
    return request('/sync', { method: 'POST', body: payload });
  },

  // ---- 报告 ----
  report(profileId) {
    return request(`/report/${profileId}`);
  },

  // ---- 健康检查 ----
  health() {
    return request('/health', { auth: false });
  },
};
