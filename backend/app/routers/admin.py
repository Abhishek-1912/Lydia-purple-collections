import csv
import io
import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .. import notify, services
from ..auth import admin_gate, require_admin
from ..config import get_settings
from ..db import get_db
from ..importer import run_import

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(admin_gate)])
IST = timezone(timedelta(hours=5, minutes=30))
BUCKET = "product-images"
MAX_IMAGE = 5 * 1024 * 1024


# ───────────── helpers ─────────────
def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80] or "product"


def unique_slug(name: str, exclude_id: str | None = None) -> str:
    base, n = slugify(name), 1
    slug = base
    while True:
        q = get_db().table("products").select("id").eq("slug", slug)
        rows = q.execute().data
        if not rows or rows[0]["id"] == exclude_id:
            return slug
        n += 1
        slug = f"{base}-{n}"


def image_kind(data: bytes) -> str | None:
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def store_image(product_id: str, data: bytes, color: str | None) -> dict:
    """Validate and upload one image; returns the product_images row."""
    if len(data) > MAX_IMAGE:
        raise HTTPException(400, "Photo is larger than 5 MB. Please compress it and try again.")
    kind = image_kind(data)
    if not kind:
        raise HTTPException(400, "Only JPG, PNG or WebP photos are allowed.")
    path = f"{product_id}/{uuid.uuid4().hex}.{kind}"
    db = get_db()
    db.storage.from_(BUCKET).upload(path, data, {"content-type": f"image/{'jpeg' if kind == 'jpg' else kind}"})
    url = f"{get_settings().supabase_url}/storage/v1/object/public/{BUCKET}/{path}"
    existing = db.table("product_images").select("id").eq("product_id", product_id).execute().data
    return db.table("product_images").insert({
        "product_id": product_id, "url": url, "color": color or None, "sort_order": len(existing),
    }).execute().data[0]


# ───────────── stats ─────────────
def _abandoned_count() -> int:
    try:
        now = datetime.now(timezone.utc)
        return len(get_db().table("checkout_drafts").select("id").is_("order_id", "null").is_("contacted_at", "null")
                   .lte("updated_at", (now - timedelta(minutes=30)).isoformat())
                   .gte("updated_at", (now - timedelta(days=7)).isoformat()).execute().data)
    except Exception:
        return 0

def _variant_image(images: list[dict], color: str) -> str | None:
    """Best photo for a colour: one tagged with that colour, else the product's main photo."""
    imgs = sorted(images, key=lambda i: (i["color"] not in (None, color), i["color"] is None, i["sort_order"]))
    return imgs[0]["url"] if imgs else None

@router.get("/stats")
def stats():
    db = get_db()
    start = datetime.now(IST).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc).isoformat()
    today = db.table("orders").select("total,status").gte("created_at", start).execute().data
    live = [o for o in today if o["status"] not in ("cancelled", "pending_payment")]
    count = lambda **f: len(db.table("orders").select("id").match(f).execute().data)  # noqa: E731
    from .. import store
    threshold = int(store.current().get("low_stock") or 2)
    low = (db.table("product_variants")
           .select("id,color,color_hex,color_hex2,size,sku,stock,products(id,name,slug,is_active,product_images(url,color,sort_order))")
           .lte("stock", threshold).order("stock").execute().data)
    return {
        "orders_today": len(live),
        "sales_today": sum(o["total"] for o in live),
        "to_pack": count(status="confirmed"),
        "to_ship": count(status="packed"),
        "needs_review": count(needs_review=True),
        "abandoned": _abandoned_count(),
        "low_stock_threshold": threshold,
        "low_stock": [{"variant_id": v["id"], "product_id": v["products"]["id"], "name": v["products"]["name"],
                       "slug": v["products"]["slug"], "color": v["color"], "color_hex": v["color_hex"],
                       "color_hex2": v.get("color_hex2"), "size": v["size"], "sku": v["sku"], "stock": v["stock"],
                       "image": _variant_image(v["products"].get("product_images") or [], v["color"])}
                      for v in low if v.get("products") and v["products"]["is_active"]],
    }


