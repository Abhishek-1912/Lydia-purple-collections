"""Outside services that switch on when their keys are added: Shiprocket (courier), Razorpay refunds,
WhatsApp broadcasts. Payload builders are pure and tested; network calls run only when configured."""
import time

import httpx

from .config import get_settings

SR = "https://apiv2.shiprocket.in/v1/external"
_sr_token = {"value": "", "at": 0.0}


# ───────────── Shiprocket ─────────────
def shiprocket_enabled() -> bool:
    s = get_settings()
    return bool(s.shiprocket_email and s.shiprocket_password and s.shiprocket_pickup)


def _sr_headers() -> dict:
    s = get_settings()
    if not _sr_token["value"] or time.time() - _sr_token["at"] > 8 * 24 * 3600:   # tokens last 10 days
        r = httpx.post(f"{SR}/auth/login", json={"email": s.shiprocket_email, "password": s.shiprocket_password}, timeout=20)
        r.raise_for_status()
        _sr_token.update(value=r.json()["token"], at=time.time())
    return {"Authorization": f"Bearer {_sr_token['value']}"}


def shiprocket_payload(o: dict, pickup: str, weight_kg: float, dims_cm: tuple[int, int, int]) -> dict:
    a = o.get("address") or {}
    cod = o["payment_method"] == "cod" and o["payment_status"] != "paid"
    return {
        "order_id": f"LPC{o['order_no']}", "order_date": o["created_at"][:16].replace("T", " "),
        "pickup_location": pickup,
        "billing_customer_name": o["customer_name"], "billing_last_name": "",
        "billing_address": a.get("line1", ""), "billing_address_2": ", ".join(x for x in (a.get("line2"), a.get("landmark") and "Near " + a["landmark"]) if x),
        "billing_city": a.get("city", ""), "billing_pincode": a.get("pin", ""), "billing_state": a.get("state", ""),
        "billing_country": "India", "billing_email": o.get("email") or "", "billing_phone": o["phone"],
        "shipping_is_billing": True,
        "order_items": [{"name": i["name"][:100], "sku": (i.get("sku") or f"ITEM-{n + 1}"), "units": i["qty"], "selling_price": i["price"]}
                        for n, i in enumerate(o["order_items"])],
        "payment_method": "COD" if cod else "Prepaid",
        "shipping_charges": o.get("shipping_fee") or 0, "total_discount": o.get("discount") or 0,
        "sub_total": o["total"] - (o.get("gift_amount") or 0) if cod else o["total"],
        "length": dims_cm[0], "breadth": dims_cm[1], "height": dims_cm[2], "weight": weight_kg,
    }


def shiprocket_book(o: dict) -> dict:
    s = get_settings()
    h = _sr_headers()
    body = shiprocket_payload(o, s.shiprocket_pickup, s.shiprocket_weight_kg, (30, 25, 5))
    r = httpx.post(f"{SR}/orders/create/adhoc", json=body, headers=h, timeout=30)
    r.raise_for_status()
    shipment_id = r.json().get("shipment_id")
    a = httpx.post(f"{SR}/courier/assign/awb", json={"shipment_id": shipment_id}, headers=h, timeout=30)
    a.raise_for_status()
    data = (a.json().get("response") or {}).get("data") or {}
    label = httpx.post(f"{SR}/courier/generate/label", json={"shipment_id": [shipment_id]}, headers=h, timeout=30)
    return {"shipment_id": str(shipment_id), "awb": data.get("awb_code"), "courier": data.get("courier_name"),
            "label_url": (label.json() or {}).get("label_url") if label.status_code < 300 else None}


def shiprocket_track(awb: str) -> str | None:
    r = httpx.get(f"{SR}/courier/track/awb/{awb}", headers=_sr_headers(), timeout=20)
    r.raise_for_status()
    t = (r.json().get("tracking_data") or {})
    acts = t.get("shipment_track") or [{}]
    return acts[0].get("current_status") or t.get("track_status")


# ───────────── Razorpay refunds ─────────────
def refund_paise(order_total: int, gift_amount: int, already: int, amount: int | None) -> int:
    """Rupees → paise for Razorpay, never more than what was paid online (gift-card part is not refundable here)."""
    paid_online = order_total - (gift_amount or 0) - (already or 0)
    want = paid_online if amount is None else amount
    if want <= 0 or want > paid_online:
        raise ValueError(f"Refund must be between ₹1 and ₹{paid_online}.")
    return want * 100


def razorpay_refund(payment_id: str, paise: int, note: str) -> dict:
    s = get_settings()
    r = httpx.post(f"https://api.razorpay.com/v1/payments/{payment_id}/refund", auth=(s.razorpay_key_id, s.razorpay_key_secret),
                   json={"amount": paise, "notes": {"reason": note[:200]}}, timeout=20)
    r.raise_for_status()
    return r.json()


# ───────────── WhatsApp broadcast ─────────────
def broadcast_enabled() -> bool:
    s = get_settings()
    return bool(s.whatsapp_token and s.whatsapp_phone_number_id)
