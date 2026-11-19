import json
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from .. import guard, notify, razorpay_client, services
from ..auth import optional_user
from ..config import get_settings
from ..db import get_db
from ..schemas import AbandonIn, OrderIn, VerifyIn

log = logging.getLogger("checkout")
order_limiter = guard.RateLimiter(guard.MAX_ORDERS_PER_IP_HOUR, 3600)


def client_ip(request: Request) -> str:
    return request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0].strip()


def cod_check(phone: str) -> str | None:
    db = get_db()
    blocked = bool(db.table("blocked_phones").select("phone").eq("phone", phone).execute().data)
    open_cod = len(db.table("orders").select("id").eq("phone", phone).eq("payment_method", "cod")
                   .in_("status", ["confirmed", "packed"]).execute().data)
    return guard.cod_refusal(blocked, open_cod)
router = APIRouter(prefix="/api", tags=["checkout"])

PUBLIC_ORDER = (
    "id,order_no,customer_name,phone,email,address,subtotal,shipping_fee,cod_fee,discount,total,"
    "coupon_code,payment_method,payment_status,status,courier,tracking_number,created_at,razorpay_order_id,"
    "order_items(name,color,size,image_url,price,qty,product_id)"
)


def _order(order_id: str, fields: str = PUBLIC_ORDER) -> dict:
    try:
        rows = get_db().table("orders").select(fields).eq("id", order_id).limit(1).execute().data
    except Exception:
        rows = []  # malformed UUID
    if not rows:
        raise HTTPException(404, "Order not found.")
    return rows[0]


def release_expired() -> None:
    try:
        get_db().rpc("release_expired_orders", {"p_minutes": get_settings().payment_timeout_minutes}).execute()
    except Exception:
        log.exception("release_expired_orders failed")


def _cancel_unpaid(order_id: str) -> bool:
    """Cancel an unpaid online order and give its stock back. Safe to call twice."""
    rows = (get_db().table("orders").update({"status": "cancelled", "payment_status": "failed"})
            .eq("id", order_id).eq("status", "pending_payment").eq("payment_status", "pending")
            .execute().data)
    if rows:
        get_db().rpc("release_order_stock", {"p_order_id": order_id}).execute()
    return bool(rows)


@router.post("/orders")
def create_order(body: OrderIn, request: Request, background: BackgroundTasks, user: dict | None = Depends(optional_user)):
    s = get_settings()
    if not order_limiter.allow(client_ip(request)):
        raise HTTPException(429, "Too many orders from this connection. Please wait a while or message us on WhatsApp.")
    release_expired()
    if body.payment_method == "cod":
        refusal = cod_check(body.phone)
        if refusal:
            raise HTTPException(400, {"message": refusal, "code": "COD_REFUSED"})

    if body.payment_method == "razorpay" and not s.razorpay_enabled:
        raise HTTPException(400, "Online payment isn't available right now. Please choose Cash on Delivery.")

    q = services.quote([i.model_dump() for i in body.items], body.coupon_code, body.payment_method)
    if not q["ok"]:
        bad = next((l for l in q["lines"] if l.get("error")), None)
        raise HTTPException(409, {"message": (f"{bad.get('name', 'An item')}: {bad['error']}" if bad
                                              else "Your cart has changed. Please review it."), "code": "CART_CHANGED"})
    if q["coupon"] and not q["coupon"]["ok"]:
        raise HTTPException(400, {"message": q["coupon"]["message"], "code": "COUPON"})
    if body.payment_method == "cod" and not q["cod_allowed"]:
        raise HTTPException(400, {"message": q["cod_message"], "code": "COD_LIMIT"})

    order = {
        "user_id": user["id"] if user else None,
        "customer_name": body.name.strip(),
        "phone": body.phone,
        "email": (body.email or "").strip() or None,
        "address": body.address.model_dump(),
        "subtotal": q["subtotal"], "shipping_fee": q["shipping_fee"], "cod_fee": q["cod_fee"],
        "discount": q["discount"], "total": q["total"],
        "coupon_code": q["coupon"]["code"] if q["coupon"] else None,
        "payment_method": body.payment_method,
    }
    items = [{k: l[k] for k in ("variant_id", "product_id", "name", "color", "size", "price", "qty")}
             | {"image_url": l["image"]} for l in q["lines"]]

    try:
        placed = get_db().rpc("place_order", {"p_order": order, "p_items": items}).execute().data
    except Exception as e:
        msg = str(e)
        if "OUT_OF_STOCK" in msg:
            raise HTTPException(409, {"message": "Sorry, an item in your cart just sold out. Please review your cart.",
                                      "code": "OUT_OF_STOCK"})
        if "COUPON_LIMIT" in msg:
            raise HTTPException(400, {"message": "This coupon has just been fully used.", "code": "COUPON"})
        log.exception("place_order failed")
        raise HTTPException(500, "We couldn't place your order. Please try again.")

    order_id, order_no = placed["id"], placed["order_no"]
    result = {"id": order_id, "order_no": order_no, "payment_method": body.payment_method, "total": q["total"]}

    if body.payment_method == "cod":
        background.add_task(notify.order_confirmed, order_id)
        return result

    try:
        rp = razorpay_client.create_order(q["total"], f"LPC{order_no}", {"order_id": order_id})
    except Exception:
        log.exception("Razorpay create_order failed")
        _cancel_unpaid(order_id)
        raise HTTPException(502, "Online payment is not responding. Please try again or choose Cash on Delivery.")

    get_db().table("orders").update({"razorpay_order_id": rp["id"]}).eq("id", order_id).execute()
    result["razorpay"] = {
        "key_id": s.razorpay_key_id, "order_id": rp["id"], "amount": rp["amount"], "currency": "INR",
        "prefill": {"name": order["customer_name"], "contact": "+91" + body.phone, "email": order["email"] or ""},
    }
    return result


