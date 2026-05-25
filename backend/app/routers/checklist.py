from fastapi import APIRouter, Depends, HTTPException
from app.models.checklist import ChecklistSubmit
from app.database import supabase
from app.dependencies import get_current_vendor, require_active_vendor
# from app.services.trust_engine import recalculate_trust_score

router = APIRouter(prefix="/checklist", tags=["checklist"])

@router.post("/submit")
def submit_checklist(
    checklist: ChecklistSubmit, 
    current_vendor: dict = Depends(require_active_vendor)
):
    vendor_id = current_vendor["id"]
    
    # First, delete existing answers for this vendor
    supabase.table("checklist_answers").delete().eq("vendor_id", vendor_id).execute()
    
    # Insert new answers
    insert_data = [
        {
            "vendor_id": vendor_id,
            "category": item.category,
            "question": item.question,
            "answer": item.answer
        }
        for item in checklist.items
    ]
    
    response = supabase.table("checklist_answers").insert(insert_data).execute()
    
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to save checklist answers")
        
    # Update last_checklist_at
    supabase.table("vendors").update({"last_checklist_at": "now()"}).eq("id", vendor_id).execute()
    
    # Recalculate trust score (to be implemented)
    # new_score = recalculate_trust_score(vendor_id)
    
    return {"message": "Checklist saved successfully"}

@router.get("/my")
def get_my_checklist(current_vendor: dict = Depends(get_current_vendor)):
    vendor_id = current_vendor["id"]
    response = supabase.table("checklist_answers").select("*").eq("vendor_id", vendor_id).execute()
    return response.data
