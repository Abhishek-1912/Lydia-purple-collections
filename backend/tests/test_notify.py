from app import notify
from app.config import Settings


def test_channels_off_without_keys(monkeypatch):
    monkeypatch.setattr(notify, "get_settings", lambda: Settings(_env_file=None))
    assert notify.send_email("a@b.com", "s", "<p>x</p>") is False
    assert notify.send_whatsapp("9876543210", "order", ["a"]) is False


def test_failures_never_raise(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("db down")
    monkeypatch.setattr(notify, "_load", boom)
    notify.order_confirmed("x")   # must not raise
    notify.order_shipped("x")


def test_email_escapes_customer_text():
    o = {"order_items": [{"name": "<b>Saree</b>", "color": "Red", "size": "", "price": 100, "qty": 1}],
         "discount": 0, "coupon_code": None, "shipping_fee": 99, "cod_fee": 0, "total": 199,
         "address": {"line1": "<script>x</script>", "city": "Chennai", "state": "Tamil Nadu", "pin": "600001"},
         "customer_name": "A & B", "phone": "9876543210"}
    h = notify._order_table(o)
    assert "<script>" not in h and "&lt;b&gt;Saree" in h and "A &amp; B" in h
