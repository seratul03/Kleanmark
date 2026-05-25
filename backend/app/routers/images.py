from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from app.database import supabase
from app.dependencies import get_current_vendor, require_active_vendor
import uuid
from typing import Literal

router = APIRouter(prefix="/images", tags=["images"])

@router.post("/upload")
async def upload_proof_image(
    image_type: Literal["Kitchen", "Staff Hygiene", "Storage Area", "Packaging Area", "Shop Front"] = Form(...),
    file: UploadFile = File(...),
    current_vendor: dict = Depends(require_active_vendor)
):
    vendor_id = current_vendor["id"]
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{vendor_id}/{image_type}_{uuid.uuid4().hex[:8]}.{ext}"
    
    file_bytes = await file.read()
    
    try:
        # Upload to Supabase Storage
        res = supabase.storage.from_("proof-images").upload(
            path=filename,
            file=file_bytes,
            file_options={"content-type": file.content_type}
        )
        
        # Get public URL
        public_url = supabase.storage.from_("proof-images").get_public_url(filename)
        
        # Mark previous image of this type as not current
        supabase.table("proof_images").update({"is_current": False}).eq("vendor_id", vendor_id).eq("image_type", image_type).execute()
        
        # Insert new image record
        new_image = {
            "vendor_id": vendor_id,
            "image_type": image_type,
            "image_url": public_url,
            "is_current": True
        }
        db_res = supabase.table("proof_images").insert(new_image).execute()
        
        # Update last_image_at
        supabase.table("vendors").update({"last_image_at": "now()"}).eq("id", vendor_id).execute()
        
        # Recalculate trust score (to be implemented)
        
        return {"message": "Image uploaded successfully", "image_url": public_url, "id": db_res.data[0]["id"]}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")

@router.get("/my")
def get_my_images(current_vendor: dict = Depends(get_current_vendor)):
    vendor_id = current_vendor["id"]
    response = supabase.table("proof_images").select("*").eq("vendor_id", vendor_id).eq("is_current", True).execute()
    return response.data
