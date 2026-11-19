"""Bulk product import from CSV or Excel (.xlsx). One row per variant (colour + size).
Rows with the same product name become one product. Nothing is saved if any row has an error."""
import csv
import io
import re

import httpx
from fastapi import HTTPException

from .db import get_db

COLUMNS = ["name", "category", "price", "mrp", "fabric", "description", "care", "color", "color_hex",
           "size", "sku", "stock", "new", "bridal", "clearance", "live", "image_urls",
           "saree_length", "saree_width", "blouse_piece", "composition", "weave", "origin", "occasion",
           "silk_mark", "video_url"]
TEXT_DETAILS = ["saree_length", "saree_width", "blouse_piece", "composition", "weave", "origin", "occasion"]
REQUIRED = ["name", "category", "price", "stock"]
YES = {"yes", "y", "true", "1"}
NO = {"no", "n", "false", "0", ""}


def _read_rows(filename: str, data: bytes) -> list[dict]:
    name = filename.lower()
    if name.endswith(".xlsx"):
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        ws = wb.worksheets[0]
        it = ws.iter_rows(values_only=True)
        header = [str(h or "").strip().lower() for h in next(it, [])]
        rows = [dict(zip(header, ["" if v is None else str(v).strip() for v in r])) for r in it]
    elif name.endswith(".csv"):
        text = data.decode("utf-8-sig", errors="replace")
        rows = [{(k or "").strip().lower(): (v or "").strip() for k, v in r.items()} for r in csv.DictReader(io.StringIO(text))]
    else:
        raise HTTPException(400, "Please upload a .csv or .xlsx file.")
    return [r for r in rows if any(r.values())]


def _int(v: str) -> int | None:
    v = (v or "").replace(",", "").replace("₹", "").strip()
    if v.endswith(".0"):
        v = v[:-2]
    return int(v) if v.isdigit() else None


def _bool(v: str, default: bool) -> bool | None:
    v = (v or "").strip().lower()
    if v == "":
        return default
    return True if v in YES else False if v in NO else None


def _drive(url: str) -> str:
    m = re.search(r"drive\.google\.com/(?:file/d/|open\?id=)([\w-]+)", url)
    return f"https://drive.google.com/uc?export=download&id={m.group(1)}" if m else url


def _split_urls(v: str) -> list[str]:
    return [u.strip() for u in re.split(r"[|\n,\s]+", v or "") if u.strip().startswith("http")]


