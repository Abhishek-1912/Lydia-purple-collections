from typing import Literal

from pydantic import BaseModel, Field, field_validator


class CartItem(BaseModel):
    variant_id: str
    qty: int = Field(ge=1, le=10)


class QuoteIn(BaseModel):
    items: list[CartItem] = Field(max_length=50)
    coupon_code: str | None = Field(default=None, max_length=40)
    payment_method: Literal["razorpay", "cod"] | None = None
    gift_code: str | None = Field(default=None, max_length=40)


INDIAN_STATES = [
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
    "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
    "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
    "West Bengal",
]


class Address(BaseModel):
    line1: str = Field(min_length=3, max_length=200)
    line2: str | None = Field(default=None, max_length=200)
    landmark: str | None = Field(default=None, max_length=120)
    city: str = Field(min_length=2, max_length=80)
    state: str
    pin: str = Field(pattern=r"^[1-9][0-9]{5}$")

    @field_validator("state")
    @classmethod
    def known_state(cls, v: str) -> str:
        if v not in INDIAN_STATES:
            raise ValueError("Please choose a state from the list.")
        return v


class OrderIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(pattern=r"^[6-9][0-9]{9}$")
    email: str | None = Field(default=None, max_length=200, pattern=r"^$|^[^@\s]+@[^@\s]+\.[^@\s]+$")
    address: Address
    items: list[CartItem] = Field(min_length=1, max_length=50)
    coupon_code: str | None = Field(default=None, max_length=40)
    payment_method: Literal["razorpay", "cod"]
    session_id: str | None = Field(default=None, max_length=64)   # links the abandoned-checkout draft
    gift_code: str | None = Field(default=None, max_length=40)
    whatsapp_opt_in: bool = False                                 # "Send me new arrivals on WhatsApp"


class VerifyIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class AbandonIn(BaseModel):
    razorpay_order_id: str


class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(pattern=r"^[6-9][0-9]{9}$")
    email: str | None = Field(default=None, max_length=200, pattern=r"^$|^[^@\s]+@[^@\s]+\.[^@\s]+$")
    message: str = Field(min_length=5, max_length=2000)
    website: str = ""  # honeypot: real people leave it empty