# ───────────── products ─────────────
class VariantIn(BaseModel):
    id: str | None = None
    color: str = Field(default="", max_length=60)
    color_hex: str | None = Field(default=None, pattern=r"^$|^#[0-9A-Fa-f]{6}$")
    color_hex2: str | None = Field(default=None, pattern=r"^$|^#[0-9A-Fa-f]{6}$")  # border colour (two-tone)
    size: str = Field(default="", max_length=30)
    sku: str | None = Field(default=None, max_length=60)
    stock: int = Field(ge=0, le=100000)


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    category_id: str | None = None
    fabric: str | None = None
    price: int = Field(gt=0)
    mrp: int | None = Field(default=None, gt=0)
    description: str | None = None
    care: str | None = None
    is_active: bool = True
    is_new: bool = False
    is_bridal: bool = False
    is_clearance: bool = False
    sort_order: int = 0
    saree_length: str | None = Field(default=None, max_length=40)
    saree_width: str | None = Field(default=None, max_length=40)
    blouse_piece: str | None = Field(default=None, max_length=120)
    composition: str | None = Field(default=None, max_length=200)
    weave: str | None = Field(default=None, max_length=200)
    origin: str | None = Field(default=None, max_length=120)
    occasion: str | None = Field(default=None, max_length=200)
    silk_mark: bool = False
    video_url: str | None = Field(default=None, max_length=500, pattern=r"^$|^https://")
    variants: list[VariantIn] = Field(min_length=1)


def _check(body: ProductIn):
    if body.mrp and body.mrp < body.price:
        raise HTTPException(400, "MRP can't be lower than the selling price.")
    keys = [(v.color.strip().lower(), v.size.strip().lower()) for v in body.variants]
    if len(keys) != len(set(keys)):
        raise HTTPException(400, "Two variants have the same colour and size.")
    skus = [v.sku.strip() for v in body.variants if v.sku and v.sku.strip()]
    if len(skus) != len(set(skus)):
        raise HTTPException(400, "Two variants have the same SKU.")


def auto_sku(name: str, color: str, size: str) -> str:
    """Readable unique SKU for rows added without one, e.g. KSS-4F2A-PUR-M (Kanjivaram Silk Saree, Purple, M)."""
    words = [w for w in re.findall(r"[A-Za-z]+", name) if w.lower() not in ("and", "with", "the", "of")]
    initials = "".join(w[0] for w in words[:3]).upper() or "LPC"
    parts = [initials, uuid.uuid4().hex[:4].upper(), re.sub(r"[^A-Z]", "", color.upper())[:3] or None,
             re.sub(r"[^A-Z0-9]", "", size.upper())[:4] or None]
    return "-".join(p for p in parts if p)


def _save_variants(product_id: str, variants: list[VariantIn], product_name: str = ""):
    db = get_db()
    keep = [v.id for v in variants if v.id]
    current = [r["id"] for r in db.table("product_variants").select("id").eq("product_id", product_id).execute().data]
    gone = [i for i in current if i not in keep]
    if gone:
        db.table("product_variants").delete().in_("id", gone).execute()
    for v in variants:
        row = {"product_id": product_id, "color": v.color.strip(), "color_hex": v.color_hex or None, "color_hex2": v.color_hex2 or None,
               "size": v.size.strip(), "sku": (v.sku or "").strip() or auto_sku(product_name, v.color, v.size), "stock": v.stock}
        if v.id and v.id in current:
            db.table("product_variants").update(row).eq("id", v.id).execute()
        else:
            db.table("product_variants").insert(row).execute()


def _product(pid: str) -> dict:
    rows = get_db().table("products").select(services.PRODUCT_SELECT).eq("id", pid).limit(1).execute().data
    if not rows:
        raise HTTPException(404, "Product not found.")
    return services.shape_product(rows[0])


def _db_error(e: Exception):
    msg = str(e)
    if "product_variants_sku_key" in msg:
        raise HTTPException(400, "That SKU is already used by another product.")
    if "duplicate key" in msg:
        raise HTTPException(400, "Two variants have the same colour and size.")
    raise e


@router.get("/products")
def list_products(status: str = "all", q: str | None = None):
    query = get_db().table("products").select(services.PRODUCT_SELECT).order("sort_order").order("created_at", desc=True)
    if status == "live":
        query = query.eq("is_active", True)
    elif status == "hidden":
        query = query.eq("is_active", False)
    items = [services.shape_product(p) for p in query.execute().data]
    if q and q.strip():
        t = q.lower().strip()
        items = [p for p in items if t in p["name"].lower() or any(t in (v["sku"] or "").lower() for v in p["variants"])]
    return items


@router.get("/products/{pid}")
def get_product(pid: str):
    return _product(pid)


@router.post("/products")
def create_product(body: ProductIn):
    _check(body)
    data = body.model_dump(exclude={"variants"}) | {"slug": unique_slug(body.name)}
    pid = get_db().table("products").insert(data).execute().data[0]["id"]
    try:
        _save_variants(pid, body.variants, body.name)
    except Exception as e:
        get_db().table("products").delete().eq("id", pid).execute()
        _db_error(e)
    return _product(pid)


@router.put("/products/{pid}")
def update_product(pid: str, body: ProductIn):
    _check(body)
    old = _product(pid)
    data = body.model_dump(exclude={"variants"})
    if body.name != old["name"]:
        data["slug"] = unique_slug(body.name, exclude_id=pid)
    get_db().table("products").update(data).eq("id", pid).execute()
    try:
        _save_variants(pid, body.variants, body.name)
    except Exception as e:
        _db_error(e)
    return _product(pid)


