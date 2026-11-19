"""Anonymous shop analytics: product views → add to cart → checkout → order (per browser session, no personal data)."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from .. import guard
from ..auth import require_admin
from ..db import get_db

router = APIRouter(prefix="/api", tags=["analytics"])
limiter = guard.RateLimiter(240, 3600)


class EventIn(BaseModel):
    session_id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    type: str = Field(pattern="^(view|cart|checkout)$")     # 'order' is recorded by the server itself
    product_id: str | None = Field(default=None, max_length=40)


@router.post("/events", status_code=204)
def track(body: EventIn, request: Request):
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0].strip()
    if limiter.allow(ip):
        try:
            get_db().table("events").insert(body.model_dump()).execute()
        except Exception:
            pass
    return None


def record_order(session_id: str | None) -> None:
    if session_id:
        try:
            get_db().table("events").insert({"session_id": session_id, "type": "order"}).execute()
        except Exception:
            pass


def funnel(events: list[dict]) -> dict:
    """Unique sessions at each step (pure — tested)."""
    steps = {t: {e["session_id"] for e in events if e["type"] == t} for t in ("view", "cart", "checkout", "order")}
    n = {k: len(v) for k, v in steps.items()}
    pct = lambda a, b: round(100 * a / b, 1) if b else 0  # noqa: E731
    return {"sessions": n, "view_to_cart": pct(n["cart"], n["view"]), "cart_to_checkout": pct(n["checkout"], n["cart"]),
            "checkout_to_order": pct(n["order"], n["checkout"]), "overall": pct(n["order"], n["view"])}


@router.get("/admin/analytics", dependencies=[Depends(require_admin)])
def analytics(days: int = 30):
    days = max(1, min(days, 90))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    db = get_db()
    events, start = [], 0
    while True:
        batch = db.table("events").select("session_id,type,product_id").gte("created_at", since).range(start, start + 999).execute().data
        events += batch
        if len(batch) < 1000 or start > 50000:
            break
        start += 1000
    products = {p["id"]: p for p in db.table("products").select("id,name,slug").execute().data}
    per: dict[str, dict] = {}
    for e in events:
        if e["product_id"] and e["type"] in ("view", "cart"):
            r = per.setdefault(e["product_id"], {"views": set(), "carts": set()})
            r["views" if e["type"] == "view" else "carts"].add(e["session_id"])
    orders = db.table("orders").select("phone,total,payment_method,status,order_items(product_id,qty)").gte("created_at", since).execute().data
    live = [o for o in orders if o["status"] not in ("cancelled", "pending_payment")]
    sold: dict[str, int] = {}
    for o in live:
        for it in o["order_items"]:
            if it["product_id"]:
                sold[it["product_id"]] = sold.get(it["product_id"], 0) + it["qty"]
    rows = [{"name": products[pid]["name"], "slug": products[pid]["slug"], "views": len(r["views"]), "carts": len(r["carts"]),
             "sold": sold.get(pid, 0)} for pid, r in per.items() if pid in products]
    rows.sort(key=lambda r: -r["views"])
    all_phones = [o["phone"] for o in db.table("orders").select("phone,status").execute().data if o["status"] not in ("cancelled", "pending_payment")]
    counts: dict[str, int] = {}
    for p in all_phones:
        counts[p] = counts.get(p, 0) + 1
    buyers = len(counts)
    return {
        "days": days, "funnel": funnel(events), "products": rows[:15],
        "orders": len(live), "cod_share": round(100 * sum(o["payment_method"] == "cod" for o in live) / len(live), 1) if live else 0,
        "repeat_customers": sum(1 for c in counts.values() if c > 1), "customers": buyers,
        "repeat_rate": round(100 * sum(1 for c in counts.values() if c > 1) / buyers, 1) if buyers else 0,
    }
