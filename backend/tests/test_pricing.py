from datetime import datetime, timedelta, timezone

from app.pricing import Rules, coupon_discount, inr, totals

R = Rules(free_shipping_above=1999, shipping_fee=99, cod_fee=49, cod_max_order=15000)
NOW = datetime(2026, 11, 19, tzinfo=timezone.utc)


def c(**kw):
    base = {"is_active": True, "discount_type": "percent", "value": 10, "min_order": 0,
            "max_discount": None, "usage_limit": None, "used_count": 0, "starts_at": None, "ends_at": None}
    return base | kw


def test_inr():
    assert inr(999) == "₹999"
    assert inr(1999) == "₹1,999"
    assert inr(150000) == "₹1,50,000"


def test_percent_capped():
    assert coupon_discount(c(value=10, max_discount=500), 10000, NOW) == (500, None)
    assert coupon_discount(c(value=10), 2500, NOW) == (250, None)


def test_flat_never_exceeds_subtotal():
    assert coupon_discount(c(discount_type="flat", value=300), 200, NOW) == (200, None)


def test_coupon_failures():
    assert "exist" in coupon_discount(None, 1000, NOW)[1]
    assert "no longer active" in coupon_discount(c(is_active=False), 1000, NOW)[1]
    assert "isn't active yet" in coupon_discount(c(starts_at=NOW + timedelta(days=1)), 1000, NOW)[1]
    assert "expired" in coupon_discount(c(ends_at=NOW - timedelta(days=1)), 1000, NOW)[1]
    assert "fully used" in coupon_discount(c(usage_limit=5, used_count=5), 1000, NOW)[1]
    assert coupon_discount(c(min_order=2999), 2000, NOW)[1] == "Add ₹999 more to use this coupon."


def test_shipping_judged_after_discount():
    assert totals(2100, 0, None, R)["shipping_fee"] == 0
    t = totals(2100, 300, None, R)
    assert t["shipping_fee"] == 99 and t["total"] == 1899


def test_cod_fee_and_limit():
    t = totals(1000, 0, "cod", R)
    assert t["cod_fee"] == 49 and t["total"] == 1000 + 99 + 49 and t["cod_allowed"]
    big = totals(15000, 0, "cod", R)
    assert not big["cod_allowed"] and "₹15,000" in big["cod_message"]
    assert totals(14951, 0, "cod", R)["cod_allowed"]  # 14951 + 0 + 49 = 15000


def test_empty_cart():
    t = totals(0, 0, None, R)
    assert t["total"] == 0 and t["shipping_fee"] == 0
