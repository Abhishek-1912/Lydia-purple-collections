from typing import Literal

import re
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request

from .. import delivery, notify, services, store
from ..config import get_settings
from ..db import get_db
from ..schemas import ContactIn, QuoteIn

router = APIRouter(prefix="/api", tags=["catalog"])

Sort = Literal["featured", "newest", "price_asc", "price_desc", "discount"]
SORTS = {
    "featured": (lambda p: (p["sort_order"], p["name"]), False),
    "newest": (lambda p: p["created_at"] or "", True),
    "price_asc": (lambda p: p["price"], False),
    "price_desc": (lambda p: p["price"], True),
    "discount": (lambda p: p["discount_pct"], True),
}


@router.get("/categories")
def list_categories():
    return (
        get_db().table("categories").select("slug,name,description,sort_order")
        .eq("is_active", True).order("sort_order").execute().data
    )


@router.get("/products")
def list_products(category: str | None = None, bridal: bool = False, clearance: bool = False,
                  new: bool = False, in_stock: bool = False, q: str | None = None,
                  sort: Sort = "featured", limit: int = 200):
    items = services.all_products()
    if category:
        items = [p for p in items if p["category"] and p["category"]["slug"] == category]
    if bridal:
        items = [p for p in items if p["is_bridal"]]
    if clearance:
        items = [p for p in items if p["is_clearance"]]
    if new:
        items = [p for p in items if p["is_new"]]
    if in_stock:
        items = [p for p in items if p["in_stock"]]
    if q and q.strip():
        words = q.lower().split()
        def hay(p):
            return " ".join(filter(None, [p["name"], p["fabric"], p["description"],
                                          p["category"] and p["category"]["name"],
                                          " ".join(c["name"] for c in p["colors"])])).lower()
        items = [p for p in items if all(w in hay(p) for w in words)]
    key, rev = SORTS[sort]
    items.sort(key=key, reverse=rev)
    # Sold-out items sink to the bottom except when sorting by price
    if sort not in ("price_asc", "price_desc"):
        items.sort(key=lambda p: not p["in_stock"])
    return items[: max(1, min(limit, 200))]


@router.get("/products/{slug}")
def get_product(slug: str):
    rows = (get_db().table("products").select(services.PRODUCT_SELECT)
            .eq("slug", slug).eq("is_active", True).limit(1).execute().data)
    if not rows or not services.visible(rows[0]):
        raise HTTPException(404, "Product not found")
    product = services.shape_product(rows[0])
    others = [p for p in services.all_products() if p["id"] != product["id"] and p["in_stock"]]
    cat = product["category"] and product["category"]["slug"]
    others.sort(key=lambda p: (not (p["category"] and p["category"]["slug"] == cat), p["sort_order"]))
    product["related"] = others[:4]
    return product


@router.get("/delivery-estimate")
def delivery_estimate(pin: str):
    if not re.fullmatch(r"[1-9][0-9]{5}", pin or ""):
        raise HTTPException(400, "Please enter a valid 6-digit PIN code.")
    c = store.current()
    today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date()
    return delivery.estimate(pin, today, c["shop_pin"], int(c["dispatch_days"])) | {"pin": pin}


@router.post("/cart/quote")
def cart_quote(body: QuoteIn):
    return services.quote([i.model_dump() for i in body.items], body.coupon_code, body.payment_method)


@router.get("/store-rules")
def store_rules():
    s, c = get_settings(), store.current()
    return {k: c[k] for k in ("free_shipping_above", "shipping_fee", "cod_fee", "cod_max_order",
                              "whatsapp", "phone", "email", "address", "hours", "instagram", "announcement")} | {
        "payment_timeout_minutes": s.payment_timeout_minutes,
        "razorpay_enabled": s.razorpay_enabled,
        "razorpay_key_id": s.razorpay_key_id,
    }


_contact_hits: dict[str, deque] = defaultdict(deque)


@router.post("/contact")
def contact(body: ContactIn, request: Request):
    if body.website:  # bot filled the hidden field — pretend success
        return {"ok": True}
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0].strip()
    hits, now = _contact_hits[ip], time.time()
    while hits and now - hits[0] > 3600:
        hits.popleft()
    if len(hits) >= 5:
        raise HTTPException(429, "You've sent several messages already. Please message us on WhatsApp instead.")
    hits.append(now)
    if not notify.contact_message(body.name.strip(), body.phone, body.email, body.message.strip()):
        raise HTTPException(503, "We couldn't send your message right now. Please message us on WhatsApp or call us.")
    return {"ok": True}
