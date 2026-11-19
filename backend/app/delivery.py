"""Rule-based delivery estimate by PIN zone (no courier API in v1). Pure — tested in tests/test_delivery.py.
Couriers don't deliver on Sundays, so only Mon–Sat count as working days."""
from datetime import date, timedelta

METRO_PREFIXES = {"11", "40", "41", "56", "60", "50", "70", "38"}  # Delhi, Mumbai, Pune, Bengaluru, Chennai, Hyderabad, Kolkata, Ahmedabad

# PIN first-two-digit ranges → postal circle (roughly a state or group of states)
CIRCLES = [
    (11, 11, "Delhi"), (12, 13, "Haryana"), (14, 16, "Punjab"), (17, 17, "Himachal"), (18, 19, "J&K"),
    (20, 28, "UP/Uttarakhand"), (30, 34, "Rajasthan"), (36, 39, "Gujarat"), (40, 44, "Maharashtra"),
    (45, 48, "MP"), (49, 49, "Chhattisgarh"), (50, 53, "Telangana/AP"), (56, 59, "Karnataka"),
    (60, 64, "Tamil Nadu"), (67, 69, "Kerala"), (70, 74, "West Bengal"), (75, 77, "Odisha"),
    (78, 79, "North-East"), (80, 85, "Bihar/Jharkhand"),
]


def circle(pin: str) -> str | None:
    n = int(pin[:2])
    return next((name for lo, hi, name in CIRCLES if lo <= n <= hi), None)


TRANSIT = {  # working days after dispatch
    "local": (1, 2),
    "regional": (2, 4),
    "metro": (3, 5),
    "national": (4, 7),
    "remote": (7, 12),
}


def zone(pin: str, shop_pin: str = "") -> str:
    if pin[:2] in ("18", "19", "78", "79") or pin[:3] == "744" or pin[:4] == "6825":
        return "remote"  # J&K, Ladakh, North-East, Andaman, Lakshadweep
    if shop_pin and pin[:3] == shop_pin[:3]:
        return "local"
    if shop_pin and circle(pin) and circle(pin) == circle(shop_pin):
        return "regional"
    if pin[:2] in METRO_PREFIXES:
        return "metro"
    return "national"


def add_working_days(start: date, days: int) -> date:
    d = start
    while days > 0:
        d += timedelta(days=1)
        if d.weekday() != 6:  # skip Sunday
            days -= 1
    return d


def estimate(pin: str, today: date, shop_pin: str = "", dispatch_days: int = 1) -> dict:
    z = zone(pin, shop_pin)
    lo, hi = TRANSIT[z]
    return {
        "zone": z,
        "from": add_working_days(today, dispatch_days + lo).isoformat(),
        "to": add_working_days(today, dispatch_days + hi).isoformat(),
    }