class ActiveIn(BaseModel):
    is_active: bool


@router.patch("/products/{pid}")
def set_active(pid: str, body: ActiveIn):
    get_db().table("products").update({"is_active": body.is_active}).eq("id", pid).execute()
    return _product(pid)


@router.delete("/products/{pid}")
def delete_product(pid: str):
    """Deletes for good. Past orders keep their snapshot (name, price, colour, photo URL)."""
    db = get_db()
    paths = [i["url"].split(f"/{BUCKET}/", 1)[-1]
             for i in db.table("product_images").select("url").eq("product_id", pid).execute().data
             if f"/{BUCKET}/" in i["url"]]
    db.table("products").delete().eq("id", pid).execute()
    if paths:
        try:
            db.storage.from_(BUCKET).remove(paths)
        except Exception:
            pass
    return {"ok": True}


@router.get("/categories")
def categories():
    return get_db().table("categories").select("id,slug,name,is_active").order("sort_order").execute().data


# ───────────── images ─────────────
@router.post("/products/{pid}/images")
async def upload_image(pid: str, file: UploadFile = File(...), color: str = Form("")):
    _product(pid)
    data = await file.read(MAX_IMAGE + 1)
    return store_image(pid, data, color.strip())


@router.delete("/images/{image_id}")
def delete_image(image_id: str):
    db = get_db()
    rows = db.table("product_images").select("url").eq("id", image_id).execute().data
    if not rows:
        raise HTTPException(404, "Photo not found.")
    db.table("product_images").delete().eq("id", image_id).execute()
    url = rows[0]["url"]
    if f"/{BUCKET}/" in url:
        try:
            db.storage.from_(BUCKET).remove([url.split(f"/{BUCKET}/", 1)[1]])
        except Exception:
            pass
    return {"ok": True}


class ImageColorIn(BaseModel):
    color: str | None = None


@router.patch("/images/{image_id}")
def set_image_color(image_id: str, body: ImageColorIn):
    get_db().table("product_images").update({"color": body.color or None}).eq("id", image_id).execute()
    return {"ok": True}


# ───────────── bulk import ─────────────
@router.post("/products/import")
async def import_products(file: UploadFile = File(...), dry_run: bool = Form(True)):
    data = await file.read(10 * 1024 * 1024 + 1)
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "File is larger than 10 MB.")
    return run_import(file.filename or "", data, dry_run, unique_slug, store_image)


# ───────────── orders ─────────────
ORDER_FIELDS = ("id,order_no,user_id,customer_name,phone,email,address,subtotal,shipping_fee,cod_fee,discount,total,"
                "coupon_code,payment_method,payment_status,status,razorpay_order_id,razorpay_payment_id,courier,"
                "tracking_number,needs_review,stock_released,paid_at,shipped_at,delivered_at,created_at,"
                "order_items(name,color,size,image_url,price,qty)")


def _with_blocked(orders: list[dict]) -> list[dict]:
    phones = list({o["phone"] for o in orders})
    blocked = {r["phone"] for r in get_db().table("blocked_phones").select("phone").in_("phone", phones).execute().data} if phones else set()
    for o in orders:
        o["cod_blocked"] = o["phone"] in blocked
    return orders


class BlockIn(BaseModel):
    blocked: bool
    reason: str | None = Field(default=None, max_length=200)


@router.put("/blocked-phones/{phone}")
def set_blocked(phone: str, body: BlockIn):
    if not re.fullmatch(r"[6-9][0-9]{9}", phone):
        raise HTTPException(400, "Invalid phone number.")
    db = get_db()
    if body.blocked:
        db.table("blocked_phones").upsert({"phone": phone, "reason": body.reason}).execute()
    else:
        db.table("blocked_phones").delete().eq("phone", phone).execute()
    return {"phone": phone, "blocked": body.blocked}


@router.get("/orders")
def list_orders(status: str | None = None, q: str | None = None, needs_review: bool = False, limit: int = 100):
    query = get_db().table("orders").select(ORDER_FIELDS).order("created_at", desc=True).limit(min(limit, 300))
    if status:
        query = query.eq("status", status)
    if needs_review:
        query = query.eq("needs_review", True)
    if q and q.strip():
        t = q.strip()
        num = re.sub(r"(?i)^lpc", "", t)
        digits = re.sub(r"\D", "", t)
        if num.isdigit() and len(num) < 9:
            query = query.eq("order_no", int(num))
        elif len(digits) >= 4 and not re.search(r"[a-zA-Z]", t):
            query = query.ilike("phone", f"%{digits[-10:]}%")
        else:
            query = query.ilike("customer_name", f"%{t}%")
    return _with_blocked(query.execute().data)


