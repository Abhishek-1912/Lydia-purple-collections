"""Bridal video-call booking: public slot list + booking, admin confirm/complete/cancel."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from .. import booking, guard, store
from ..auth import require_admin
from ..db import get_db

router = APIRouter(prefix="/api", tags=["video-calls"])
limiter = guard.RateLimiter(5, 3600)


def _taken() -> set[str]:
    now = datetime.now(timezone.utc)
    rows = (get_db().table("video_calls").select("slot").in_("status", ["requested", "confirmed"])
            .gte("slot", now.isoformat()).execute().data)
    return {datetime.fromisoformat(r["slot"]).astimezone(timezone.utc).isoformat() for r in rows}


@router.get("/video-calls/slots")
def slots():
    cfg = store.current()
    if not int(cfg.get("call_enabled") or 0):
        return {"enabled": False, "days": []}
    return {"enabled": True, "slot_minutes": int(cfg.get("call_slot") or 30),
            "days": booking.upcoming(cfg, datetime.now(booking.IST), _taken())}


class CallIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(pattern=r"^[6-9][0-9]{9}$")
    email: str | None = Field(default=None, max_length=200, pattern=r"^$|^[^@\s]+@[^@\s]+\.[^@\s]+$")
    slot: str
    product_slug: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=500)


@router.post("/video-calls")
def book(body: CallIn, request: Request, background: BackgroundTasks):
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0].strip()
    if not limiter.allow(ip):
        raise HTTPException(429, "Too many bookings from this connection. Please message us on WhatsApp.")
    cfg = store.current()
    if not int(cfg.get("call_enabled") or 0):
        raise HTTPException(400, "Video-call booking is closed right now. Please message us on WhatsApp.")
    try:
        slot = datetime.fromisoformat(body.slot).astimezone(timezone.utc)
    except ValueError:
        raise HTTPException(400, "Please choose a time.")
    offered = {s["start"] for d in booking.upcoming(cfg, datetime.now(booking.IST), set()) for s in d["slots"] if s["free"]}
    if slot.isoformat() not in offered:
        raise HTTPException(400, "That time is not available. Please choose another.")
    pid = None
    if body.product_slug:
        p = get_db().table("products").select("id,name").eq("slug", body.product_slug).limit(1).execute().data
        pid = p[0]["id"] if p else None
    try:
        row = get_db().table("video_calls").insert({
            "name": body.name.strip(), "phone": body.phone, "email": (body.email or "").strip() or None,
            "slot": slot.isoformat(), "product_id": pid, "note": (body.note or "").strip() or None}).execute().data[0]
    except Exception as e:
        if "video_calls_slot_active" in str(e) or "duplicate" in str(e):
            raise HTTPException(409, "Someone just booked that time. Please choose another.")
        raise
    background.add_task(_notify_shop, row)
    return {"ok": True, "id": row["id"], "slot": row["slot"]}


def _notify_shop(row: dict) -> None:
    from ..notify import send_email
    from ..config import get_settings
    to = store.current().get("email") or get_settings().shop_email
    when = datetime.fromisoformat(row["slot"]).astimezone(booking.IST).strftime("%a %d %b, %I:%M %p")
    send_email(to, f"📹 Video call request — {row['name']}, {when}",
               f"<p><b>{row['name']}</b> (+91 {row['phone']}) wants a video call on <b>{when}</b>.</p>"
               f"<p>{row.get('note') or ''}</p><p>Confirm it in Admin → Video calls.</p>")


# ───────────── admin ─────────────
@router.get("/admin/video-calls", dependencies=[Depends(require_admin)])
def list_calls(show: str = "upcoming"):
    q = get_db().table("video_calls").select("*,products(name,slug)").order("slot")
    if show == "upcoming":
        q = q.in_("status", ["requested", "confirmed"]).gte("slot", (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat())
    return q.limit(200).execute().data


class CallUpdate(BaseModel):
    status: str | None = Field(default=None, pattern="^(requested|confirmed|done|cancelled)$")
    link: str | None = Field(default=None, max_length=300)


@router.patch("/admin/video-calls/{cid}", dependencies=[Depends(require_admin)])
def update_call(cid: str, body: CallUpdate):
    upd = body.model_dump(exclude_none=True)
    if "link" in upd and upd["link"] and not upd["link"].startswith("https://"):
        raise HTTPException(400, "The call link should start with https:// (e.g. a Google Meet link).")
    rows = get_db().table("video_calls").update(upd).eq("id", cid).execute().data
    if not rows:
        raise HTTPException(404, "Not found.")
    return rows[0]
