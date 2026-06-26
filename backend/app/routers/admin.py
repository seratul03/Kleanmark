from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from passlib.context import CryptContext
from app.models.admin import (
    AdminLogin, TrustScoreOverride, RewardTierCreate, 
    VendorCreateByAdmin, VendorUpdateByAdmin, VendorSuspend, 
    SubscriptionCreate, AdminLogOut,
    SubscriptionPlanCreate, SubscriptionPlanUpdate, ImageScoreSubmit
)
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

def log_admin_action(admin_username: str, action: str, target_id: str = None, details: str = None):
    try:
        supabase.table("admin_logs").insert({
            "admin_username": admin_username,
            "action": action,
            "target_id": target_id,
            "details": details
        }).execute()
    except Exception:
        pass # Ignore if admin_logs table is missing


@router.get("/dashboard/analytics")
def get_dashboard_analytics(admin: dict = Depends(get_admin)):
    # Calculate total vendors, average score, active fraud from get_summary logic
    summary = get_summary(admin)
    
    # Active plans & Revenue
    try:
        subs_res = supabase.table("subscriptions").select("amount").eq("status", "active").execute()
        active_plans_count = len(subs_res.data) if subs_res.data else 0
        monthly_revenue = sum(sub["amount"] for sub in subs_res.data) if subs_res.data else 0.0
    except Exception as e:
        # Fallback if table doesn't exist yet
        active_plans_count = 0
        monthly_revenue = 0.0

    # Verification queue count
    queue_res = supabase.table("vendors").select("id", count="exact").eq("verified", False).execute()
    verification_queue_count = queue_res.count if queue_res.count else 0
    
    summary["active_plans_count"] = active_plans_count
    summary["monthly_revenue"] = monthly_revenue
    summary["verification_queue_count"] = verification_queue_count
    return summary

@router.post("/vendors")
def create_vendor(data: VendorCreateByAdmin, admin: dict = Depends(get_admin)):
    # Hash password
    data_dict = data.dict()
    data_dict["password_hash"] = pwd_context.hash(data_dict.pop("password"))
    res = supabase.table("vendors").insert(data_dict).execute()
    log_admin_action(admin["username"], "Created Vendor", res.data[0]["id"], f"Business: {data.business_name}")
    return res.data[0]

@router.put("/vendors/{vendor_id}")
def update_vendor(vendor_id: str, data: VendorUpdateByAdmin, admin: dict = Depends(get_admin)):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        return {"message": "No fields to update"}
    res = supabase.table("vendors").update(update_data).eq("id", vendor_id).execute()
    log_admin_action(admin["username"], "Updated Vendor", vendor_id, f"Fields: {list(update_data.keys())}")
    return res.data[0]

@router.put("/vendors/{vendor_id}/suspend")
def suspend_vendor(vendor_id: str, data: VendorSuspend, admin: dict = Depends(get_admin)):
    res = supabase.table("vendors").update({"active": False}).eq("id", vendor_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Vendor not found")
    log_admin_action(admin["username"], "Suspended Vendor", vendor_id, f"Reason: {data.reason}")
    return {"message": "Vendor suspended successfully"}

@router.get("/verifications/pending")
def get_pending_verifications(admin: dict = Depends(get_admin)):
    # Fetch vendors that are not verified yet
    vendors_res = supabase.table("vendors").select("*").eq("verified", False).execute()
    
    vendors = vendors_res.data
    # for each vendor, we could attach their checklist answers
    for v in vendors:
        checklist_res = supabase.table("checklist_answers").select("*").eq("vendor_id", v["id"]).execute()
        v["checklist"] = checklist_res.data
        
    return vendors

@router.get("/rewards/tiers")
def list_reward_tiers(admin: dict = Depends(get_admin)):
    res = supabase.table("reward_tiers").select("*").order("required_stars", desc=False).execute()
    return res.data

@router.delete("/rewards/tiers/{tier_id}")
def delete_reward_tier(tier_id: str, admin: dict = Depends(get_admin)):
    supabase.table("reward_tiers").delete().eq("id", tier_id).execute()
    log_admin_action(admin["username"], "Deleted Reward Tier", tier_id)
    return {"message": "Tier deleted"}

@router.get("/logs")
def list_admin_logs(admin: dict = Depends(get_admin)):
    try:
        res = supabase.table("admin_logs").select("*").order("created_at", desc=True).execute()
        return res.data
    except Exception:
        # Fallback if admin_logs table doesn't exist yet
        return []

@router.get("/subscriptions/plans")
def get_subscription_plans(admin: dict = Depends(get_admin)):
    res = supabase.table("subscription_plans").select("*").order("name").execute()
    return res.data

@router.post("/subscriptions/plans")
def create_subscription_plan(data: SubscriptionPlanCreate, admin: dict = Depends(get_admin)):
    res = supabase.table("subscription_plans").insert(data.dict()).execute()
    log_admin_action(admin["username"], "Created Subscription Plan", res.data[0]["id"], f"Plan: {data.name}")
    return res.data[0]

@router.get("/subscriptions/active")
def get_active_subscriptions(admin: dict = Depends(get_admin)):
    res = supabase.table("subscriptions").select("*, vendors(business_name, email)").eq("status", "active").order("start_date", desc=True).execute()
    return res.data

@router.put("/subscriptions/plans/{plan_id}")
def update_subscription_plan(plan_id: str, data: SubscriptionPlanUpdate, admin: dict = Depends(get_admin)):
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        return {"message": "No fields to update"}
    update_data["updated_at"] = datetime.now().isoformat()
    res = supabase.table("subscription_plans").update(update_data).eq("id", plan_id).execute()
    log_admin_action(admin["username"], "Updated Subscription Plan", plan_id)
    return res.data[0] if res.data else {"message": "Updated successfully"}

@router.get("/images/pending")
def get_pending_images(admin: dict = Depends(get_admin)):
    res = supabase.table("proof_images").select("*, vendors(business_name)").eq("status", "pending").order("uploaded_at", desc=True).execute()
    return res.data

@router.put("/images/{image_id}/score")
def score_pending_image(image_id: str, data: ImageScoreSubmit, admin: dict = Depends(get_admin)):
    if data.score < 0 or data.score > 5:
        raise HTTPException(status_code=400, detail="Score must be between 0 and 5")
    
    # get image to find vendor_id
    img_res = supabase.table("proof_images").select("vendor_id").eq("id", image_id).execute()
    if not img_res.data:
        raise HTTPException(status_code=404, detail="Image not found")
        
    vendor_id = img_res.data[0]["vendor_id"]
    
    # update image
    supabase.table("proof_images").update({
        "admin_score": data.score,
        "status": "scored"
    }).eq("id", image_id).execute()
    
    log_admin_action(admin["username"], "Scored Image", image_id, f"Score: {data.score}")
    
    # recalculate trust score
    from app.services.trust_engine import calculate_trust_score
    new_score = calculate_trust_score(vendor_id)
    
    return {"message": "Image scored successfully", "new_trust_score": new_score}