@router.get("/orders/export")
def export_orders(status: str | None = None):
    """All orders (or one status) as CSV — one row per item, for accounts/GST and courier booking."""
    db, rows, start = get_db(), [], 0
    while True:  # page through everything
        q = db.table("orders").select(ORDER_FIELDS).order("created_at", desc=True).range(start, start + 999)
        if status:
            q = q.eq("status", status)
        batch = q.execute().data
        rows += batch
        if len(batch) < 1000:
            break
        start += 1000
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["Order", "Date (IST)", "Status", "Payment method", "Payment status", "Razorpay payment ID",
                "Customer", "Phone", "Email", "Address", "City", "State", "PIN",
                "Item", "Colour", "Size", "Qty", "Unit price", "Line total",
                "Subtotal", "Discount", "Coupon", "Shipping", "COD fee", "Order total", "Courier", "Tracking"])
    for o in rows:
        a = o["address"] or {}
        when = datetime.fromisoformat(o["created_at"]).astimezone(IST).strftime("%Y-%m-%d %H:%M")
        addr = ", ".join(x for x in (a.get("line1"), a.get("line2"), a.get("landmark") and "Near " + a["landmark"]) if x)
        for n, it in enumerate(o["order_items"] or [{}]):
            first = n == 0  # order-level money only on the first line, so columns sum correctly
            w.writerow([f"LPC{o['order_no']}", when, o["status"], o["payment_method"], o["payment_status"],
                        o.get("razorpay_payment_id") or "", o["customer_name"], o["phone"], o.get("email") or "",
                        addr, a.get("city", ""), a.get("state", ""), a.get("pin", ""),
                        it.get("name", ""), it.get("color", ""), it.get("size", ""), it.get("qty", ""),
                        it.get("price", ""), (it.get("price") or 0) * (it.get("qty") or 0),
                        o["subtotal"] if first else "", o["discount"] if first else "", (o["coupon_code"] or "") if first else "",
                        o["shipping_fee"] if first else "", o["cod_fee"] if first else "", o["total"] if first else "",
                        o.get("courier") or "", o.get("tracking_number") or ""])
    return Response("\ufeff" + out.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="orders.csv"'})


@router.get("/orders/{oid}/invoice")
def order_invoice(oid: str):
    from .. import invoice, store
    db = get_db()
    rows = db.table("orders").select(ORDER_FIELDS + ",invoice_no,invoice_date,gift_amount,gift_code").eq("id", oid).execute().data
    if not rows:
        raise HTTPException(404, "Order not found.")
    o = rows[0]
    if o["status"] in ("cancelled", "pending_payment"):
        raise HTTPException(400, "Invoices are only for confirmed orders.")
    n = db.rpc("next_invoice", {"p_order_id": oid}).execute().data
    issued = datetime.fromisoformat(o["invoice_date"]).astimezone(IST) if o.get("invoice_date") else datetime.now(IST)
    return invoice.build(o, store.current(), n, issued)


class OrderAction(BaseModel):
    action: str = Field(pattern="^(tracking|pack|ship|deliver|cancel|review|refund)$")
    courier: str | None = Field(default=None, max_length=60)
    tracking_number: str | None = Field(default=None, max_length=80)


@router.patch("/orders/{oid}")
def update_order(oid: str, body: OrderAction, background: BackgroundTasks, request: Request):
    if getattr(request.state, "role", "admin") == "packer" and body.action not in ("tracking", "pack", "ship"):
        raise HTTPException(403, "Packers can add tracking and mark orders packed or shipped.")
    db = get_db()
    rows = db.table("orders").select("id,status,payment_status,payment_method,courier,tracking_number").eq("id", oid).execute().data
    if not rows:
        raise HTTPException(404, "Order not found.")
    o, now = rows[0], datetime.now(timezone.utc).isoformat()
    upd: dict = {}
    if body.courier is not None:
        upd["courier"] = body.courier.strip() or None
    if body.tracking_number is not None:
        upd["tracking_number"] = body.tracking_number.strip() or None

    a, st = body.action, o["status"]
    if a == "pack":
        if st != "confirmed":
            raise HTTPException(400, "Only confirmed orders can be marked packed.")
        upd["status"] = "packed"
    elif a == "ship":
        if st not in ("confirmed", "packed"):
            raise HTTPException(400, "Only confirmed or packed orders can be shipped.")
        if not (upd.get("tracking_number") or o["tracking_number"]):
            raise HTTPException(400, "Please enter the courier and tracking number first.")
        upd |= {"status": "shipped", "shipped_at": now}
    elif a == "deliver":
        if st != "shipped":
            raise HTTPException(400, "Only shipped orders can be marked delivered.")
        upd |= {"status": "delivered", "delivered_at": now}
        if o["payment_status"] == "cod_pending":
            upd |= {"payment_status": "paid", "paid_at": now}
    elif a == "cancel":
        if st in ("shipped", "delivered", "cancelled"):
            raise HTTPException(400, "This order can't be cancelled now.")
        upd["status"] = "cancelled"
        if o["payment_status"] in ("pending", "cod_pending"):
            upd["payment_status"] = "failed"
    elif a == "review":
        upd["needs_review"] = False
    elif a == "refund":
        if o["payment_status"] != "paid":
            raise HTTPException(400, "Only paid orders can be marked refunded.")
        upd["payment_status"] = "refunded"

    if upd:
        db.table("orders").update(upd).eq("id", oid).execute()
    if a == "cancel":
        db.rpc("release_order_stock", {"p_order_id": oid}).execute()
    if a == "ship":
        background.add_task(notify.order_shipped, oid)
    return _with_blocked(db.table("orders").select(ORDER_FIELDS).eq("id", oid).execute().data)[0]


# ───────────── coupons ─────────────
class CouponIn(BaseModel):
    code: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_-]+$")
    discount_type: str = Field(pattern="^(percent|flat)$")
    value: int = Field(gt=0)
    min_order: int = Field(default=0, ge=0)
    max_discount: int | None = Field(default=None, gt=0)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    usage_limit: int | None = Field(default=None, gt=0)
    is_active: bool = True


