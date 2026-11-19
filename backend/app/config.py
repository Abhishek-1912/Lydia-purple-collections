from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    cors_origins: str = "http://localhost:5173"

    free_shipping_above: int = 1999
    shipping_fee: int = 99
    cod_fee: int = 49
    cod_max_order: int = 15000
    payment_timeout_minutes: int = 30
    shop_pin: str = ""
    dispatch_days: int = 1

    resend_api_key: str = ""
    email_from: str = "Lydia Purple Collections <orders@example.com>"
    shop_email: str = ""

    whatsapp_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_template_order: str = ""
    whatsapp_template_shipped: str = ""
    whatsapp_template_cart: str = ""      # abandoned-cart reminder template (off when blank)
    site_url: str = ""                    # e.g. https://lydiapurple.in — used in reminder links
    shop_whatsapp: str = ""

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def razorpay_enabled(self) -> bool:
        return bool(self.razorpay_key_id and self.razorpay_key_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()
