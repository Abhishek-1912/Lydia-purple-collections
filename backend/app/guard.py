"""Abuse limits for order placement. Pure rules + a tiny in-memory rate limiter (tested in tests/test_guard.py)."""
import time
from collections import defaultdict, deque

MAX_ORDERS_PER_IP_HOUR = 6      # any payment method
MAX_OPEN_COD_PER_PHONE = 2      # COD orders not yet shipped


class RateLimiter:
    def __init__(self, limit: int, window_s: int):
        self.limit, self.window = limit, window_s
        self.hits: dict[str, deque] = defaultdict(deque)

    def allow(self, key: str, now: float | None = None) -> bool:
        now = time.time() if now is None else now
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        return True


def cod_refusal(blocked: bool, open_cod_orders: int) -> str | None:
    """Why COD is refused for this phone, or None if allowed."""
    if blocked:
        return "Cash on Delivery isn't available for this number. Please pay online, or message us on WhatsApp."
    if open_cod_orders >= MAX_OPEN_COD_PER_PHONE:
        return (f"You already have {open_cod_orders} Cash on Delivery orders being prepared. "
                "Please pay online for this one, or message us on WhatsApp.")
    return None