def _coupon_row(body: CouponIn) -> dict:
    if body.discount_type == "percent" and body.value > 90:
        raise HTTPException(400, "Percent discount can be at most 90%.")
    if body.starts_at and body.ends_at and body.ends_at <= body.starts_at:
        raise HTTPException(400, "End date must be after the start date.")
    row = body.model_dump(mode="json")
    row["code"] = body.code.upper()
    return row


@router.get("/coupons")
def list_coupons():
    return get_db().table("coupons").select("*").order("created_at", desc=True).execute().data


@router.post("/coupons")
def create_coupon(body: CouponIn):
    try:
        return get_db().table("coupons").insert(_coupon_row(body)).execute().data[0]
    except HTTPException:
        raise
    except Exception as e:
        if "duplicate" in str(e):
            raise HTTPException(400, "A coupon with this code already exists.")
        raise


@router.put("/coupons/{cid}")
def update_coupon(cid: str, body: CouponIn):
    try:
        rows = get_db().table("coupons").update(_coupon_row(body)).eq("id", cid).execute().data
    except HTTPException:
        raise
    except Exception as e:
        if "duplicate" in str(e):
            raise HTTPException(400, "A coupon with this code already exists.")
        raise
    if not rows:
        raise HTTPException(404, "Coupon not found.")
    return rows[0]


@router.delete("/coupons/{cid}")
def delete_coupon(cid: str):
    get_db().table("coupons").delete().eq("id", cid).execute()
    return {"ok": True}


# ───────────── store settings ─────────────
@router.get("/settings")
def get_store_settings():
    from .. import store
    return store.current()


