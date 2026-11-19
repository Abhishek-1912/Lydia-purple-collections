import hashlib
import hmac

from app.razorpay_client import verify_payment_signature, verify_webhook_signature

SECRET = "test_secret"


def sign(msg: bytes) -> str:
    return hmac.new(SECRET.encode(), msg, hashlib.sha256).hexdigest()


def test_payment_signature():
    good = sign(b"order_1|pay_1")
    assert verify_payment_signature("order_1", "pay_1", good, SECRET)
    assert not verify_payment_signature("order_1", "pay_2", good, SECRET)
    assert not verify_payment_signature("order_1", "pay_1", good, "")
    assert not verify_payment_signature("order_1", "pay_1", "", SECRET)


def test_webhook_signature():
    body = b'{"event":"payment.captured"}'
    assert verify_webhook_signature(body, sign(body), SECRET)
    assert not verify_webhook_signature(body + b" ", sign(body), SECRET)
    assert not verify_webhook_signature(body, "", SECRET)
