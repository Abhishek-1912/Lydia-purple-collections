from app.guard import MAX_OPEN_COD_PER_PHONE, RateLimiter, cod_refusal


def test_rate_limiter_window():
    rl = RateLimiter(2, 60)
    assert rl.allow("ip", 0) and rl.allow("ip", 1)
    assert not rl.allow("ip", 2)
    assert rl.allow("other", 2)
    assert rl.allow("ip", 62)  # first hit expired


def test_cod_refusal():
    assert cod_refusal(False, 0) is None
    assert "isn't available" in cod_refusal(True, 0)
    assert "already have" in cod_refusal(False, MAX_OPEN_COD_PER_PHONE)


def test_auto_sku():
    from app.routers.admin import auto_sku
    s = auto_sku("Purple Kanjivaram Silk Saree", "Royal Purple", "")
    assert s.startswith("PKS-") and s.endswith("-ROY") and len(s.split("-")) == 3
    assert auto_sku("Zari Blouse", "Gold", "M").endswith("-GOL-M")
    assert auto_sku("Zari Blouse", "Gold", "M") != auto_sku("Zari Blouse", "Gold", "M")
