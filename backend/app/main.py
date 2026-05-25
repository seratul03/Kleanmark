from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import vendor, checklist, images, trust, qr, otp, checkin, loyalty, rewards, public, admin

app = FastAPI(title="KleanMark API", version="1.0.0")

# Allow CORS for local dev and frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vendor.router)
app.include_router(checklist.router)
app.include_router(images.router)
app.include_router(trust.router)
app.include_router(qr.router)
app.include_router(otp.router)
app.include_router(checkin.router)
app.include_router(loyalty.router)
app.include_router(rewards.router)
app.include_router(public.router)
app.include_router(admin.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to KleanMark API"}