def run_import(filename: str, data: bytes, dry_run: bool, unique_slug, store_image) -> dict:
    db = get_db()
    rows = _read_rows(filename, data)
    if not rows:
        raise HTTPException(400, "The file has no product rows.")
    missing = [c for c in REQUIRED if c not in rows[0]]
    if missing:
        raise HTTPException(400, f"Missing column(s): {', '.join(missing)}. Download the sample file to see the format.")

    cats = db.table("categories").select("id,slug,name").execute().data
    cat_by = {c["slug"].lower(): c["id"] for c in cats} | {c["name"].lower(): c["id"] for c in cats}
    existing = {p["slug"]: p for p in db.table("products").select("id,slug,name").execute().data}
    sku_owner = {v["sku"]: v["product_id"] for v in
                 db.table("product_variants").select("sku,product_id").not_.is_("sku", "null").execute().data}
    with_photos = {i["product_id"] for i in db.table("product_images").select("product_id").execute().data}

    errors, groups = [], {}
    for n, r in enumerate(rows, start=2):  # row 1 is the header
        def err(msg):
            errors.append({"row": n, "message": msg})
        name = r.get("name", "")
        if len(name) < 2:
            err("Name is missing."); continue
        price, stock, mrp = _int(r.get("price")), _int(r.get("stock")), _int(r.get("mrp"))
        if not price:
            err(f"Price '{r.get('price')}' is not a whole number."); continue
        if stock is None:
            err(f"Stock '{r.get('stock')}' is not a whole number."); continue
        if r.get("mrp") and mrp is None:
            err(f"MRP '{r.get('mrp')}' is not a whole number."); continue
        if mrp and mrp < price:
            err("MRP is lower than price."); continue
        cat = cat_by.get(r.get("category", "").lower())
        if not cat:
            err(f"Category '{r.get('category')}' not found. Use one of: {', '.join(c['slug'] for c in cats)}."); continue
        hexv = r.get("color_hex", "")
        if hexv and not re.fullmatch(r"#?[0-9A-Fa-f]{6}", hexv):
            err(f"Colour code '{hexv}' should look like #5E1A73."); continue
        flags = {k: _bool(r.get(k), d) for k, d in (("new", False), ("bridal", False), ("clearance", False), ("live", True), ("silk_mark", False))}
        video = r.get("video_url", "")
        if video and not video.startswith("https://"):
            err("video_url must start with https://"); continue
        bad = [k for k, v in flags.items() if v is None]
        if bad:
            err(f"Column '{bad[0]}' must be yes or no."); continue

        key = name.strip().lower()
        g = groups.setdefault(key, {"name": name.strip(), "row": n, "product": {
            "name": name.strip(), "category_id": cat, "price": price, "mrp": mrp,
            "fabric": r.get("fabric") or None, "description": r.get("description") or None, "care": r.get("care") or None,
            "is_new": flags["new"], "is_bridal": flags["bridal"], "is_clearance": flags["clearance"], "is_active": flags["live"],
            "silk_mark": flags["silk_mark"], "video_url": video or None,
        } | {k: r.get(k) or None for k in TEXT_DETAILS}, "variants": [], "images": []})
        vkey = (r.get("color", "").lower(), r.get("size", "").lower())
        if any((v["color"].lower(), v["size"].lower()) == vkey for v in g["variants"]):
            err(f"'{name}' has the same colour and size twice."); continue
        sku = r.get("sku") or None
        if sku and any(v["sku"] == sku for gg in groups.values() for v in gg["variants"]):
            err(f"SKU '{sku}' is used twice in the file."); continue
        g["variants"].append({"color": r.get("color", ""), "color_hex": ("#" + hexv.lstrip("#")).upper() if hexv else None,
                              "size": r.get("size", ""), "sku": sku, "stock": stock})
        g["images"] += [(u, r.get("color", "")) for u in _split_urls(r.get("image_urls", ""))]

    # SKU owned by a different existing product
    for g in groups.values():
        slug_match = next((p for p in existing.values() if p["name"].strip().lower() == g["name"].lower()), None)
        g["existing"] = slug_match
        for v in g["variants"]:
            owner = sku_owner.get(v["sku"]) if v["sku"] else None
            if owner and (not slug_match or owner != slug_match["id"]):
                errors.append({"row": g["row"], "message": f"SKU '{v['sku']}' already belongs to another product."})

    summary = [{"name": g["name"], "action": "update" if g["existing"] else "create",
                "variants": len(g["variants"]), "photos": 0 if (g["existing"] and g["existing"]["id"] in with_photos) else len(g["images"])}
               for g in groups.values()]
    result = {"dry_run": dry_run, "products": summary, "errors": errors,
              "created": sum(s["action"] == "create" for s in summary),
              "updated": sum(s["action"] == "update" for s in summary), "photo_errors": []}
    if dry_run or errors:
        result["dry_run"] = True
        return result

    for g in groups.values():
        if g["existing"]:
            pid = g["existing"]["id"]
            db.table("products").update(g["product"]).eq("id", pid).execute()
        else:
            pid = db.table("products").insert(g["product"] | {"slug": unique_slug(g["name"])}).execute().data[0]["id"]
        current = db.table("product_variants").select("id,color,size,sku").eq("product_id", pid).execute().data
        for v in g["variants"]:
            match = next((c for c in current if (v["sku"] and c["sku"] == v["sku"]) or
                          (c["color"].lower(), c["size"].lower()) == (v["color"].lower(), v["size"].lower())), None)
            row = v | {"product_id": pid}
            if match:
                db.table("product_variants").update(row).eq("id", match["id"]).execute()
            else:
                db.table("product_variants").insert(row).execute()
        if pid in with_photos:
            continue
        colors = {v["color"] for v in g["variants"]}
        for url, color in g["images"]:
            try:
                r = httpx.get(_drive(url), follow_redirects=True, timeout=20)
                r.raise_for_status()
                store_image(pid, r.content, color if len(colors) > 1 else None)
            except HTTPException as e:
                result["photo_errors"].append(f"{g['name']}: {url} — {e.detail}")
            except Exception:
                result["photo_errors"].append(f"{g['name']}: couldn't download {url}")
    return result
