"""Database reads shared by routers."""
from datetime import datetime, timezone

from .config import get_settings
from .db import get_db
from .pricing import MAX_QTY, Rules, apply_gift, coupon_discount, gift_card_problem, totals

PRODUCT_SELECT = (
    "id,slug,name,description,fabric,care,category_id,price,mrp,is_bridal,is_new,is_clearance,is_active,"
    "sort_order,created_at,saree_length,saree_width,blouse_piece,composition,weave,origin,occasion,silk_mark,video_url,categories(slug,name,is_active),"
    "product_variants(id,color,color_hex,color_hex2,size,sku,stock),product_images(id,url,color,sort_order)"
)

DETAIL_FIELDS = ["saree_length", "saree_width", "blouse_piece", "composition", "weave", "origin", "occasion", "video_url"]

SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "Free size"]


def rules() -> Rules:
    from .store import rules as store_rules
    return store_rules()


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
            colors.append({"name": v["color"], "hex": v["color_hex"], "hex2": v.get("color_hex2")})
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
        "variants": [{k: v[k] for k in ("id", "color", "color_hex", "color_hex2", "size", "sku", "stock")} for v in variants],
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


def ratings() -> dict[str, dict]:
    """Average rating and count per product (approved reviews only). Empty if reviews table missing."""
    try:
        rows = get_db().table("reviews").select("product_id,rating").eq("status", "approved").execute().data
    except Exception:
        return {}
    out: dict[str, list[int]] = {}
    for r in rows:
        out.setdefault(r["product_id"], []).append(r["rating"])
    return {k: {"average": round(sum(v) / len(v), 1), "count": len(v)} for k, v in out.items()}


def all_products() -> list[dict]:
    rows = get_db().table("products").select(PRODUCT_SELECT).eq("is_active", True).execute().data
    rt = ratings()
    return [shape_product(p) | {"rating": rt.get(p["id"])} for p in rows if visible(p)]


def get_coupon(code: str) -> dict | None:
    rows = get_db().table("coupons").select("*").eq("code", code.strip().upper()).limit(1).execute().data
    if not rows:
        return None
    c = rows[0]
    c["starts_at"], c["ends_at"] = _ts(c.get("starts_at")), _ts(c.get("ends_at"))
    return c


def get_gift(code: str) -> dict | None:
    try:
        rows = get_db().table("gift_cards").select("*").eq("code", code.strip().upper()).limit(1).execute().data
    except Exception:
        return None
    if not rows:
        return None
    g = rows[0]
    g["expires_at"] = _ts(g.get("expires_at"))
    return g


def quote(items: list[dict], coupon_code: str | None, payment_method: str | None, gift_code: str | None = None) -> dict:
    """Re-price a cart from the database. items: [{variant_id, qty, addons?}].
    The same saree with different add-ons is a separate line; stock is checked per variant across lines."""
    from . import addons as ad
    from .store import current
    prices = current()
    merged: dict[tuple[str, str], dict] = {}
    for it in items:
        a = ad.clean(it.get("addons"))
        k = (it["variant_id"], ad.key(a))
        if k in merged:
            merged[k]["qty"] += int(it["qty"])
        else:
            merged[k] = {"qty": int(it["qty"]), "addons": a}
    per_variant: dict[str, int] = {}
    for (vid, _), m in merged.items():
        m["qty"] = max(1, min(m["qty"], MAX_QTY))
        per_variant[vid] = per_variant.get(vid, 0) + m["qty"]

    rows = []
    if merged:
        rows = (
            get_db().table("product_variants")
            .select("id,color,size,stock,products(id,slug,name,price,mrp,is_active,"
                    "categories(slug,is_active),product_images(url,color,sort_order))")
            .in_("id", list(per_variant))
            .execute().data
        )
    by_id = {r["id"]: r for r in rows}

    lines, subtotal, ok, prepaid_only = [], 0, True, False
    for (vid, akey), m in merged.items():
        qty, chosen = m["qty"], m["addons"]
        r = by_id.get(vid)
        p = r and r.get("products")
        if not p or not visible(p):
            lines.append({"variant_id": vid, "key": f"{vid}:{akey}", "addons": chosen, "addon_lines": [], "qty": qty, "available": False,
                          "error": "This item is no longer available. Please remove it."})
            ok = False
            continue
        imgs = sorted(p.get("product_images") or [], key=lambda i: (i["color"] not in (None, r["color"]), i["sort_order"]))
        extras, addon_err = ad.lines(chosen, prices) if akey else ([], None)
        if akey and ((p.get("categories") or {}).get("slug") != ad.CATEGORY):
            extras, addon_err = [], "Add-ons aren't available for this item. Please remove it and add it again."
        addon_amount = sum(e["amount"] for e in extras)
        line = {
            "variant_id": vid, "key": f"{vid}:{akey}", "product_id": p["id"], "slug": p["slug"], "name": p["name"],
            "color": r["color"], "size": r["size"], "image": imgs[0]["url"] if imgs else None,
            "price": p["price"], "mrp": p["mrp"], "qty": qty, "stock": r["stock"],
            "addons": chosen, "addon_lines": extras, "addon_amount": addon_amount, "unit_price": p["price"] + addon_amount,
            "line_total": (p["price"] + addon_amount) * qty, "available": True, "error": None,
        }
        if addon_err:
            line.update(available=False, error=addon_err)
            ok = False
        elif r["stock"] <= 0:
            line.update(available=False, error="Just sold out. Please remove it.")
            ok = False
        elif r["stock"] < per_variant[vid]:
            line.update(available=False, error=f"Only {r['stock']} left. Please lower the quantity.")
            ok = False
        else:
            subtotal += line["line_total"]
            prepaid_only = prepaid_only or bool(extras)
        lines.append(line)

    discount, coupon = 0, None
    if coupon_code and coupon_code.strip():
        code = coupon_code.strip().upper()
        discount, err = coupon_discount(get_coupon(code), subtotal, datetime.now(timezone.utc))
        coupon = {"code": code, "ok": err is None, "message": err or f"{code} applied."}

    money = totals(subtotal, discount, payment_method, rules()) | {"gift_amount": 0, "full_gift": False}
    gift = None
    if gift_code and gift_code.strip():
        code = gift_code.strip().upper()
        card = get_gift(code)
        problem = gift_card_problem(card, datetime.now(timezone.utc))
        if problem:
            gift = {"code": code, "ok": False, "message": problem}
        else:
            money = money | apply_gift(subtotal, discount, payment_method, int(card["balance"]), rules())
            gift = {"code": code, "ok": True, "balance": card["balance"],
                    "message": f"₹{money['gift_amount']:,} paid by gift card" + (" — nothing left to pay." if money["full_gift"] else ".")}
    money.setdefault("due", money["total"] - money["gift_amount"])
    if prepaid_only:
        money["cod_allowed"] = False
        money["cod_message"] = "Fall & edging, blouse stitching and shapewear are for online payment only."
    return {"lines": lines, "ok": ok and bool(lines), "coupon": coupon, "gift": gift, "prepaid_only": prepaid_only,
            "needs_measurements": any(l.get("addons", {}).get("blouse") for l in lines if l["available"]), **money}
