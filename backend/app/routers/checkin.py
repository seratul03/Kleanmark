from fastapi import APIRouter, Depends, HTTPException
from app.models.checkin import CheckInRequest, CheckInResponse
from app.database import supabase
from app.dependencies import get_current_customer
from app.services.fraud import check_fraud
from datetime import datetime

router = APIRouter(prefix="/checkin", tags=["checkin"])

@router.post("/", response_model=CheckInResponse)
def customer_checkin(req: CheckInRequest, current_customer: dict = Depends(get_current_customer)):
    customer_id = current_customer["id"]
    vendor_id = req.vendor_id
    
    # 1. Validate vendor exists, is active and verified
    vendor_res = supabase.table("vendors").select("active", "verified").eq("id", vendor_id).execute()
    if not vendor_res.data:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    vendor = vendor_res.data[0]
    if not vendor["active"] or not vendor["verified"]:
        raise HTTPException(status_code=403, detail="Check-in unavailable for this vendor")
        
    # 2. Check 1 per day rule
    today = datetime.now().date().isoformat()
    visit_res = supabase.table("visits").select("id").eq("customer_id", customer_id).eq("vendor_id", vendor_id).eq("visit_date", today).execute()
    
    if visit_res.data:
        raise HTTPException(status_code=429, detail="Already checked in today")
        
    # 3. Check fraud flags
    if check_fraud(customer_id, vendor_id):
        raise HTTPException(status_code=403, detail="Account flagged for suspicious activity")
        
    # 4. Insert visit
    supabase.table("visits").insert({
        "customer_id": customer_id,
        "vendor_id": vendor_id,
        "visit_date": today
    }).execute()
    
    # 5. Upsert loyalty progress
    prog_res = supabase.table("loyalty_progress").select("*").eq("customer_id", customer_id).eq("vendor_id", vendor_id).execute()
    
    current_stars = 0
    if prog_res.data:
        current_stars = prog_res.data[0]["stars"]
        new_stars = current_stars + 1
        supabase.table("loyalty_progress").update({"stars": new_stars}).eq("id", prog_res.data[0]["id"]).execute()
        current_stars = new_stars
    else:
        new_stars = 1
        supabase.table("loyalty_progress").insert({
            "customer_id": customer_id,
            "vendor_id": vendor_id,
            "stars": new_stars
        }).execute()
        current_stars = new_stars
        
    # 6. Check rewards
    rewards_res = supabase.table("reward_tiers").select("*").eq("active", True).order("required_stars").execute()
    
    reward_unlocked = False
    next_reward = None
    visits_needed = None
    
    for tier in rewards_res.data:
        if current_stars >= tier["required_stars"]:
            # Potentially unlocked, but we need to check if they already redeemed it?
            # MVP logic: we just flag reward_unlocked=True if they have enough stars for ANY tier
            # and they have an un-redeemed reward? Actually, for MVP:
            reward_unlocked = True
        elif current_stars < tier["required_stars"]:
            next_reward = tier["reward_name"]
            visits_needed = tier["required_stars"] - current_stars
            break # only show the next upcoming tier
            
    return {
        "stars": current_stars,
        "reward_unlocked": reward_unlocked,
        "next_reward": next_reward,
        "visits_needed": visits_needed
    }
