from datetime import datetime

from app.invoice import build, financial_year, invoice_number, rupees_in_words, tax_split


def test_words():
    assert rupees_in_words(2699) == "Rupees Two Thousand Six Hundred Ninety Nine Only"
    assert rupees_in_words(125000) == "Rupees One Lakh Twenty Five Thousand Only"
    assert rupees_in_words(15000000) == "Rupees One Crore Fifty Lakh Only"


def test_fy_and_number():
    assert financial_year(datetime(2026, 11, 19)) == "26-27"
    assert financial_year(datetime(2027, 2, 1)) == "26-27"
    assert invoice_number("LPC", 7, datetime(2026, 4, 1)) == "LPC/26-27/0007"


def test_tax_inclusive_split():
    t = tax_split(1050, 5, True)
    assert t["taxable"] == 1000 and t["cgst"] == 25 and t["sgst"] == 25 and t["igst"] == 0
    t = tax_split(1050, 5, False)
    assert t["igst"] == 50 and t["cgst"] == 0


def test_invoice_adds_up_to_order_total():
    order = {"order_no": 1001, "customer_name": "Asha", "phone": "9876543210", "address": {"state": "Telangana"},
             "order_items": [{"name": "Saree", "color": "Green", "size": "", "price": 2699, "qty": 1}],
             "discount": 270, "coupon_code": "WELCOME10", "shipping_fee": 0, "cod_fee": 49, "total": 2478,
             "payment_method": "cod", "payment_status": "cod_pending"}
    inv = build(order, {"gstin": "36ABCDE1234F1Z5", "shop_state": "Telangana", "gst_rate": 5, "hsn": "5007"}, 1, datetime(2026, 11, 19))
    t = inv["totals"]
    assert inv["title"] == "Tax Invoice" and inv["same_state"]
    assert abs(t["gross"] + t["round_off"] - 2478) < 0.001
    assert abs(t["taxable"] + t["cgst"] + t["sgst"] - t["gross"]) < 0.02
    receipt = build(order, {}, None, datetime(2026, 11, 19))
    assert receipt["title"] == "Order Receipt" and receipt["totals"]["cgst"] == 0
