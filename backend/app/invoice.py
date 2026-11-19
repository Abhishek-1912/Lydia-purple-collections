"""GST invoice maths (pure — tested in tests/test_invoice.py).
Prices in this shop include GST, so tax is taken out of each amount:
taxable = gross × 100 / (100 + rate). Same state as the shop → CGST + SGST (half each); else IGST."""
from datetime import datetime

ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
        "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _two(n: int) -> str:
    return ONES[n] if n < 20 else (TENS[n // 10] + (" " + ONES[n % 10] if n % 10 else ""))


def _three(n: int) -> str:
    h, r = divmod(n, 100)
    return ((ONES[h] + " Hundred" + (" " if r else "")) if h else "") + (_two(r) if r else "")


def rupees_in_words(n: int) -> str:
    """Indian numbering: 125000 → 'Rupees One Lakh Twenty Five Thousand Only'."""
    n = int(round(n))
    if n == 0:
        return "Rupees Zero Only"
    parts = []
    for div, name in ((10_000_000, "Crore"), (100_000, "Lakh"), (1000, "Thousand")):
        q, n = divmod(n, div)
        if q:
            parts.append((_three(q) if q < 1000 else rupees_in_words(q)[7:-5]) + " " + name)
    if n:
        parts.append(_three(n))
    return "Rupees " + " ".join(parts) + " Only"


def financial_year(d: datetime) -> str:
    start = d.year if d.month >= 4 else d.year - 1
    return f"{start % 100:02d}-{(start + 1) % 100:02d}"


def invoice_number(prefix: str, n: int, d: datetime) -> str:
    return f"{prefix}/{financial_year(d)}/{n:04d}"


def tax_split(gross: float, rate: float, same_state: bool) -> dict:
    taxable = round(gross * 100 / (100 + rate), 2) if rate else round(gross, 2)
    tax = round(gross - taxable, 2)
    if same_state:
        cgst = round(tax / 2, 2)
        return {"taxable": taxable, "cgst": cgst, "sgst": round(tax - cgst, 2), "igst": 0.0, "gross": round(gross, 2)}
    return {"taxable": taxable, "cgst": 0.0, "sgst": 0.0, "igst": tax, "gross": round(gross, 2)}


def build(order: dict, cfg: dict, number: int | None, issued: datetime) -> dict:
    """order: DB row with order_items; cfg: store settings (gstin, legal_name, shop_state, hsn, gst_rate, address…)."""
    gst = bool(cfg.get("gstin"))
    rate = float(cfg.get("gst_rate") or 5) if gst else 0.0
    buyer_state = (order.get("address") or {}).get("state", "")
    same = bool(cfg.get("shop_state")) and buyer_state.strip().lower() == str(cfg.get("shop_state")).strip().lower()
    lines = []
    for it in order["order_items"]:
        extras = it.get("addons") or []          # saree add-ons: shown as their own lines
        base = it["price"] - sum(int(e["amount"]) for e in extras)
        lines.append({"description": it["name"] + (f" ({' / '.join(x for x in (it.get('color'), it.get('size')) if x)})" if (it.get("color") or it.get("size")) else ""),
                      "hsn": cfg.get("hsn") or "", "qty": it["qty"], "rate": base, **tax_split(base * it["qty"], rate, same)})
        for e in extras:
            amt = int(e["amount"])
            lines.append({"description": e["label"], "hsn": "", "qty": it["qty"], "rate": amt, **tax_split(amt * it["qty"], rate, same)})
    if order.get("discount"):
        lines.append({"description": f"Discount{' (' + order['coupon_code'] + ')' if order.get('coupon_code') else ''}",
                      "hsn": "", "qty": 1, "rate": -order["discount"], **tax_split(-order["discount"], rate, same)})
    for label, key in (("Shipping", "shipping_fee"), ("Cash on Delivery handling", "cod_fee")):
        if order.get(key):
            lines.append({"description": label, "hsn": "9968" if key == "shipping_fee" else "", "qty": 1, "rate": order[key],
                          **tax_split(order[key], rate, same)})
    tot = {k: round(sum(l[k] for l in lines), 2) for k in ("taxable", "cgst", "sgst", "igst", "gross")}
    # rounding: make sure the invoice adds up to exactly the order total
    diff = round(order["total"] - tot["gross"], 2)
    return {
        "title": "Tax Invoice" if gst else "Order Receipt",
        "gst": gst, "rate": rate, "same_state": same,
        "number": invoice_number(cfg.get("invoice_prefix") or "LPC", number, issued) if number else None,
        "date": issued.date().isoformat(),
        "order_no": f"LPC{order['order_no']}",
        "seller": {"name": cfg.get("legal_name") or "Lydia Purple Collections", "address": cfg.get("address") or "",
                   "gstin": cfg.get("gstin") or "", "state": cfg.get("shop_state") or "", "phone": cfg.get("phone") or "",
                   "email": cfg.get("email") or ""},
        "buyer": {"name": order["customer_name"], "phone": order["phone"], "address": order.get("address") or {},
                  "state": buyer_state},
        "lines": lines, "totals": tot | {"round_off": diff, "grand": order["total"]},
        "gift_amount": order.get("gift_amount") or 0,
        "payment": order.get("payment_method"), "payment_status": order.get("payment_status"),
        "in_words": rupees_in_words(order["total"]),
    }
