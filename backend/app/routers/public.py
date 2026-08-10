from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, validator
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

class FeedbackSubmit(BaseModel):
    feedback_text: str
    
    @validator('feedback_text')
    def feedback_text_must_not_be_empty(cls, v):
        v = v.strip()
        if len(v) < 10:
            raise ValueError('Feedback must be at least 10 characters long.')
        if len(v) > 1000:
            raise ValueError('Feedback must be under 1000 characters.')
        return v

@router.post("/vendor/{vendor_id}/feedback")
def submit_public_feedback(vendor_id: str, feedback: FeedbackSubmit):
    # Verify vendor exists
    vendor_res = supabase.table("vendors").select("id, trust_score").eq("id", vendor_id).execute()
    if not vendor_res.data:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    # Insert ticket
    supabase.table("feedback_tickets").insert({
        "vendor_id": vendor_id,
        "feedback_text": feedback.feedback_text,
        "status": "open"
    }).execute()
    
    # Slight score decay as penalty (e.g. -2 points)
    current_score = vendor_res.data[0]["trust_score"]
    new_score = max(0, current_score - 2)
    supabase.table("vendors").update({"trust_score": new_score}).eq("id", vendor_id).execute()
    
    return {"message": "Feedback submitted successfully."}

@router.get("/widget/{vendor_id}")
def get_trust_widget(vendor_id: str):
    vendor_res = supabase.table("vendors").select("business_name, trust_score, verified").eq("id", vendor_id).execute()
    if not vendor_res.data:
        return Response(content="<svg xmlns='http://www.w3.org/2000/svg'><text>Not Found</text></svg>", media_type="image/svg+xml")
        
    vendor = vendor_res.data[0]
    score = vendor["trust_score"]
    
    color = "#E53E3E"
    if score >= 90: color = "#00B37E"
    elif score >= 70: color = "#38A169"
    elif score >= 50: color = "#F6AD55"
    
    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" width="220" height="70" viewBox="0 0 220 70">
        <rect width="220" height="70" rx="8" fill="#ffffff" stroke="#E2E8F0" stroke-width="1"/>
        
        <!-- Score Circle -->
        <circle cx="35" cy="35" r="20" fill="none" stroke="{color}" stroke-width="3"/>
        <text x="35" y="40" font-family="-apple-system, sans-serif" font-size="16" font-weight="bold" fill="{color}" text-anchor="middle">{int(score)}</text>
        
        <!-- Text -->
        <text x="70" y="30" font-family="-apple-system, sans-serif" font-size="14" font-weight="bold" fill="#1A202C">{vendor['business_name']}</text>
        <text x="70" y="48" font-family="-apple-system, sans-serif" font-size="11" fill="#718096" font-weight="bold" letter-spacing="0.5">KLEANMARK VERIFIED</text>
    </svg>"""
    
    return Response(content=svg_content, media_type="image/svg+xml")
