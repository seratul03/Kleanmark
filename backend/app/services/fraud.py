from app.database import supabase
from datetime import datetime

def check_fraud(customer_id: str, vendor_id: str) -> bool:
    # Rule: suspicious pattern detection
    # if same customer checks in at same vendor >25 times in a month -> flag
    
    # Get visits this month
    today = datetime.now()
    first_day = today.replace(day=1).strftime("%Y-%m-%d")
    
    response = supabase.table("visits").select("id", count="exact").eq("customer_id", customer_id).eq("vendor_id", vendor_id).gte("visit_date", first_day).execute()
    
    count = response.count if response.count else 0
    
    if count >= 25:
        # Flag in DB
        flag_data = {
            "customer_id": customer_id,
            "vendor_id": vendor_id,
            "reason": f"Excessive check-ins: {count+1} times this month",
        }
        # Avoid duplicate flags for same reason
        existing = supabase.table("fraud_flags").select("id").eq("customer_id", customer_id).eq("vendor_id", vendor_id).eq("resolved", False).execute()
        if not existing.data:
            supabase.table("fraud_flags").insert(flag_data).execute()
            
        return True # Flagged
        
    return False
