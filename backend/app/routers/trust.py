from fastapi import APIRouter, HTTPException
from app.database import supabase
from app.services.trust_engine import get_trust_level

router = APIRouter(prefix="/trust", tags=["trust"])

@router.get("/{vendor_id}")
def get_trust_score(vendor_id: str):
    response = supabase.table("vendors").select("trust_score, active, verified").eq("id", vendor_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    vendor = response.data[0]
    score = vendor["trust_score"]
    
    return {
        "vendor_id": vendor_id,
        "trust_score": score,
        "trust_level": get_trust_level(score),
        "active": vendor["active"],
        "verified": vendor["verified"]
    }