@router.put("/settings")
def put_store_settings(body: dict):
    from .. import store
    clean = {}
    if "banners" in body:
        base = f"{get_settings().supabase_url}/storage/v1/object/public/{BUCKET}/banners/"
        out = []
        for b in (body.get("banners") or [])[:8]:
            url, link = str(b.get("url", "")), str(b.get("link") or "/shop")
            if not url.startswith(base):
                raise HTTPException(400, "Banner photo must be uploaded from this admin page.")
            if not re.fullmatch(r"/[A-Za-z0-9/_?=&#-]*", link):
                raise HTTPException(400, "Banner link must be a page of this shop, e.g. /bridal")
            out.append({"url": url, "link": link, "alt": str(b.get("alt") or "")[:120],
                        "w": int(b.get("w") or 0), "h": int(b.get("h") or 0)})
        clean["banners"] = out
    if "hero" in body:
        h, base = body.get("hero") or {}, f"{get_settings().supabase_url}/storage/v1/object/public/{BUCKET}/banners/"
        bg = h.get("bg") if h.get("bg") in ("design", "photo", "colour") else "design"
        url = str(h.get("bg_url") or "")
        if bg == "photo" and not url.startswith(base):
            raise HTTPException(400, "Upload the background photo from this page first.")
        colour = str(h.get("bg_colour") or "")
        if colour and not re.fullmatch(r"#[0-9A-Fa-f]{6}", colour):
            raise HTTPException(400, "Background colour should look like #5E1A73.")
        link = lambda v, d: v if isinstance(v, str) and re.fullmatch(r"/[A-Za-z0-9/_?=&#-]*", v) else d  # noqa: E731
        txt = lambda k, n: str(h.get(k) or "").strip()[:n]  # noqa: E731
        clean["hero"] = {"bg": bg, "bg_url": url if bg == "photo" else "", "bg_colour": colour,
                         "dark": max(0, min(80, int(h.get("dark") or 0))), "mandala": bool(h.get("mandala", True)),
                         "eyebrow": txt("eyebrow", 80), "title": txt("title", 90), "subtitle": txt("subtitle", 200),
                         "btn1": txt("btn1", 30), "btn1_link": link(h.get("btn1_link"), "/collections/sarees"),
                         "btn2": txt("btn2", 30), "btn2_link": link(h.get("btn2_link"), "/bridal")}
    if "slide_seconds" in body:
        try:
            clean["slide_seconds"] = max(2, min(15, int(body["slide_seconds"])))
        except (TypeError, ValueError):
            raise HTTPException(400, "Seconds per slide must be a number.")
    for k, v in body.items():
        if k in store.NUMBER_FIELDS:
            lo, hi = store.NUMBER_FIELDS[k]
            try:
                n = int(v)
            except (TypeError, ValueError):
                raise HTTPException(400, f"{k.replace('_', ' ').capitalize()} must be a whole number.")
            if not lo <= n <= hi:
                raise HTTPException(400, f"{k.replace('_', ' ').capitalize()} must be between {lo} and {hi}.")
            clean[k] = n
        elif k in store.TEXT_FIELDS:
            t = str(v or "").strip()[: store.TEXT_FIELDS[k]]
            if k == "whatsapp" and t:
                t = re.sub(r"\D", "", t)
                if len(t) == 10:
                    t = "91" + t
                if not re.fullmatch(r"91[6-9]\d{9}", t):
                    raise HTTPException(400, "WhatsApp number should be a 10-digit Indian mobile number.")
            if k == "gstin" and t:
                t = t.upper()
                if not re.fullmatch(r"\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]", t):
                    raise HTTPException(400, "GSTIN should be 15 characters, like 36ABCDE1234F1Z5.")
            if k in ("call_start", "call_end") and t and not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", t):
                raise HTTPException(400, "Call hours should look like 11:00 or 19:30.")
            if k == "call_days" and t and not re.fullmatch(r"[1-7](,[1-7])*", t):
                raise HTTPException(400, "Choose at least one day for video calls.")
            if k == "shop_pin" and t and not re.fullmatch(r"[1-9]\d{5}", t):
                raise HTTPException(400, "Shop PIN must be 6 digits.")
            if k == "email" and t and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", t):
                raise HTTPException(400, "Shop email doesn't look right.")
            if k in ("instagram", "facebook") and t and not t.startswith("https://"):
                raise HTTPException(400, f"{k.capitalize()} link must start with https://")
            clean[k] = t
    try:
        return store.save(clean)
    except Exception as e:
        if "store_settings" in str(e):
            raise HTTPException(500, "Settings table missing — run supabase/migrations/003_store_settings.sql.")
        raise


@router.post("/banners")
async def upload_banner(file: UploadFile = File(...)):
    """Home page banner photo (wide, e.g. 1920×850). Stored under banners/; added to the list when settings are saved."""
    data = await file.read(MAX_IMAGE + 1)
    if len(data) > MAX_IMAGE:
        raise HTTPException(400, "Banner is larger than 5 MB.")
    kind = image_kind(data)
    if not kind:
        raise HTTPException(400, "Only JPG, PNG or WebP photos are allowed.")
    path = f"banners/{uuid.uuid4().hex}.{kind}"
    get_db().storage.from_(BUCKET).upload(path, data, {"content-type": f"image/{'jpeg' if kind == 'jpg' else kind}"})
    return {"url": f"{get_settings().supabase_url}/storage/v1/object/public/{BUCKET}/{path}"}


# ───────────── product video ─────────────
MAX_VIDEO = 50 * 1024 * 1024  # Supabase free plan: 50 MB per file


def video_kind(head: bytes) -> str | None:
    if head[4:8] == b"ftyp":
        return "mov" if head[8:10] == b"qt" else "mp4"
    if head[:4] == b"\x1a\x45\xdf\xa3":
        return "webm"
    return None


@router.post("/products/{pid}/video")
async def upload_video(pid: str, file: UploadFile = File(...)):
    _product(pid)
    data = await file.read(MAX_VIDEO + 1)
    if len(data) > MAX_VIDEO:
        raise HTTPException(400, "Video is larger than 50 MB. Record a shorter clip (30–60 seconds) or send it to yourself on WhatsApp first to make it smaller.")
    kind = video_kind(data[:16])
    if not kind:
        raise HTTPException(400, "Please upload an MP4, MOV or WebM video.")
    path = f"videos/{pid}/{uuid.uuid4().hex}.{kind}"
    ctype = {"mp4": "video/mp4", "mov": "video/quicktime", "webm": "video/webm"}[kind]
    get_db().storage.from_(BUCKET).upload(path, data, {"content-type": ctype})
    url = f"{get_settings().supabase_url}/storage/v1/object/public/{BUCKET}/{path}"
    get_db().table("products").update({"video_url": url}).eq("id", pid).execute()
    return _product(pid)


