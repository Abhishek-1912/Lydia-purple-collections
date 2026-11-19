"""Order alerts by email (Resend) and WhatsApp (Meta Cloud API templates).
Each channel switches off when its keys are blank. Every failure is logged and swallowed:
a failed message never blocks an order."""
import html
import logging

import httpx

from .config import get_settings
from .db import get_db
from .pricing import inr
from . import store

log = logging.getLogger("notify")
ORDER_FIELDS = ("id,order_no,customer_name,phone,email,address,subtotal,shipping_fee,cod_fee,discount,total,"
                "coupon_code,payment_method,payment_status,courier,tracking_number,gift_amount,order_items(name,color,size,price,qty)")


# ───────────── channels ─────────────
def send_email(to: str | list[str], subject: str, body_html: str, reply_to: str | None = None) -> bool:
    s = get_settings()
    to_list = [t for t in ([to] if isinstance(to, str) else to) if t]
    if not s.resend_api_key or not to_list:
        return False
    try:
        payload = {"from": s.email_from, "to": to_list, "subject": subject, "html": body_html}
        if reply_to:
            payload["reply_to"] = reply_to
        r = httpx.post("https://api.resend.com/emails", json=payload,
                       headers={"Authorization": f"Bearer {s.resend_api_key}"}, timeout=15)
        if r.status_code >= 300:
            log.warning("Resend %s: %s", r.status_code, r.text[:300])
            return False
        return True
    except Exception:
        log.exception("email failed")
        return False


def send_whatsapp(to_phone: str, template: str, params: list[str]) -> bool:
    s = get_settings()
    if not (s.whatsapp_token and s.whatsapp_phone_number_id and template and to_phone):
        return False
    to = to_phone if len(to_phone) > 10 else "91" + to_phone
    try:
        r = httpx.post(
            f"https://graph.facebook.com/v21.0/{s.whatsapp_phone_number_id}/messages",
            headers={"Authorization": f"Bearer {s.whatsapp_token}"},
            json={"messaging_product": "whatsapp", "to": to, "type": "template",
                  "template": {"name": template, "language": {"code": "en"},
                               "components": [{"type": "body", "parameters": [{"type": "text", "text": p[:200]} for p in params]}]}},
            timeout=15,
        )
        if r.status_code >= 300:
            log.warning("WhatsApp %s: %s", r.status_code, r.text[:300])
            return False
        return True
    except Exception:
        log.exception("whatsapp failed")
        return False


# ───────────── templates ─────────────
def _wrap(title: str, inner: str) -> str:
    return f"""<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#2A1F2D">
  <div style="background:#2E0B3D;color:#EAD796;padding:18px;text-align:center;font-size:20px;letter-spacing:2px">LYDIA PURPLE COLLECTIONS</div>
  <div style="border:1px solid #EAD796;border-top:0;padding:20px">
    <h2 style="color:#5E1A73;margin-top:0">{html.escape(title)}</h2>{inner}
  </div>
  <p style="font-size:12px;color:#6E6372;text-align:center">Prices include GST. Questions? Just reply to this email or message us on WhatsApp.</p>
</div>"""


def _order_table(o: dict) -> str:
    e = html.escape
    rows = "".join(
        f"<tr><td style='padding:6px 0'>{e(i['name'])}{(' (' + e(' / '.join(x for x in (i['color'], i['size']) if x)) + ')') if (i['color'] or i['size']) else ''} × {i['qty']}</td>"
        f"<td style='text-align:right'>{inr(i['price'] * i['qty'])}</td></tr>" for i in o["order_items"])
    extra = ""
    if o["discount"]:
        extra += f"<tr><td>Discount ({e(o['coupon_code'] or '')})</td><td style='text-align:right'>−{inr(o['discount'])}</td></tr>"
    extra += f"<tr><td>Shipping</td><td style='text-align:right'>{inr(o['shipping_fee']) if o['shipping_fee'] else 'Free'}</td></tr>"
    if o["cod_fee"]:
        extra += f"<tr><td>COD handling</td><td style='text-align:right'>{inr(o['cod_fee'])}</td></tr>"
    a = o["address"]
    addr = ", ".join(e(x) for x in (a.get("line1"), a.get("line2"), a.get("landmark"), a.get("city"), a.get("state")) if x)
    return (f"<table style='width:100%;border-collapse:collapse;font-size:14px'>{rows}"
            f"<tr><td colspan=2><hr style='border:0;border-top:1px dashed #C9A227'></td></tr>{extra}"
            f"<tr><td style='font-weight:bold;padding-top:6px'>Total</td><td style='text-align:right;font-weight:bold'>{inr(o['total'])}</td></tr></table>"
            f"<p style='font-size:14px'><b>Delivering to:</b> {e(o['customer_name'])}, {addr} – {e(a.get('pin', ''))}<br>Phone: +91 {e(o['phone'])}</p>")


