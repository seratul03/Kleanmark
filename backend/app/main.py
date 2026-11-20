from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import vendor, checklist, images, trust, qr, checkin, loyalty, rewards, public, admin, otp

app = FastAPI(title="KleanMark API", version="1.0.0")

# Allow CORS from any localhost or 127.0.0.1 port (Live Server 5500/5501, Vite, etc.)
ALLOWED_ORIGINS = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:5501",
    "http://127.0.0.1:5501",
    "http://localhost:5504",
    "http://127.0.0.1:5504",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vendor.router)
app.include_router(checklist.router)
app.include_router(images.router)
app.include_router(trust.router)
app.include_router(qr.router)
app.include_router(checkin.router)
app.include_router(loyalty.router)
app.include_router(rewards.router)
app.include_router(public.router)
app.include_router(admin.router)
app.include_router(otp.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to KleanMark API"}
