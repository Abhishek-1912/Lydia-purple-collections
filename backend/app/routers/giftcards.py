"""Gift cards / store credit, issued by the owner and used at checkout (redeemed inside place_order)."""
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import require_admin
from ..db import get_db

router = APIRouter(prefix="/api/admin/gift-cards", tags=["gift-cards"], dependencies=[Depends(require_admin)])
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I to avoid confusion


def new_code() -> str:
    part = lambda: "".join(secrets.choice(ALPHABET) for _ in range(4))  # noqa: E731
    return f"LPC-{part()}-{part()}"


class GiftIn(BaseModel):
    value: int = Field(gt=0, le=200000)
    issued_to: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, pattern=r"^$|^[6-9][0-9]{9}$")
    note: str | None = Field(default=None, max_length=200)
    expires_at: datetime | None = None
    code: str | None = Field(default=None, max_length=30, pattern=r"^$|^[A-Za-z0-9-]{4,30}$")


@router.get("")
def list_cards():
    cards = get_db().table("gift_cards").select("*").order("created_at", desc=True).limit(300).execute().data
    used = {}
    for o in get_db().table("orders").select("gift_code,gift_amount,status").not_.is_("gift_code", "null").execute().data:
        if o["status"] != "cancelled":
            used[o["gift_code"]] = used.get(o["gift_code"], 0) + 1
    return [c | {"orders": used.get(c["code"], 0)} for c in cards]


@router.post("")
def create(body: GiftIn):
    code = (body.code or "").strip().upper() or new_code()
    row = {"code": code, "initial_value": body.value, "balance": body.value, "issued_to": body.issued_to or None,
           "phone": body.phone or None, "note": body.note or None,
           "expires_at": body.expires_at.isoformat() if body.expires_at else None}
    try:
        return get_db().table("gift_cards").insert(row).execute().data[0]
    except Exception as e:
        if "duplicate" in str(e):
            raise HTTPException(400, "A gift card with this code already exists.")
        raise


class GiftUpdate(BaseModel):
    is_active: bool | None = None
    expires_at: datetime | None = None
    clear_expiry: bool = False
    note: str | None = Field(default=None, max_length=200)
    add: int | None = Field(default=None, ge=1, le=200000)   # top up


@router.patch("/{gid}")
def update(gid: str, body: GiftUpdate):
    db = get_db()
    rows = db.table("gift_cards").select("balance,initial_value").eq("id", gid).execute().data
    if not rows:
        raise HTTPException(404, "Gift card not found.")
    upd = {}
    if body.is_active is not None:
        upd["is_active"] = body.is_active
    if body.clear_expiry:
        upd["expires_at"] = None
    elif body.expires_at:
        upd["expires_at"] = body.expires_at.isoformat()
    if body.note is not None:
        upd["note"] = body.note or None
    if body.add:
        upd["balance"] = rows[0]["balance"] + body.add
        upd["initial_value"] = rows[0]["initial_value"] + body.add
    if not upd:
        raise HTTPException(400, "Nothing to change.")
    return db.table("gift_cards").update(upd).eq("id", gid).execute().data[0]