@router.post("/orders/{order_id}/verify-payment")
def verify_payment(order_id: str, body: VerifyIn, background: BackgroundTasks):
    o = _order(order_id, "id,razorpay_order_id")
    if not o["razorpay_order_id"] or o["razorpay_order_id"] != body.razorpay_order_id:
        raise HTTPException(400, "Payment does not match this order.")
    if not razorpay_client.verify_payment_signature(body.razorpay_order_id, body.razorpay_payment_id,
                                                    body.razorpay_signature, get_settings().razorpay_key_secret):
        raise HTTPException(400, "We couldn't verify this payment. If money was deducted, contact us on WhatsApp.")
    first = get_db().rpc("mark_order_paid", {"p_razorpay_order_id": body.razorpay_order_id,
                                             "p_payment_id": body.razorpay_payment_id}).execute().data
    if first:
        background.add_task(notify.order_confirmed, order_id)
    return _order(order_id)


@router.post("/orders/{order_id}/abandon")
def abandon(order_id: str, body: AbandonIn):
    o = _order(order_id, "id,razorpay_order_id")
    if not o["razorpay_order_id"] or o["razorpay_order_id"] != body.razorpay_order_id:
        raise HTTPException(400, "Payment does not match this order.")
    return {"cancelled": _cancel_unpaid(order_id)}


@router.get("/orders/{order_id}")
def get_order(order_id: str):
    o = _order(order_id)
    o.pop("razorpay_order_id", None)
    return o


@router.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request, background: BackgroundTasks):
    raw = await request.body()
    secret = get_settings().razorpay_webhook_secret
    if not razorpay_client.verify_webhook_signature(raw, request.headers.get("x-razorpay-signature", ""), secret):
        raise HTTPException(400, "Invalid signature")
    event = json.loads(raw)
    payload = event.get("payload", {})
    payment = (payload.get("payment") or {}).get("entity") or {}
    rp_order_id = payment.get("order_id") or ((payload.get("order") or {}).get("entity") or {}).get("id")
    if event.get("event") in ("payment.captured", "order.paid") and rp_order_id and payment.get("id"):
        first = get_db().rpc("mark_order_paid", {"p_razorpay_order_id": rp_order_id,
                                                 "p_payment_id": payment["id"]}).execute().data
        if first:
            background.add_task(notify.order_confirmed, first)
    return {"ok": True}
