from fastapi import APIRouter, Depends, HTTPException
from app.models.reward import RewardRedeemRequest
from app.database import supabase
from app.dependencies import get_current_vendor

router = APIRouter(prefix="/rewards", tags=["rewards"])

@router.post("/redeem")
def redeem_reward(req: RewardRedeemRequest, current_vendor: dict = Depends(get_current_vendor)):
    vendor_id = current_vendor["id"]
    
    # 1. Get customer
    cust_res = supabase.table("customers").select("id").eq("email", req.customer_email).execute()
    if not cust_res.data:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer_id = cust_res.data[0]["id"]
    
    # 2. Get reward tier
    tier_res = supabase.table("reward_tiers").select("*").eq("id", req.reward_tier_id).execute()
    if not tier_res.data:
        raise HTTPException(status_code=404, detail="Reward tier not found")
    tier = tier_res.data[0]
    
    # 3. Get customer stars
    prog_res = supabase.table("loyalty_progress").select("*").eq("customer_id", customer_id).eq("vendor_id", vendor_id).execute()
    if not prog_res.data:
        raise HTTPException(status_code=400, detail="Customer has no stars at this vendor")
        
    current_stars = prog_res.data[0]["stars"]
    
    # 4. Check if they have enough stars
    if current_stars < tier["required_stars"]:
        raise HTTPException(status_code=400, detail="Not enough stars for this reward")
        
    # 5. Check if already redeemed
    redemption_res = supabase.table("redemptions").select("id").eq("customer_id", customer_id).eq("vendor_id", vendor_id).eq("reward_tier_id", tier["id"]).execute()
    # Note: If a reward is a one-time thing, we block it.
    # If it's repeatable, we could allow multiple, but usually loyalty rewards are either repeatable or not. 
    # Let's assume we allow repeated redemption if they have stars, but wait... 
    # If we deduct stars, they can redeem again once they earn them back.
    # Let's deduct stars.
    
    new_stars = current_stars - tier["required_stars"]
    supabase.table("loyalty_progress").update({"stars": new_stars}).eq("id", prog_res.data[0]["id"]).execute()
    
    # 6. Record redemption
    supabase.table("redemptions").insert({
        "customer_id": customer_id,
        "vendor_id": vendor_id,
        "reward_tier_id": tier["id"],
        "marked_by_vendor": True
    }).execute()
    
    return {"message": "Reward redeemed successfully", "remaining_stars": new_stars}
