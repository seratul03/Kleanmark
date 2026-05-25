from fastapi import APIRouter, Depends, HTTPException
from app.database import supabase
from app.dependencies import get_current_vendor
from app.utils.qr_generator import generate_qr_base64
import uuid

router = APIRouter(prefix="/qr", tags=["qr"])

@router.get("/generate")
def generate_qr(current_vendor: dict = Depends(get_current_vendor)):
    vendor_id = current_vendor["id"]
    
    # Generate QR as base64
    qr_base64 = generate_qr_base64(vendor_id)
    
    # Save to database (optional, but good for caching if we don't want to re-gen every time)
    supabase.table("vendors").update({"qr_code": qr_base64}).eq("id", vendor_id).execute()
    
    return {"qr_code": qr_base64}
