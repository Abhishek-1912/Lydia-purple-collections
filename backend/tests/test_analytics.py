from app.routers.analytics import funnel


def test_funnel_unique_sessions():
    ev = [{"session_id": s, "type": t} for s, t in [
        ("a", "view"), ("a", "view"), ("b", "view"), ("c", "view"), ("d", "view"),
        ("a", "cart"), ("b", "cart"), ("a", "checkout"), ("b", "checkout"), ("a", "order")]]
    f = funnel(ev)
    assert f["sessions"] == {"view": 4, "cart": 2, "checkout": 2, "order": 1}
    assert f["view_to_cart"] == 50.0 and f["checkout_to_order"] == 50.0 and f["overall"] == 25.0
    assert funnel([])["overall"] == 0
