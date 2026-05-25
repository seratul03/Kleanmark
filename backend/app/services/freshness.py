from app.database import supabase
from datetime import datetime

def run_freshness_check():
    today = datetime.now().date()
    
    # Get all active vendors with a renewal deadline
    response = supabase.table("vendors").select("id, last_image_at, renewal_deadline").eq("active", True).not_.is_("renewal_deadline", "null").execute()
    
    flagged_count = 0
    for vendor in response.data:
        deadline_str = vendor.get("renewal_deadline")
        if not deadline_str:
            continue
            
        deadline = datetime.strptime(deadline_str, "%Y-%m-%d").date()
        
        # If past deadline
        if today > deadline:
            last_image_str = vendor.get("last_image_at")
            
            # If they never uploaded an image, or their last image was before the deadline month started
            # Simplified logic for MVP: just check if last_image_at is older than the deadline
            needs_flagging = False
            
            if not last_image_str:
                needs_flagging = True
            else:
                last_image_date = datetime.strptime(last_image_str.split("T")[0], "%Y-%m-%d").date()
                # If the last image was uploaded before the 1st of the renewal month
                month_start = deadline.replace(day=1)
                if last_image_date < month_start:
                    needs_flagging = True
                    
            if needs_flagging:
                # Mark as inactive
                supabase.table("vendors").update({"active": False}).eq("id", vendor["id"]).execute()
                flagged_count += 1
                
                # Trust score recalculation should ideally happen here or dynamically
                # Let's import inside to avoid circular deps
                from app.services.trust_engine import calculate_trust_score
                calculate_trust_score(vendor["id"])
                
    return {"status": "success", "flagged_vendors_count": flagged_count}
