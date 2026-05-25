from fastapi import APIRouter, Depends, HTTPException
from passlib.context import CryptContext
from app.models.admin import AdminLogin, TrustScoreOverride, RewardTierCreate
from app.database import supabase
from app.config import settings
from app.utils.jwt import create_access_token
from app.dependencies import get_admin
from app.services.freshness import run_freshness_check

router = APIRouter(prefix="/admin", tags=["admin"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.post("/login")
def admin_login(creds: AdminLogin):
    if creds.username != settings.ADMIN_USERNAME:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
        
    if not pwd_context.verify(creds.password, settings.ADMIN_PASSWORD_HASH):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
        
    access_token = create_access_token(data={"sub": "admin", "role": "admin"})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/vendors")
def list_vendors(admin: dict = Depends(get_admin)):
    response = supabase.table("vendors").select("id, business_name, category, trust_score, verified, active, created_at").order("created_at", desc=True).execute()
    return response.data

@router.put("/vendors/{vendor_id}/approve")
def approve_vendor(vendor_id: str, admin: dict = Depends(get_admin)):
    response = supabase.table("vendors").update({"verified": True}).eq("id", vendor_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"message": "Vendor approved"}

@router.put("/vendors/{vendor_id}/deactivate")
def deactivate_vendor(vendor_id: str, admin: dict = Depends(get_admin)):
    response = supabase.table("vendors").update({"active": False}).eq("id", vendor_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"message": "Vendor deactivated"}

@router.put("/vendors/{vendor_id}/trust-override")
def override_trust_score(vendor_id: str, data: TrustScoreOverride, admin: dict = Depends(get_admin)):
    response = supabase.table("vendors").update({"trust_score": data.trust_score}).eq("id", vendor_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"message": "Trust score updated manually"}

@router.get("/images/{vendor_id}")
def get_vendor_images(vendor_id: str, admin: dict = Depends(get_admin)):
    response = supabase.table("proof_images").select("*").eq("vendor_id", vendor_id).eq("is_current", True).execute()
    return response.data

@router.get("/fraud-flags")
def list_fraud_flags(admin: dict = Depends(get_admin)):
    # Using a join or separate queries.
    # Supabase allows joined queries if foreign keys are set. Let's try basic select first, frontend might need separate info
    response = supabase.table("fraud_flags").select("*, customers(email), vendors(business_name)").order("flagged_at", desc=True).execute()
    return response.data

@router.put("/fraud-flags/{flag_id}/resolve")
def resolve_fraud_flag(flag_id: str, admin: dict = Depends(get_admin)):
    supabase.table("fraud_flags").update({"resolved": True}).eq("id", flag_id).execute()
    return {"message": "Flag resolved"}

@router.get("/reports/summary")
def get_summary(admin: dict = Depends(get_admin)):
    vendors_res = supabase.table("vendors").select("id", count="exact").execute()
    total_vendors = vendors_res.count if vendors_res.count else 0
    
    score_res = supabase.table("vendors").select("trust_score").execute()
    avg_score = 0
    if score_res.data:
        avg_score = sum(v["trust_score"] for v in score_res.data) / len(score_res.data)
        
    visits_res = supabase.table("visits").select("id", count="exact").execute()
    total_visits = visits_res.count if visits_res.count else 0
    
    fraud_res = supabase.table("fraud_flags").select("id", count="exact").eq("resolved", False).execute()
    active_fraud = fraud_res.count if fraud_res.count else 0
    
    return {
        "total_vendors": total_vendors,
        "avg_trust_score": round(avg_score, 2),
        "total_visits": total_visits,
        "active_fraud_flags": active_fraud
    }

@router.post("/run-freshness-check")
def trigger_freshness(admin: dict = Depends(get_admin)):
    return run_freshness_check()

@router.post("/rewards/tiers")
def create_reward_tier(tier: RewardTierCreate, admin: dict = Depends(get_admin)):
    res = supabase.table("reward_tiers").insert(tier.dict()).execute()
    return res.data[0]

@router.put("/rewards/tiers/{tier_id}")
def update_reward_tier(tier_id: str, tier: RewardTierCreate, admin: dict = Depends(get_admin)):
    res = supabase.table("reward_tiers").update(tier.dict()).eq("id", tier_id).execute()
    return res.data[0]
