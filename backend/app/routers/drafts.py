"""Abandoned checkouts: the checkout page saves a draft once a valid mobile is entered;
admin sees drafts that never became orders and can send a WhatsApp reminder with a cart-restore link."""
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from .. import guard
from ..auth import optional_user, require_admin
from ..db import get_db

router = APIRouter(prefix="/api", tags=["drafts"])
limiter = guard.RateLimiter(60, 3600)


class DraftItem(BaseModel):
    variant_id: str
    qty: int = Field(ge=1, le=10)
    name: str = Field(default="", max_length=200)
    price: int = Field(default=0, ge=0)


class DraftIn(BaseModel):
    session_id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(default="", max_length=100)
    phone: str = Field(pattern=r"^[6-9][0-9]{9}$")
    email: str = Field(default="", max_length=200)
    items: list[DraftItem] = Field(min_length=1, max_length=50)


@router.post("/checkout/draft")
def save_draft(body: DraftIn, request: Request, user: dict | None = Depends(optional_user)):
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0].strip()
    if not limiter.allow(ip):
        return {"ok": False}
    items = [i.model_dump() for i in body.items]
    row = {"session_id": body.session_id, "name": body.name.strip() or None, "phone": body.phone,
           "email": body.email.strip() or None, "items": items, "subtotal": sum(i["price"] * i["qty"] for i in items),
           "updated_at": datetime.now(timezone.utc).isoformat()}
    if user:
        row["user_id"] = user["id"]
    db = get_db()
    existing = db.table("checkout_drafts").select("id,order_id").eq("session_id", body.session_id).execute().data
    if existing and existing[0]["order_id"]:
        # they ordered before and came back with a new cart → start a fresh draft
        db.table("checkout_drafts").update({"session_id": f"{body.session_id}-{existing[0]['id'][:8]}"}).eq("id", existing[0]["id"]).execute()
        existing = []
    if existing:
        db.table("checkout_drafts").update(row).eq("id", existing[0]["id"]).execute()
    else:
        db.table("checkout_drafts").insert(row).execute()
    return {"ok": True}


def mark_converted(session_id: str | None, order_id: str) -> None:
    """Called after an order is placed, so the draft no longer counts as abandoned."""
    if not session_id:
        return
    try:
        get_db().table("checkout_drafts").update({"order_id": order_id}).eq("session_id", session_id).is_("order_id", "null").execute()
    except Exception:
        pass


@router.get("/checkout/draft/{draft_id}/items")
def draft_items(draft_id: str):
    """Public (unguessable id): only the cart items, used by the reminder's 'restore my cart' link."""
    try:
        rows = get_db().table("checkout_drafts").select("items").eq("id", draft_id).limit(1).execute().data
    except Exception:
        rows = []
    if not rows:
        raise HTTPException(404, "This cart link has expired.")
    return [{"variant_id": i["variant_id"], "qty": i["qty"]} for i in rows[0]["items"]]


# ───────────── admin ─────────────
@router.get("/admin/abandoned", dependencies=[Depends(require_admin)])
def abandoned(days: int = 14, show: str = "open"):
    now = datetime.now(timezone.utc)
    q = (get_db().table("checkout_drafts").select("*").is_("order_id", "null")
         .lte("updated_at", (now - timedelta(minutes=30)).isoformat())
         .gte("updated_at", (now - timedelta(days=max(1, min(days, 60)))).isoformat())
         .order("updated_at", desc=True).limit(300))
    rows = q.execute().data
    if show == "open":
        rows = [r for r in rows if not r["contacted_at"]]
    return rows


@router.patch("/admin/abandoned/{draft_id}", dependencies=[Depends(require_admin)])
def mark_contacted(draft_id: str, body: dict):
    upd = {"contacted_at": datetime.now(timezone.utc).isoformat() if body.get("contacted", True) else None}
    rows = get_db().table("checkout_drafts").update(upd).eq("id", draft_id).execute().data
    if not rows:
        raise HTTPException(404, "Not found.")
    return rows[0]


@router.delete("/admin/abandoned/{draft_id}", dependencies=[Depends(require_admin)])
def dismiss(draft_id: str):
    get_db().table("checkout_drafts").delete().eq("id", draft_id).execute()
    return {"ok": True}


def auto_remind() -> int:
    """Automatic WhatsApp reminder for carts left 1–24 h ago. Switched OFF until
    WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_TEMPLATE_CART are set (Meta-approved template:
    'Hi {{1}}, you left {{2}} in your cart at Lydia Purple Collections. Complete your order: {{3}}')."""
    from ..config import get_settings
    from ..notify import send_whatsapp
    s = get_settings()
    if not (s.whatsapp_token and s.whatsapp_phone_number_id and s.whatsapp_template_cart and s.site_url):
        return 0
    now, sent = datetime.now(timezone.utc), 0
    rows = (get_db().table("checkout_drafts").select("id,name,phone,items").is_("order_id", "null")
            .is_("auto_reminded_at", "null").is_("contacted_at", "null")
            .lte("updated_at", (now - timedelta(hours=1)).isoformat())
            .gte("updated_at", (now - timedelta(hours=24)).isoformat()).limit(50).execute().data)
    for r in rows:
        first = (r["items"][0]["name"] if r["items"] else "your saree")[:60]
        more = f" and {len(r['items']) - 1} more" if len(r["items"]) > 1 else ""
        if send_whatsapp(r["phone"], s.whatsapp_template_cart, [r["name"] or "there", first + more, f"{s.site_url}/cart?restore={r['id']}"]):
            get_db().table("checkout_drafts").update({"auto_reminded_at": now.isoformat()}).eq("id", r["id"]).execute()
            sent += 1
    return sent
