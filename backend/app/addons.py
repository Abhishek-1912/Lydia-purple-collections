"""Saree add-ons (fall & edging, blouse stitching, shapewear). Pure — unit-tested in tests/test_addons.py.
Prices come from Admin → Settings; a price of 0 switches that add-on off. Add-ons are prepaid only."""

SHAPEWEAR_SIZES = ["S", "M", "L", "XL", "XXL"]
BLOUSE_TYPES = {"regular": "Regular", "designer": "Designer"}
CATEGORY = "sarees"   # add-ons are offered on products in this category only

PRICE_KEYS = ["addon_fall", "addon_blouse_regular", "addon_blouse_designer", "addon_shapewear"]
MEASURE_FIELDS = [("bust", "Bust", True), ("waist", "Waist", True), ("shoulder", "Shoulder", True),
                  ("blouse_length", "Blouse length", True), ("sleeve_length", "Sleeve length", False),
                  ("armhole", "Armhole", False), ("front_neck", "Front neck depth", False),
                  ("back_neck", "Back neck depth", False)]


def clean(raw: dict | None) -> dict:
    """Keep only valid choices: {fall: bool, blouse: 'regular'|'designer'|None, shapewear: size|None}."""
    raw = raw or {}
    blouse = raw.get("blouse") if raw.get("blouse") in BLOUSE_TYPES else None
    shape = raw.get("shapewear") if raw.get("shapewear") in SHAPEWEAR_SIZES else None
    return {"fall": raw.get("fall") is True, "blouse": blouse, "shapewear": shape}


def key(a: dict) -> str:
    """Stable id so the same saree with different add-ons is a separate cart line."""
    a = clean(a)
    return f"{'f' if a['fall'] else ''}{a['blouse'] or ''}{('|' + a['shapewear']) if a['shapewear'] else ''}"


def lines(a: dict, prices: dict) -> tuple[list[dict], str | None]:
    """Returns ([{label, amount}], error). An add-on whose price is 0 is switched off → error if chosen."""
    a, out = clean(a), []
    picks = []
    if a["fall"]:
        picks.append(("addon_fall", "Fall & edging"))
    if a["blouse"]:
        picks.append((f"addon_blouse_{a['blouse']}", f"Blouse stitching ({BLOUSE_TYPES[a['blouse']]})"))
    if a["shapewear"]:
        picks.append(("addon_shapewear", f"Saree shapewear ({a['shapewear']})"))
    for k, label in picks:
        amount = int(prices.get(k) or 0)
        if amount <= 0:
            return [], f"{label.split(' (')[0]} isn't available right now. Please remove it."
        out.append({"label": label, "amount": amount})
    return out, None


def measurements_problem(m: dict | None) -> str | None:
    m = m or {}
    for k, label, required in MEASURE_FIELDS:
        v = m.get(k)
        if v in (None, ""):
            if required:
                return f"Please enter the {label.lower()} for blouse stitching."
            continue
        try:
            n = float(v)
        except (TypeError, ValueError):
            return f"{label} must be a number in inches."
        if not 1 <= n <= 80:
            return f"{label} looks wrong. Please enter it in inches."
    return None


def clean_measurements(m: dict) -> dict:
    out = {k: str(m[k]).strip() for k, _, _ in MEASURE_FIELDS if m.get(k) not in (None, "")}
    note = str(m.get("note") or "").strip()[:300]
    if note:
        out["note"] = note
    return out
