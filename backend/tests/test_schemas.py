from app.schemas import OrderIn, QuoteIn

V = "3a399896-43f5-4f46-9db4-510c4434c7c5"


def test_quote_needs_no_payment_method():
    # The cart page asks for a quote before the shopper picks a payment method
    q = QuoteIn(items=[{"variant_id": V, "qty": 1}])
    assert q.payment_method is None and not hasattr(q, "session_id")


def test_order_accepts_draft_session():
    o = OrderIn(name="Asha", phone="9876543210", address={"line1": "12 Road", "city": "Hyderabad", "state": "Telangana", "pin": "500001"},
                items=[{"variant_id": V, "qty": 1}], payment_method="cod", session_id="abc12345")
    assert o.session_id == "abc12345"
