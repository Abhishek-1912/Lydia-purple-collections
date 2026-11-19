"""Bearer-token checks against Supabase Auth."""
import httpx
from fastapi import Depends, HTTPException, Request

from .config import get_settings
from .db import get_db


def _token(request: Request) -> str | None:
    h = request.headers.get("authorization", "")
    return h[7:].strip() if h.lower().startswith("bearer ") else None


def _fetch_user(token: str) -> dict | None:
    s = get_settings()
    try:
        r = httpx.get(f"{s.supabase_url}/auth/v1/user",
                      headers={"Authorization": f"Bearer {token}", "apikey": s.supabase_anon_key}, timeout=10)
    except httpx.HTTPError:
        return None
    return r.json() if r.status_code == 200 else None


def optional_user(request: Request) -> dict | None:
    t = _token(request)
    return _fetch_user(t) if t else None


def require_user(request: Request) -> dict:
    user = optional_user(request)
    if not user:
        raise HTTPException(401, "Please sign in again.")
    return user


def role_of(user: dict) -> str:
    rows = get_db().table("profiles").select("role").eq("id", user["id"]).limit(1).execute().data
    return rows[0]["role"] if rows else "customer"


# What a packer may do inside /api/admin: see orders, update packing/shipping, print invoices.
PACKER_ALLOWED = [("GET", r"^/api/admin/orders/?$"), ("PATCH", r"^/api/admin/orders/[0-9a-f-]+$"),
                  ("GET", r"^/api/admin/orders/[0-9a-f-]+/invoice$")]


def admin_gate(request: Request, user: dict = Depends(require_user)) -> dict:
    """Admins: everything. Packers: only PACKER_ALLOWED. Everyone else: refused."""
    import re
    role = role_of(user)
    request.state.role = role
    if role == "admin":
        return user
    if role == "packer" and any(request.method == m and re.match(p, request.url.path) for m, p in PACKER_ALLOWED):
        return user
    raise HTTPException(403, "Admins only.")


def require_admin(user: dict = Depends(require_user)) -> dict:
    rows = get_db().table("profiles").select("role").eq("id", user["id"]).limit(1).execute().data
    if not rows or rows[0]["role"] != "admin":
        raise HTTPException(403, "Admins only.")
    return user
