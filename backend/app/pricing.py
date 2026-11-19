"""Pure pricing rules. No web or database imports — unit-tested in tests/test_pricing.py."""
from dataclasses import dataclass
from datetime import datetime

MAX_QTY = 10


@dataclass(frozen=True)
class Rules:
    free_shipping_above: int
    shipping_fee: int
    cod_fee: int
    cod_max_order: int


def inr(n: int) -> str:
    """Indian digit grouping: 150000 -> '₹1,50,000'."""
    s = str(abs(int(n)))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        s = ",".join(groups) + "," + tail
    return ("-" if n < 0 else "") + "₹" + s


def coupon_discount(coupon: dict | None, subtotal: int, now: datetime) -> tuple[int, str | None]:
    """Returns (discount, error). starts_at/ends_at must be datetimes or None."""
    if not coupon:
        return 0, "This coupon code doesn't exist."
    if not coupon.get("is_active"):
        return 0, "This coupon is no longer active."
    starts, ends = coupon.get("starts_at"), coupon.get("ends_at")
    if starts and now < starts:
        return 0, "This coupon isn't active yet."
    if ends and now > ends:
        return 0, "This coupon has expired."
    limit = coupon.get("usage_limit")
    if limit is not None and coupon.get("used_count", 0) >= limit:
        return 0, "This coupon has been fully used."
    min_order = coupon.get("min_order") or 0
    if subtotal < min_order:
        return 0, f"Add {inr(min_order - subtotal)} more to use this coupon."

    value = int(coupon["value"])
    if coupon["discount_type"] == "percent":
        discount = subtotal * value // 100
        if coupon.get("max_discount"):
            discount = min(discount, int(coupon["max_discount"]))
    else:
        discount = value
    return min(discount, subtotal), None


def totals(subtotal: int, discount: int, payment_method: str | None, rules: Rules) -> dict:
    """Total = subtotal - discount + shipping (judged after discount) + COD fee."""
    discount = max(0, min(discount, subtotal))
    after = subtotal - discount
    shipping = 0 if subtotal == 0 or after >= rules.free_shipping_above else rules.shipping_fee
    cod_fee = rules.cod_fee if payment_method == "cod" else 0
    cod_total = after + shipping + rules.cod_fee
    cod_allowed = subtotal > 0 and cod_total <= rules.cod_max_order
    return {
        "subtotal": subtotal,
        "discount": discount,
        "shipping_fee": shipping,
        "cod_fee": cod_fee,
        "total": after + shipping + cod_fee,
        "cod_allowed": cod_allowed,
        "cod_message": None if cod_allowed or subtotal == 0
        else f"Cash on Delivery is available up to {inr(rules.cod_max_order)}. Please pay online for this order.",
        "free_shipping_remaining": max(0, rules.free_shipping_above - after) if subtotal else rules.free_shipping_above,
    }
