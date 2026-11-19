from datetime import datetime, timedelta, timezone

from app.pricing import Rules, apply_gift, gift_card_problem

R = Rules(free_shipping_above=1999, shipping_fee=99, cod_fee=49, cod_max_order=15000)
NOW = datetime(2026, 11, 19, tzinfo=timezone.utc)


def test_full_gift_no_cod_fee():
    g = apply_gift(2699, 0, "cod", 5000, R)
    assert g["full_gift"] and g["gift_amount"] == 2699 and g["due"] == 0 and g["cod_fee"] == 0 and g["total"] == 2699


def test_partial_gift_cod_fee_only_on_cash_part():
    g = apply_gift(2699, 0, "cod", 1000, R)
    assert not g["full_gift"] and g["gift_amount"] == 1000 and g["total"] == 2748 and g["due"] == 1748 and g["cod_fee"] == 49


def test_partial_gift_online():
    g = apply_gift(1500, 0, "razorpay", 500, R)     # 1500 + 99 shipping = 1599
    assert g["total"] == 1599 and g["gift_amount"] == 500 and g["due"] == 1099 and g["cod_fee"] == 0


def test_gift_with_coupon():
    g = apply_gift(3000, 300, "razorpay", 2700, R)  # 2700 after coupon, free shipping → fully covered
    assert g["full_gift"] and g["gift_amount"] == 2700 and g["due"] == 0


def test_gift_makes_big_cod_order_allowed():
    g = apply_gift(20000, 0, "cod", 6000, R)        # 20049 total, 14049 to collect → COD allowed
    assert g["cod_allowed"] and g["due"] == 14049


def test_problems():
    card = {"is_active": True, "balance": 100, "expires_at": None}
    assert gift_card_problem(card, NOW) is None
    assert "doesn't exist" in gift_card_problem(None, NOW)
    assert "no longer active" in gift_card_problem(card | {"is_active": False}, NOW)
    assert "expired" in gift_card_problem(card | {"expires_at": NOW - timedelta(days=1)}, NOW)
    assert "no balance" in gift_card_problem(card | {"balance": 0}, NOW)
