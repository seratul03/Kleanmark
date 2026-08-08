from fastapi import APIRouter, HTTPException
from app.database import supabase

router = APIRouter(prefix="/public", tags=["public"])

@router.get("/vendor/{vendor_id}")
def get_public_vendor(vendor_id: str):
    # Get vendor basic info
    vendor_res = supabase.table("vendors").select("business_name, category, address, trust_score, verified, active, last_checklist_at, last_image_at, total_scans").eq("id", vendor_id).execute()
    
    if not vendor_res.data:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    vendor = vendor_res.data[0]
    
    # Increment scans
    new_scans = (vendor.get("total_scans") or 0) + 1
    supabase.table("vendors").update({"total_scans": new_scans}).eq("id", vendor_id).execute()
    
    # Get checklist summary
    checklist_res = supabase.table("checklist_answers").select("category, answer").eq("vendor_id", vendor_id).execute()
    checklist_summary = {}
    for item in checklist_res.data:
        cat = item["category"]
        if cat not in checklist_summary:
            checklist_summary[cat] = {"total": 0, "yes": 0}
        checklist_summary[cat]["total"] += 1
        if item["answer"]:
            checklist_summary[cat]["yes"] += 1
            
    # Get images
    images_res = supabase.table("proof_images").select("image_type, image_url").eq("vendor_id", vendor_id).eq("is_current", True).execute()
    images = {item["image_type"]: item["image_url"] for item in images_res.data}
    
    # Get reward tiers
    tiers_res = supabase.table("reward_tiers").select("*").eq("active", True).order("required_stars").execute()
    
    # Trust Level logic
    score = vendor["trust_score"]
    trust_level = "Poor"
    if score >= 90: trust_level = "Excellent"
    elif score >= 70: trust_level = "Good"
    elif score >= 50: trust_level = "Average"
    
    return {
        "vendor": vendor,
        "trust_level": trust_level,
        "checklist_summary": checklist_summary,
        "images": images,
        "reward_tiers": tiers_res.data
    }
