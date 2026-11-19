"""Store settings: env defaults (config.py), overridden by Admin → Settings (store_settings table).
Cached for 30 s so every request doesn't hit the database."""
import time

from .config import get_settings
from .db import get_db
from .pricing import Rules

NUMBER_FIELDS = {"free_shipping_above": (0, 1_000_000), "shipping_fee": (0, 10_000), "cod_fee": (0, 10_000),
                 "cod_max_order": (0, 10_000_000), "dispatch_days": (0, 14)}
TEXT_FIELDS = {"shop_pin": 6, "whatsapp": 13, "phone": 20, "email": 120, "address": 300, "hours": 120,
               "instagram": 200, "announcement": 140}
_cache: dict = {"at": 0.0, "data": {}}


def defaults() -> dict:
    s = get_settings()
    return {"free_shipping_above": s.free_shipping_above, "shipping_fee": s.shipping_fee, "cod_fee": s.cod_fee,
            "cod_max_order": s.cod_max_order, "dispatch_days": s.dispatch_days, "shop_pin": s.shop_pin,
            # Public contact details start empty. SHOP_EMAIL / SHOP_WHATSAPP env values are only used for order alerts.
            "whatsapp": "", "phone": "", "email": "", "address": "", "hours": "",
            "instagram": "", "announcement": "", "banners": [], "hero": {}, "slide_seconds": 2}


def overrides(fresh: bool = False) -> dict:
    if fresh or time.time() - _cache["at"] > 30:
        try:
            rows = get_db().table("store_settings").select("data").eq("id", 1).execute().data
            _cache["data"] = rows[0]["data"] if rows else {}
        except Exception:
            pass  # table missing (migration not run) → env defaults
        _cache["at"] = time.time()
    return _cache["data"]


def current() -> dict:
    out = defaults()
    out.update({k: v for k, v in overrides().items() if k in out and v not in (None,)})
    return out


def rules() -> Rules:
    c = current()
    return Rules(int(c["free_shipping_above"]), int(c["shipping_fee"]), int(c["cod_fee"]), int(c["cod_max_order"]))


def save(changes: dict) -> dict:
    data = dict(overrides(fresh=True))
    data.update(changes)
    get_db().table("store_settings").upsert({"id": 1, "data": data, "updated_at": "now()"}).execute()
    overrides(fresh=True)
    return current()