@router.delete("/products/{pid}/video")
def remove_video(pid: str):
    p = _product(pid)
    url = (p.get("details") or {}).get("video_url") or ""
    get_db().table("products").update({"video_url": None}).eq("id", pid).execute()
    if f"/{BUCKET}/videos/" in url:
        try:
            get_db().storage.from_(BUCKET).remove([url.split(f"/{BUCKET}/", 1)[1]])
        except Exception:
            pass
    return _product(pid)


# ───────────── categories ─────────────
class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    description: str | None = Field(default=None, max_length=200)
    sort_order: int = 0
    is_active: bool = True


@router.get("/categories/all")
def categories_with_counts():
    db = get_db()
    cats = db.table("categories").select("id,slug,name,description,sort_order,is_active").order("sort_order").execute().data
    counts: dict[str, int] = {}
    for p in db.table("products").select("category_id").execute().data:
        counts[p["category_id"]] = counts.get(p["category_id"], 0) + 1
    return [c | {"products": counts.get(c["id"], 0)} for c in cats]


@router.post("/categories")
def create_category(body: CategoryIn):
    slug = slugify(body.name)
    if get_db().table("categories").select("id").eq("slug", slug).execute().data:
        raise HTTPException(400, "A category with this name already exists.")
    return get_db().table("categories").insert(body.model_dump() | {"slug": slug}).execute().data[0]


@router.put("/categories/{cid}")
def update_category(cid: str, body: CategoryIn):
    rows = get_db().table("categories").update(body.model_dump()).eq("id", cid).execute().data  # slug kept so links don't break
    if not rows:
        raise HTTPException(404, "Category not found.")
    return rows[0]


@router.delete("/categories/{cid}")
def delete_category(cid: str):
    db = get_db()
    if db.table("products").select("id").eq("category_id", cid).limit(1).execute().data:
        raise HTTPException(400, "This category still has products. Move or delete them first, or just hide the category.")
    db.table("categories").delete().eq("id", cid).execute()
    return {"ok": True}


# ───────────── quick stock / price edit ─────────────
class QuickVariant(BaseModel):
    id: str
    stock: int = Field(ge=0, le=100000)


class QuickEditIn(BaseModel):
    price: int | None = Field(default=None, gt=0)
    mrp: int | None = Field(default=None, ge=0)   # 0 = remove MRP
    variants: list[QuickVariant] = []


@router.patch("/products/{pid}/quick")
def quick_edit(pid: str, body: QuickEditIn):
    db, p = get_db(), _product(pid)
    price = body.price or p["price"]
    mrp = p["mrp"] if body.mrp is None else (body.mrp or None)
    if mrp and mrp < price:
        raise HTTPException(400, "MRP can't be lower than the price.")
    if body.price is not None or body.mrp is not None:
        db.table("products").update({"price": price, "mrp": mrp}).eq("id", pid).execute()
    own = {v["id"] for v in p["variants"]}
    for v in body.variants:
        if v.id in own:
            db.table("product_variants").update({"stock": v.stock}).eq("id", v.id).execute()
    return _product(pid)


# ───────────── photos by file name (SKU) ─────────────
@router.post("/images/by-sku")
async def upload_by_sku(file: UploadFile = File(...)):
    """File name = SKU, optionally followed by -1, -2… e.g. KPP-MAG-1.jpg → variant with SKU KPP-MAG."""
    name = (file.filename or "").rsplit("/", 1)[-1]
    stem = re.sub(r"\.(jpe?g|png|webp)$", "", name, flags=re.I)
    if stem == name:
        raise HTTPException(400, f"{name}: only JPG, PNG or WebP photos.")
    db = get_db()
    candidates = [stem, re.sub(r"[-_ ](\d{1,2})$", "", stem)]
    variant = None
    for sku in candidates:
        literal = sku.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")  # match SKU exactly (case-insensitive)
        rows = db.table("product_variants").select("id,sku,color,product_id").ilike("sku", literal).limit(1).execute().data
        if rows:
            variant = rows[0]
            break
    if not variant:
        raise HTTPException(404, f"{name}: no product has SKU '{candidates[-1]}'.")
    data = await file.read(MAX_IMAGE + 1)
    colors = {v["color"] for v in db.table("product_variants").select("color").eq("product_id", variant["product_id"]).execute().data}
    img = store_image(variant["product_id"], data, variant["color"] if len(colors) > 1 else None)
    prod = db.table("products").select("name").eq("id", variant["product_id"]).execute().data[0]
    return {"file": name, "sku": variant["sku"], "product": prod["name"], "color": img["color"], "url": img["url"]}


