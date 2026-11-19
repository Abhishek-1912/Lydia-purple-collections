from datetime import date

from app.delivery import add_working_days, estimate, zone


def test_zones():
    assert zone("190001") == "remote"          # Srinagar
    assert zone("781001") == "remote"          # Guwahati
    assert zone("744101") == "remote"          # Port Blair
    assert zone("600040", "600001") == "local"
    assert zone("641001", "600001") == "regional"  # same circle (TN)
    assert zone("560001", "600001") == "metro"
    assert zone("302001", "600001") == "national"  # Jaipur
    assert zone("600040") == "metro"           # no shop PIN set


def test_skips_sundays():
    sat = date(2026, 11, 21)
    assert add_working_days(sat, 1) == date(2026, 11, 23)  # Sunday skipped


def test_estimate_range():
    e = estimate("302001", date(2026, 11, 19), "600001", dispatch_days=1)  # Thu
    assert e["zone"] == "national"
    assert e["from"] == "2026-11-25" and e["to"] == "2026-11-28"
