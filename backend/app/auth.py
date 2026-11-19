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


def require_admin(user: dict = Depends(require_user)) -> dict:
    rows = get_db().table("profiles").select("role").eq("id", user["id"]).limit(1).execute().data
    if not rows or rows[0]["role"] != "admin":
        raise HTTPException(403, "Admins only.")
    return user
