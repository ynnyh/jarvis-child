# 轻量内存限流：滑动窗口，按 key（IP 或 IP+用户名）计数。
# 自用单进程场景够用——不引入 Redis/slowapi。多进程部署需换共享存储。
import time
from collections import defaultdict, deque
from threading import Lock

# key -> 最近命中的时间戳队列（单调递增）。
_hits: dict[str, deque] = defaultdict(deque)
_lock = Lock()


def check_rate_limit(key: str, max_hits: int, window_seconds: float) -> bool:
    """记录一次命中并判断是否超限。返回 True=允许，False=超限应拒绝。
    滑动窗口：清掉窗口外的旧时间戳，再看窗口内是否已达上限。"""
    now = time.time()
    cutoff = now - window_seconds
    with _lock:
        q = _hits[key]
        while q and q[0] < cutoff:
            q.popleft()
        if len(q) >= max_hits:
            return False
        q.append(now)
        return True
