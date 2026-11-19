from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..auth import require_user
from ..db import get_db
from ..schemas import Address

router = APIRouter(prefix="/api/me", tags=["account"])


def _profile(user: dict) -> dict:
    db = get_db()
    rows = db.table("profiles").select("id,full_name,phone,email,address,role").eq("id", user["id"]).execute().data
    if rows:
        return rows[0]
    # Profile trigger missed (e.g. user created before schema) — create it now
    return db.table("profiles").insert({"id": user["id"], "email": user.get("email")}).execute().data[0]


@router.get("")
def me(user: dict = Depends(require_user)):
    return _profile(user)


class ProfileIn(BaseModel):
    full_name: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, pattern=r"^$|^[6-9][0-9]{9}$")
    address: Address | None = None


@router.patch("")
def update_me(body: ProfileIn, user: dict = Depends(require_user)):
    _profile(user)
    data = body.model_dump(exclude_unset=True, mode="json")
    if data:
        get_db().table("profiles").update(data).eq("id", user["id"]).execute()
    return _profile(user)


@router.get("/orders")
def my_orders(user: dict = Depends(require_user)):
    return (get_db().table("orders")
            .select("id,order_no,total,status,payment_status,payment_method,courier,tracking_number,created_at,"
                    "order_items(name,color,size,image_url,price,qty)")
            .eq("user_id", user["id"]).order("created_at", desc=True).limit(50).execute().data)
