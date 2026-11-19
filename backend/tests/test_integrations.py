import pytest

from app.integrations import refund_paise, shiprocket_payload

O = {"order_no": 1005, "created_at": "2026-11-19T10:30:00+00:00", "customer_name": "Asha", "phone": "9876543210", "email": None,
     "address": {"line1": "12 Road", "line2": "Banjara Hills", "landmark": "Temple", "city": "Hyderabad", "state": "Telangana", "pin": "500034"},
     "order_items": [{"name": "Saree", "price": 2699, "qty": 1}], "payment_method": "cod", "payment_status": "cod_pending",
     "shipping_fee": 0, "discount": 0, "total": 2748, "gift_amount": 1000}


def test_shiprocket_cod_collects_due_only():
    p = shiprocket_payload(O, "Primary", 0.6, (30, 25, 5))
    assert p["order_id"] == "LPC1005" and p["payment_method"] == "COD" and p["sub_total"] == 1748
    assert p["billing_address_2"] == "Banjara Hills, Near Temple" and p["billing_pincode"] == "500034"
    assert shiprocket_payload(O | {"payment_method": "razorpay", "payment_status": "paid"}, "P", 0.6, (1, 1, 1))["payment_method"] == "Prepaid"


def test_refund_limits():
    assert refund_paise(2699, 0, 0, None) == 269900
    assert refund_paise(2699, 1000, 0, 500) == 50000
    with pytest.raises(ValueError):
        refund_paise(2699, 1000, 0, 1800)      # more than paid online (1699)
    with pytest.raises(ValueError):
        refund_paise(2699, 0, 2699, None)      # already refunded
