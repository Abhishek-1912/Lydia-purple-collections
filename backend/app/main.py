import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import account, admin, calls, catalog, checkout, drafts, reviews

settings = get_settings()
logging.basicConfig(level=logging.INFO)


async def _expiry_loop():
    """Every 5 minutes, cancel unpaid online orders past the timeout and return their stock."""
    while True:
        await asyncio.sleep(300)
        await asyncio.to_thread(checkout.release_expired)
        try:
            await asyncio.to_thread(drafts.auto_remind)   # does nothing until WhatsApp cart template is set
        except Exception:
            logging.getLogger("drafts").exception("auto_remind failed")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(_expiry_loop()) if settings.supabase_url else None
    yield
    if task:
        task.cancel()


app = FastAPI(title="Lydia Purple Collections API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FIELD_NAMES = {"phone": "mobile number", "pin": "PIN code", "line1": "address", "name": "name",
               "email": "email", "city": "city", "state": "state", "qty": "quantity"}


@app.exception_handler(RequestValidationError)
async def friendly_validation(_req: Request, exc: RequestValidationError):
    err = exc.errors()[0] if exc.errors() else {}
    field = next((str(x) for x in reversed(err.get("loc", [])) if isinstance(x, str)), "")
    label = FIELD_NAMES.get(field, field or "details")
    msg = err.get("msg", "").removeprefix("Value error, ")
    if "pattern" in err.get("type", "") or "string_too_short" in err.get("type", ""):
        msg = f"Please check your {label}."
    return JSONResponse(status_code=422, content={"detail": {"message": msg or f"Please check your {label}.", "field": field}})


app.include_router(catalog.router)
app.include_router(checkout.router)
app.include_router(account.router)
app.include_router(admin.router)
app.include_router(reviews.router)
app.include_router(drafts.router)
app.include_router(calls.router)


@app.get("/api/health")
def health():
    return {"ok": True}
