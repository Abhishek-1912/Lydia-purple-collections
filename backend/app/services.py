"""Database reads shared by routers."""
from datetime import datetime, timezone

from .config import get_settings
from .db import get_db
from .pricing import MAX_QTY, Rules, coupon_discount, totals

PRODUCT_SELECT = (
    "id,slug,name,description,fabric,care,category_id,price,mrp,is_bridal,is_new,is_clearance,is_active,"
    "sort_order,created_at,saree_length,saree_width,blouse_piece,composition,weave,origin,occasion,silk_mark,video_url,categories(slug,name,is_active),"
    "product_variants(id,color,color_hex,size,sku,stock),product_images(id,url,color,sort_order)"
)

DETAIL_FIELDS = ["saree_length", "saree_width", "blouse_piece", "composition", "weave", "origin", "occasion", "video_url"]

SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "Free size"]


def rules() -> Rules:
    s = get_settings()
    return Rules(s.free_shipping_above, s.shipping_fee, s.cod_fee, s.cod_max_order)


def _ts(v):
    return datetime.fromisoformat(v) if isinstance(v, str) else v


def shape_product(p: dict) -> dict:
    """Turn a DB row into the storefront product shape."""
    variants = sorted(
        p.get("product_variants") or [],
        key=lambda v: (v["color"], SIZE_ORDER.index(v["size"]) if v["size"] in SIZE_ORDER else 99, v["size"]),
    )
    images = sorted(p.get("product_images") or [], key=lambda i: i["sort_order"])
    colors, seen = [], set()
    for v in variants:
        if v["color"] and v["color"] not in seen:
            seen.add(v["color"])
            colors.append({"name": v["color"], "hex": v["color_hex"]})
    sizes = list(dict.fromkeys(v["size"] for v in variants if v["size"]))
    total_stock = sum(v["stock"] for v in variants)
    mrp = p.get("mrp")
    cat = p.get("categories") or {}
    return {
        "id": p["id"],
        "slug": p["slug"],
        "name": p["name"],
        "description": p.get("description"),
        "fabric": p.get("fabric"),
        "care": p.get("care"),
        "category": {"slug": cat.get("slug"), "name": cat.get("name")} if cat else None,
        "price": p["price"],
        "mrp": mrp,
        "discount_pct": round((mrp - p["price"]) * 100 / mrp) if mrp and mrp > p["price"] else 0,
        "is_bridal": p["is_bridal"],
        "is_new": p["is_new"],
        "is_clearance": p["is_clearance"],
        "sort_order": p.get("sort_order", 0),
        "created_at": p.get("created_at"),
        "colors": colors,
        "sizes": sizes,
        "variants": [{k: v[k] for k in ("id", "color", "color_hex", "size", "sku", "stock")} for v in variants],
        "images": [{"id": i["id"], "url": i["url"], "color": i["color"]} for i in images],
        "is_active": p["is_active"],
        "details": {k: p.get(k) for k in DETAIL_FIELDS},
        "silk_mark": p.get("silk_mark", False),
        "category_id": p.get("category_id"),
        "total_stock": total_stock,
        "in_stock": total_stock > 0,
    }


def visible(p: dict) -> bool:
    cat = p.get("categories")
    return p["is_active"] and (cat is None or cat.get("is_active", True))


def all_products() -> list[dict]:
    rows = get_db().table("products").select(PRODUCT_SELECT).eq("is_active", True).execute().data
    return [shape_product(p) for p in rows if visible(p)]


def get_coupon(code: str) -> dict | None:
    rows = get_db().table("coupons").select("*").eq("code", code.strip().upper()).limit(1).execute().data
    if not rows:
        return None
    c = rows[0]
    c["starts_at"], c["ends_at"] = _ts(c.get("starts_at")), _ts(c.get("ends_at"))
    return c


def quote(items: list[dict], coupon_code: str | None, payment_method: str | None) -> dict:
    """Re-price a cart from the database. items: [{variant_id, qty}]."""
    merged: dict[str, int] = {}
    for it in items:
        merged[it["variant_id"]] = merged.get(it["variant_id"], 0) + int(it["qty"])

    rows = []
    if merged:
        rows = (
            get_db().table("product_variants")
            .select("id,color,size,stock,products(id,slug,name,price,mrp,is_active,"
                    "categories(is_active),product_images(url,color,sort_order))")
            .in_("id", list(merged))
            .execute().data
        )
    by_id = {r["id"]: r for r in rows}

    lines, subtotal, ok = [], 0, True
    for vid, qty in merged.items():
        qty = max(1, min(qty, MAX_QTY))
        r = by_id.get(vid)
        p = r and r.get("products")
        if not p or not visible(p):
            lines.append({"variant_id": vid, "qty": qty, "available": False,
                          "error": "This item is no longer available. Please remove it."})
            ok = False
            continue
        imgs = sorted(p.get("product_images") or [], key=lambda i: (i["color"] not in (None, r["color"]), i["sort_order"]))
        line = {
            "variant_id": vid, "product_id": p["id"], "slug": p["slug"], "name": p["name"],
            "color": r["color"], "size": r["size"], "image": imgs[0]["url"] if imgs else None,
            "price": p["price"], "mrp": p["mrp"], "qty": qty, "stock": r["stock"],
            "line_total": p["price"] * qty, "available": True, "error": None,
        }
        if r["stock"] <= 0:
            line.update(available=False, error="Just sold out. Please remove it.")
            ok = False
        elif r["stock"] < qty:
            line.update(available=False, error=f"Only {r['stock']} left. Please lower the quantity.")
            ok = False
        else:
            subtotal += line["line_total"]
        lines.append(line)

    discount, coupon = 0, None
    if coupon_code and coupon_code.strip():
        code = coupon_code.strip().upper()
        discount, err = coupon_discount(get_coupon(code), subtotal, datetime.now(timezone.utc))
        coupon = {"code": code, "ok": err is None, "message": err or f"{code} applied."}

    return {"lines": lines, "ok": ok and bool(lines), "coupon": coupon,
            **totals(subtotal, discount, payment_method, rules())}