def _load(order_id: str) -> dict | None:
    rows = get_db().table("orders").select(ORDER_FIELDS).eq("id", order_id).limit(1).execute().data
    return rows[0] if rows else None


def _pay_label(o: dict) -> str:
    return {"cod": "Cash on Delivery", "gift": "Paid by gift card"}.get(o["payment_method"], "Paid online")


# ───────────── events ─────────────
def order_confirmed(order_id: str) -> None:
    try:
        o = _load(order_id)
        if not o:
            return
        s, no = get_settings(), f"LPC{o['order_no']}"
        table = _order_table(o)
        if o["email"]:
            send_email(o["email"], f"Order {no} confirmed — Lydia Purple Collections", _wrap(
                f"Thank you, {o['customer_name']}!",
                f"<p>Your order <b>{no}</b> is confirmed ({_pay_label(o)}). We'll message you when it ships.</p>{table}"),
                reply_to=store.current()["email"] or s.shop_email or None)
        shop_email = store.current()["email"] or s.shop_email
        if shop_email:
            send_email(shop_email, f"🛍️ New order {no} — {inr(o['total'])} ({_pay_label(o)})",
                       _wrap(f"New order {no}", table))
        params = [o["customer_name"], no, inr(o["total"]), _pay_label(o)]
        send_whatsapp(o["phone"], s.whatsapp_template_order, params)
        shop_wa = store.current()["whatsapp"] or s.shop_whatsapp
        if shop_wa:
            send_whatsapp(shop_wa, s.whatsapp_template_order, params)
    except Exception:
        log.exception("order_confirmed failed for %s", order_id)


def order_shipped(order_id: str) -> None:
    try:
        o = _load(order_id)
        if not o:
            return
        s, no = get_settings(), f"LPC{o['order_no']}"
        courier, tracking = o["courier"] or "our courier partner", o["tracking_number"] or "-"
        if o["email"]:
            send_email(o["email"], f"Order {no} has shipped 🚚", _wrap(
                "Your order is on its way!",
                f"<p>Order <b>{no}</b> has been shipped via <b>{html.escape(courier)}</b>.<br>"
                f"Tracking number: <b>{html.escape(tracking)}</b></p>"
                + ("<p>Please keep " + inr(o["total"] - (o.get("gift_amount") or 0)) + " ready for Cash on Delivery.</p>" if o["payment_method"] == "cod" else "")
                + _order_table(o)), reply_to=s.shop_email or None)
        send_whatsapp(o["phone"], s.whatsapp_template_shipped, [o["customer_name"], no, courier, tracking])
    except Exception:
        log.exception("order_shipped failed for %s", order_id)


def contact_message(name: str, phone: str, email: str | None, message: str) -> bool:
    s = get_settings()
    e = html.escape
    return send_email(store.current()["email"] or s.shop_email, f"Website enquiry from {name}", _wrap(
        "New message from the website",
        f"<p><b>Name:</b> {e(name)}<br><b>Phone:</b> {e(phone)}<br><b>Email:</b> {e(email or '-')}</p>"
        f"<p style='white-space:pre-wrap'>{e(message)}</p>"), reply_to=email or None)
