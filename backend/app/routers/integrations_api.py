"""Admin endpoints for courier booking, Razorpay refunds and WhatsApp broadcasts (each off until configured)."""
import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .. import integrations
from ..auth import admin_gate, require_admin
from ..config import get_settings
from ..db import get_db
from ..notify import send_whatsapp
from .admin import ORDER_FIELDS

router = APIRouter(prefix="/api/admin", tags=["integrations"])


def _order(oid: str) -> dict:
    rows = get_db().table("orders").select(ORDER_FIELDS + ",shipment_id,courier_status,refund_id,refund_amount").eq("id", oid).execute().data
    if not rows:
        raise HTTPException(404, "Order not found.")
    return rows[0]


@router.get("/integrations", dependencies=[Depends(admin_gate)])
def status():
    s = get_settings()
    return {"shiprocket": integrations.shiprocket_enabled(), "refunds": s.razorpay_enabled,
            "broadcast": integrations.broadcast_enabled()}


@router.post("/orders/{oid}/shiprocket", dependencies=[Depends(admin_gate)])
def book_courier(oid: str):
    if not integrations.shiprocket_enabled():
        raise HTTPException(400, "Shiprocket isn't set up yet. Add SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD and SHIPROCKET_PICKUP in Railway.")
    o = _order(oid)
    if o["status"] not in ("confirmed", "packed"):
        raise HTTPException(400, "Only confirmed or packed orders can be booked with the courier.")
    if o.get("shipment_id"):
        raise HTTPException(400, "This order is already booked with Shiprocket.")
    try:
        r = integrations.shiprocket_book(o)
    except Exception as e:
        raise HTTPException(502, f"Shiprocket refused the booking: {str(e)[:160]}")
    get_db().table("orders").update({"shipment_id": r["shipment_id"], "courier": r["courier"] or o.get("courier"),
                                      "tracking_number": r["awb"] or o.get("tracking_number"), "courier_status": "Booked"}).eq("id", oid).execute()
    return _order(oid) | {"label_url": r.get("label_url")}


@router.post("/orders/{oid}/track", dependencies=[Depends(admin_gate)])
def refresh_tracking(oid: str):
    if not integrations.shiprocket_enabled():
        raise HTTPException(400, "Shiprocket isn't set up yet.")
    o = _order(oid)
    if not o.get("tracking_number"):
        raise HTTPException(400, "No tracking number yet.")
    try:
        st = integrations.shiprocket_track(o["tracking_number"])
    except Exception as e:
        raise HTTPException(502, f"Couldn't get tracking from Shiprocket: {str(e)[:120]}")
    get_db().table("orders").update({"courier_status": st}).eq("id", oid).execute()
    return _order(oid)


class RefundIn(BaseModel):
    amount: int | None = Field(default=None, ge=1)   # rupees; blank = full online amount
    note: str = Field(default="Refund", max_length=200)


@router.post("/orders/{oid}/refund", dependencies=[Depends(require_admin)])
def refund(oid: str, body: RefundIn):
    if not get_settings().razorpay_enabled:
        raise HTTPException(400, "Razorpay isn't set up yet — refund from the Razorpay dashboard, then press Mark refunded.")
    o = _order(oid)
    if o["payment_method"] != "razorpay" or not o.get("razorpay_payment_id"):
        raise HTTPException(400, "Only orders paid online can be refunded here.")
    try:
        paise = integrations.refund_paise(o["total"], o.get("gift_amount") or 0, o.get("refund_amount") or 0, body.amount)
    except ValueError as e:
        raise HTTPException(400, str(e))
    try:
        r = integrations.razorpay_refund(o["razorpay_payment_id"], paise, body.note)
    except Exception as e:
        raise HTTPException(502, f"Razorpay refused the refund: {str(e)[:160]}")
    total_refunded = (o.get("refund_amount") or 0) + paise // 100
    full = total_refunded >= o["total"] - (o.get("gift_amount") or 0)
    get_db().table("orders").update({"refund_id": r.get("id"), "refund_amount": total_refunded,
                                      **({"payment_status": "refunded"} if full else {})}).eq("id", oid).execute()
    return _order(oid)


def _opted_in() -> list[dict]:
    try:
        rows = get_db().table("orders").select("customer_name,phone,created_at,status").eq("whatsapp_opt_in", True).order("created_at", desc=True).execute().data
    except Exception:
        return []   # migration 006 not run yet
    seen, out = set(), []
    for r in rows:
        if r["phone"] not in seen and r["status"] != "cancelled":
            seen.add(r["phone"]); out.append({"name": r["customer_name"], "phone": r["phone"]})
    return out


@router.get("/broadcast/audience", dependencies=[Depends(require_admin)])
def audience(format: str = "json"):
    people = _opted_in()
    if format == "csv":
        buf = io.StringIO(); w = csv.writer(buf); w.writerow(["Name", "WhatsApp"])
        for p in people:
            w.writerow([p["name"], "+91" + p["phone"]])
        return Response("﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                        headers={"Content-Disposition": 'attachment; filename="whatsapp-opt-in.csv"'})
    return {"count": len(people), "enabled": integrations.broadcast_enabled(), "sample": people[:5]}


class BroadcastIn(BaseModel):
    template: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9_]+$")
    params: list[str] = Field(default=[], max_length=5)
    test_phone: str | None = Field(default=None, pattern=r"^$|^[6-9][0-9]{9}$")


@router.post("/broadcast", dependencies=[Depends(require_admin)])
def broadcast(body: BroadcastIn):
    if not integrations.broadcast_enabled():
        raise HTTPException(400, "WhatsApp Cloud API isn't set up yet. Use the downloaded list in the WhatsApp Business app instead.")
    targets = [{"name": "Test", "phone": body.test_phone}] if body.test_phone else _opted_in()[:1000]
    sent = sum(1 for p in targets if send_whatsapp(p["phone"], body.template, [x.replace("{name}", p["name"] or "") for x in body.params]))
    return {"sent": sent, "failed": len(targets) - sent, "at": datetime.now(timezone.utc).isoformat()}
