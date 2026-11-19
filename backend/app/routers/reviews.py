"""Customer reviews (verified buyers only, shown after admin approval) and wishlists."""
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ..auth import require_admin, require_user
from ..db import get_db
from ..routers.admin import BUCKET, MAX_IMAGE, image_kind
from ..config import get_settings
from .. import services

router = APIRouter(prefix="/api", tags=["reviews"])
REVIEW_FIELDS = "id,name,rating,title,body,photos,reply,created_at,order_id"


def _product_id(slug: str) -> str:
    rows = get_db().table("products").select("id").eq("slug", slug).eq("is_active", True).limit(1).execute().data
    if not rows:
        raise HTTPException(404, "Product not found.")
    return rows[0]["id"]


def summarize(ratings: list[int]) -> dict:
    n = len(ratings)
    return {"count": n, "average": round(sum(ratings) / n, 1) if n else 0,
            "stars": {s: sum(1 for r in ratings if r == s) for s in range(5, 0, -1)}}


@router.get("/products/{slug}/reviews")
def product_reviews(slug: str):
    pid = _product_id(slug)
    rows = (get_db().table("reviews").select(REVIEW_FIELDS).eq("product_id", pid).eq("status", "approved")
            .order("created_at", desc=True).limit(100).execute().data)
    for r in rows:
        r["verified"] = bool(r.pop("order_id"))
    return {"summary": summarize([r["rating"] for r in rows]), "reviews": rows}


def _bought(user: dict, product_id: str) -> str | None:
    """Order id if this signed-in customer bought the product (by account, phone or email)."""
    db = get_db()
    prof = db.table("profiles").select("phone,email").eq("id", user["id"]).execute().data
    phone = (prof[0].get("phone") if prof else None)
    email = user.get("email") or (prof[0].get("email") if prof else None)
    q = (db.table("order_items").select("order_id,orders!inner(user_id,phone,email,status)")
         .eq("product_id", product_id).limit(200).execute().data)
    for it in q:
        o = it["orders"]
        if o["status"] in ("cancelled", "pending_payment"):
            continue
        if o["user_id"] == user["id"] or (phone and o["phone"] == phone) or (email and (o["email"] or "").lower() == email.lower()):
            return it["order_id"]
    return None


@router.get("/products/{slug}/can-review")
def can_review(slug: str, user: dict = Depends(require_user)):
    pid = _product_id(slug)
    mine = get_db().table("reviews").select("id,status").eq("product_id", pid).eq("user_id", user["id"]).execute().data
    return {"bought": bool(_bought(user, pid)), "already": mine[0]["status"] if mine else None}


@router.post("/products/{slug}/reviews")
async def add_review(slug: str, rating: int = Form(...), title: str = Form(""), body: str = Form(""),
                     name: str = Form(""), photos: list[UploadFile] = File(default=[]),
                     user: dict = Depends(require_user)):
    pid = _product_id(slug)
    if not 1 <= rating <= 5:
        raise HTTPException(400, "Please choose 1 to 5 stars.")
    if len(body.strip()) < 10:
        raise HTTPException(400, "Please write a few words (at least 10 letters) about the product.")
    db = get_db()
    if db.table("reviews").select("id").eq("product_id", pid).eq("user_id", user["id"]).execute().data:
        raise HTTPException(400, "You have already reviewed this product. Thank you!")
    order_id = _bought(user, pid)
    if not order_id:
        raise HTTPException(403, "Only customers who bought this product can review it.")
    urls = []
    for f in photos[:3]:
        data = await f.read(MAX_IMAGE + 1)
        if len(data) > MAX_IMAGE:
            raise HTTPException(400, "Each photo must be under 5 MB.")
        kind = image_kind(data)
        if not kind:
            raise HTTPException(400, "Photos must be JPG, PNG or WebP.")
        path = f"reviews/{uuid.uuid4().hex}.{kind}"
        db.storage.from_(BUCKET).upload(path, data, {"content-type": f"image/{'jpeg' if kind == 'jpg' else kind}"})
        urls.append(f"{get_settings().supabase_url}/storage/v1/object/public/{BUCKET}/{path}")
    prof = db.table("profiles").select("full_name").eq("id", user["id"]).execute().data
    display = (name.strip() or (prof[0]["full_name"] if prof else "") or "Customer")[:40]
    db.table("reviews").insert({"product_id": pid, "user_id": user["id"], "order_id": order_id, "name": display,
                                "rating": rating, "title": title.strip()[:100] or None, "body": body.strip()[:2000],
                                "photos": urls}).execute()
    return {"ok": True, "message": "Thank you! Your review will appear after we check it."}


# ───────────── admin moderation ─────────────
@router.get("/admin/reviews", dependencies=[Depends(require_admin)])
def admin_reviews(status: str = "pending"):
    q = get_db().table("reviews").select("*,products(name,slug)").order("created_at", desc=True).limit(200)
    if status != "all":
        q = q.eq("status", status)
    return q.execute().data


@router.patch("/admin/reviews/{rid}", dependencies=[Depends(require_admin)])
def moderate(rid: str, body: dict):
    upd = {}
    if body.get("status") in ("pending", "approved", "rejected"):
        upd["status"] = body["status"]
    if "reply" in body:
        upd["reply"] = (str(body["reply"] or "").strip()[:1000]) or None
    if not upd:
        raise HTTPException(400, "Nothing to change.")
    rows = get_db().table("reviews").update(upd).eq("id", rid).execute().data
    if not rows:
        raise HTTPException(404, "Review not found.")
    return rows[0]


@router.delete("/admin/reviews/{rid}", dependencies=[Depends(require_admin)])
def delete_review(rid: str):
    get_db().table("reviews").delete().eq("id", rid).execute()
    return {"ok": True}


# ───────────── wishlist ─────────────
@router.get("/me/wishlist")
def my_wishlist(user: dict = Depends(require_user)):
    ids = [r["product_id"] for r in get_db().table("wishlists").select("product_id").eq("user_id", user["id"])
           .order("created_at", desc=True).execute().data]
    by_id = {p["id"]: p for p in services.all_products()}
    return [by_id[i] for i in ids if i in by_id]


@router.put("/me/wishlist/{product_id}")
def add_wish(product_id: str, user: dict = Depends(require_user)):
    try:
        get_db().table("wishlists").upsert({"user_id": user["id"], "product_id": product_id}).execute()
    except Exception:
        raise HTTPException(404, "Product not found.")
    return {"ok": True}


@router.delete("/me/wishlist/{product_id}")
def remove_wish(product_id: str, user: dict = Depends(require_user)):
    get_db().table("wishlists").delete().eq("user_id", user["id"]).eq("product_id", product_id).execute()
    return {"ok": True}


@router.post("/me/wishlist/merge")
def merge_wish(body: dict, user: dict = Depends(require_user)):
    ids = [str(i) for i in (body.get("product_ids") or [])][:100]
    valid = {p["id"] for p in services.all_products()}
    rows = [{"user_id": user["id"], "product_id": i} for i in ids if i in valid]
    if rows:
        get_db().table("wishlists").upsert(rows).execute()
    return {"ok": True}
