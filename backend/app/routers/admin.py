import csv
import io
import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .. import notify, services
from ..auth import require_admin
from ..config import get_settings
from ..db import get_db
from ..importer import run_import

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])
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
@router.get("/stats")
def stats():
    db = get_db()
    start = datetime.now(IST).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc).isoformat()
    today = db.table("orders").select("total,status").gte("created_at", start).execute().data
    live = [o for o in today if o["status"] not in ("cancelled", "pending_payment")]
    count = lambda **f: len(db.table("orders").select("id").match(f).execute().data)  # noqa: E731
    low = (db.table("product_variants").select("id,color,size,stock,products(id,name,is_active)")
           .lte("stock", 2).order("stock").execute().data)
    return {
        "orders_today": len(live),
        "sales_today": sum(o["total"] for o in live),
        "to_pack": count(status="confirmed"),
        "to_ship": count(status="packed"),
        "needs_review": count(needs_review=True),
        "low_stock": [{"product_id": v["products"]["id"], "name": v["products"]["name"], "color": v["color"],
                       "size": v["size"], "stock": v["stock"]}
                      for v in low if v.get("products") and v["products"]["is_active"]],
    }


# ───────────── products ─────────────
class VariantIn(BaseModel):
    id: str | None = None
    color: str = Field(default="", max_length=60)
    color_hex: str | None = Field(default=None, pattern=r"^$|^#[0-9A-Fa-f]{6}$")
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


def _save_variants(product_id: str, variants: list[VariantIn]):
    db = get_db()
    keep = [v.id for v in variants if v.id]
    current = [r["id"] for r in db.table("product_variants").select("id").eq("product_id", product_id).execute().data]
    gone = [i for i in current if i not in keep]
    if gone:
        db.table("product_variants").delete().in_("id", gone).execute()
    for v in variants:
        row = {"product_id": product_id, "color": v.color.strip(), "color_hex": v.color_hex or None,
               "size": v.size.strip(), "sku": (v.sku or "").strip() or None, "stock": v.stock}
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
        _save_variants(pid, body.variants)
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
        _save_variants(pid, body.variants)
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


class OrderAction(BaseModel):
    action: str = Field(pattern="^(tracking|pack|ship|deliver|cancel|review|refund)$")
    courier: str | None = Field(default=None, max_length=60)
    tracking_number: str | None = Field(default=None, max_length=80)


@router.patch("/orders/{oid}")
def update_order(oid: str, body: OrderAction, background: BackgroundTasks):
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
