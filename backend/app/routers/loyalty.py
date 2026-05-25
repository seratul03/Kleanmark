from fastapi import APIRouter, Depends
from app.database import supabase
from app.dependencies import get_current_customer
from app.models.loyalty import LoyaltyProgressOut

router = APIRouter(prefix="/loyalty", tags=["loyalty"])

@router.get("/progress", response_model=LoyaltyProgressOut)
def get_loyalty_progress(vendor_id: str, current_customer: dict = Depends(get_current_customer)):
    customer_id = current_customer["id"]
    
    # 1. Get current stars
    prog_res = supabase.table("loyalty_progress").select("stars").eq("customer_id", customer_id).eq("vendor_id", vendor_id).execute()
    stars = prog_res.data[0]["stars"] if prog_res.data else 0
    
    # 2. Get all active reward tiers
    tiers_res = supabase.table("reward_tiers").select("*").eq("active", True).order("required_stars").execute()
    all_tiers = tiers_res.data
    
    # 3. Get redemptions for this vendor+customer
    redemptions_res = supabase.table("redemptions").select("reward_tier_id, redeemed_at").eq("customer_id", customer_id).eq("vendor_id", vendor_id).execute()
    redeemed_tier_ids = [r["reward_tier_id"] for r in redemptions_res.data]
    
    # 4. Calculate unlocked vs next
    unlocked_rewards = []
    next_reward_name = None
    stars_needed = None
    
    for tier in all_tiers:
        if stars >= tier["required_stars"]:
            # It's unlocked (whether redeemed or not, we handle frontend UI later)
            unlocked_rewards.append(tier)
        elif next_reward_name is None:
            # First tier they haven't reached
            next_reward_name = tier["reward_name"]
            stars_needed = tier["required_stars"] - stars
            
    return {
        "stars": stars,
        "next_reward_name": next_reward_name,
        "stars_needed": stars_needed,
        "all_tiers": all_tiers,
        "unlocked_rewards": unlocked_rewards,
        "redeemed_rewards": redemptions_res.data
    }
