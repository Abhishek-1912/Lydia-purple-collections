from app import addons as ad
from app.invoice import build
from datetime import datetime

P = {"addon_fall": 300, "addon_blouse_regular": 1599, "addon_blouse_designer": 1999, "addon_shapewear": 0}


def test_clean_drops_junk():
    assert ad.clean({"fall": "yes", "blouse": "fancy", "shapewear": "XXXL"}) == {"fall": False, "blouse": None, "shapewear": None}


def test_key_differs_by_choice():
    assert ad.key({}) == ""
    assert ad.key({"fall": True}) != ad.key({"fall": True, "blouse": "regular"})


def test_lines_and_switched_off():
    lines, err = ad.lines({"fall": True, "blouse": "designer"}, P)
    assert err is None and [l["amount"] for l in lines] == [300, 1999]
    _, err = ad.lines({"shapewear": "M"}, P)
    assert "isn't available" in err
    lines, err = ad.lines({"shapewear": "M"}, P | {"addon_shapewear": 499})
    assert err is None and lines == [{"label": "Saree shapewear (M)", "amount": 499}]


def test_measurements():
    assert "bust" in ad.measurements_problem({})
    ok = {"bust": "36", "waist": "30", "shoulder": "14", "blouse_length": "15"}
    assert ad.measurements_problem(ok) is None
    assert "inches" in ad.measurements_problem(ok | {"armhole": "abc"})
    assert ad.clean_measurements(ok | {"note": " high neck ", "armhole": ""}) == ok | {"note": "high neck"}


def test_invoice_splits_addons():
    order = {"order_items": [{"name": "Saree", "color": "Red", "size": None, "qty": 1, "price": 2999 + 300,
                              "addons": [{"label": "Fall & edging", "amount": 300}]}],
             "discount": 0, "shipping_fee": 0, "cod_fee": 0, "total": 3299, "address": {"state": "Telangana"},
             "order_no": 1001, "customer_name": "A", "phone": "9876543210", "payment_method": "razorpay",
             "payment_status": "paid", "gift_amount": 0}
    inv = build(order, {"gstin": "36ABCDE1234F1Z5", "gst_rate": 5, "shop_state": "Telangana"}, 1, datetime(2026, 11, 19))
    assert [l["rate"] for l in inv["lines"]] == [2999, 300]
    assert inv["totals"]["grand"] == 3299