# ───────────── sales charts ─────────────
@router.get("/stats/charts")
def stats_charts(days: int = 30):
    days = max(7, min(days, 90))
    db = get_db()
    today = datetime.now(IST).date()
    start = datetime.combine(today - timedelta(days=days - 1), datetime.min.time(), IST).astimezone(timezone.utc).isoformat()
    orders = (db.table("orders").select("created_at,total,status,payment_method,address,order_items(name,qty,price)")
              .gte("created_at", start).execute().data)
    live = [o for o in orders if o["status"] not in ("cancelled", "pending_payment")]
    by_day = {(today - timedelta(days=i)).isoformat(): {"orders": 0, "sales": 0} for i in range(days)}
    products: dict[str, dict] = {}
    states: dict[str, int] = {}
    pay = {"cod": 0, "razorpay": 0}
    for o in live:
        d = datetime.fromisoformat(o["created_at"]).astimezone(IST).date().isoformat()
        if d in by_day:
            by_day[d]["orders"] += 1
            by_day[d]["sales"] += o["total"]
        pay[o["payment_method"]] = pay.get(o["payment_method"], 0) + 1
        st = (o.get("address") or {}).get("state") or "Unknown"
        states[st] = states.get(st, 0) + 1
        for it in o["order_items"]:
            r = products.setdefault(it["name"], {"name": it["name"], "qty": 0, "sales": 0})
            r["qty"] += it["qty"]
            r["sales"] += it["qty"] * it["price"]
    return {
        "days": [{"date": k} | v for k, v in sorted(by_day.items())],
        "total_sales": sum(o["total"] for o in live),
        "total_orders": len(live),
        "avg_order": round(sum(o["total"] for o in live) / len(live)) if live else 0,
        "payment": pay,
        "top_products": sorted(products.values(), key=lambda r: -r["sales"])[:8],
        "states": sorted(({"state": k, "orders": v} for k, v in states.items()), key=lambda r: -r["orders"])[:8],
        "cancelled": sum(o["status"] == "cancelled" for o in orders),
    }


# ───────────── customers ─────────────
@router.get("/customers")
def customers(q: str | None = None):
    db = get_db()
    rows, start = [], 0
    while True:
        batch = (db.table("orders").select("phone,customer_name,email,total,status,created_at,user_id,address")
                 .order("created_at", desc=True).range(start, start + 999).execute().data)
        rows += batch
        if len(batch) < 1000:
            break
        start += 1000
    people: dict[str, dict] = {}
    for o in rows:  # newest first → first seen = latest name/email/city
        c = people.setdefault(o["phone"], {"phone": o["phone"], "name": o["customer_name"], "email": o["email"],
                                           "city": (o.get("address") or {}).get("city"), "orders": 0, "spent": 0,
                                           "cancelled": 0, "last_order": o["created_at"], "has_account": False})
        if o["status"] == "cancelled":
            c["cancelled"] += 1
        elif o["status"] != "pending_payment":
            c["orders"] += 1
            c["spent"] += o["total"]
        c["has_account"] = c["has_account"] or bool(o["user_id"])
        c["email"] = c["email"] or o["email"]
    blocked = {r["phone"] for r in db.table("blocked_phones").select("phone").execute().data}
    out = [c | {"cod_blocked": c["phone"] in blocked} for c in people.values()]
    if q and q.strip():
        t = q.strip().lower()
        out = [c for c in out if t in (c["name"] or "").lower() or t in c["phone"] or t in (c["email"] or "").lower()]
    return sorted(out, key=lambda c: -c["spent"])


# ───────────── staff / admins ─────────────
class StaffIn(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    admin: bool | None = None                       # older clients
    role: str | None = Field(default=None, pattern="^(admin|packer|customer)$")


@router.get("/staff")
def staff():
    return get_db().table("profiles").select("id,email,full_name,role,created_at").in_("role", ["admin", "packer"]).order("created_at").execute().data


@router.put("/staff")
def set_staff(body: StaffIn, me: dict = Depends(require_admin)):
    db = get_db()
    rows = db.table("profiles").select("id,email,role").ilike("email", body.email.strip()).limit(1).execute().data
    if not rows:
        raise HTTPException(404, "No account with this email yet. Ask them to sign in on the website once, then try again.")
    p = rows[0]
    role = body.role or ("admin" if body.admin else "customer")
    if role != "admin" and p["role"] == "admin":
        if p["id"] == me["id"]:
            raise HTTPException(400, "You can't remove your own admin access.")
        if len([s for s in staff() if s["role"] == "admin"]) <= 1:
            raise HTTPException(400, "There must be at least one admin.")
    db.table("profiles").update({"role": role}).eq("id", p["id"]).execute()
    return staff()
