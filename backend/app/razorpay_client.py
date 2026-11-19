"""Razorpay Orders API + signature checks (HMAC-SHA256, constant-time compare)."""
import hashlib
import hmac

import httpx

from .config import get_settings

API = "https://api.razorpay.com/v1"


def _hmac(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def verify_payment_signature(order_id: str, payment_id: str, signature: str, secret: str) -> bool:
    if not (order_id and payment_id and signature and secret):
        return False
    expected = _hmac(secret, f"{order_id}|{payment_id}".encode())
    return hmac.compare_digest(expected, signature)


def verify_webhook_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    if not (signature and secret):
        return False
    return hmac.compare_digest(_hmac(secret, raw_body), signature)


def create_order(amount_rupees: int, receipt: str, notes: dict | None = None) -> dict:
    s = get_settings()
    r = httpx.post(
        f"{API}/orders",
        auth=(s.razorpay_key_id, s.razorpay_key_secret),
        json={"amount": amount_rupees * 100, "currency": "INR", "receipt": receipt, "notes": notes or {}},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()
