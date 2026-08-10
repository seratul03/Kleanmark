from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, validator
from app.models.vendor import VendorCreate, VendorLogin, VendorOut, VendorUpdate, VendorSubscribe
from app.database import supabase
from app.dependencies import get_current_vendor
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter(prefix="/vendors", tags=["vendors"])

@router.post("/register")
def register_vendor(vendor: VendorCreate):
    # 1. Check if profile already exists in our table
    existing = supabase.table("vendors").select("id").eq("email", vendor.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # 2. Register user in Supabase Auth
    try:
        auth_response = supabase.auth.sign_up({
            "email": vendor.email,
            "password": vendor.password
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=500, detail="Failed to create user in Auth system")
            
        new_user_id = auth_response.user.id
        
        # 3. Create Vendor Profile
        new_vendor = {
            "id": new_user_id,
            "business_name": vendor.business_name,
            "owner_name": vendor.owner_name,
            "email": vendor.email,
            "address": vendor.address,
            "category": vendor.category,
            "verified": False,
            "active": True
        }
        
        response = supabase.table("vendors").insert(new_vendor).execute()
        if not response.data:
            # Cleanup Auth user if profile fails (ideally handled via DB triggers, but doing basic fallback here)
            # Cannot easily delete auth.users from client without service_role key, so we'll just raise error
            raise HTTPException(status_code=500, detail="Failed to create vendor profile")
            
        return {"message": "Registration successful. Awaiting admin approval.", "vendor_id": new_user_id}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Registration failed. The email may already be registered or the password does not meet the requirements.")

@router.post("/login")
def login_vendor(creds: VendorLogin):
    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": creds.email,
            "password": creds.password
        })
        
        if not auth_response.session:
            raise HTTPException(status_code=401, detail="Invalid email or password")
            
        # We return the actual Supabase JWT so the frontend can use it!
        return {
            "access_token": auth_response.session.access_token, 
            "token_type": "bearer"
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid email or password")

class ForgotPasswordRequest(BaseModel):
    email: str

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    try:
        # Supabase handles the email sending automatically
        supabase.auth.reset_password_email(req.email)
        return {"message": "If that email is registered, a real OTP has been sent."}
    except Exception as e:
        # Hide actual errors to prevent email enumeration, or return it for debugging
        return {"message": "If that email is registered, a real OTP has been sent."}

class ResetPasswordRequest(BaseModel):
    email: str
    otp_code: str
    new_password: str

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    try:
        # Verify OTP code sent to email
        auth_res = supabase.auth.verify_otp({
            "email": req.email,
            "token": req.otp_code,
            "type": "recovery"
        })
        
        if not auth_res.user:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")
            
        # Use admin API with the verified user's ID to reset the password securely
        supabase.auth.admin.update_user_by_id(
            auth_res.user.id,
            {"password": req.new_password}
        )
        
        return {"message": "Password reset successfully."}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code. Please request a new one.")

@router.get("/me", response_model=VendorOut)
def get_vendor_profile(current_vendor: dict = Depends(get_current_vendor)):
    return current_vendor

@router.put("/me", response_model=VendorOut)
def update_vendor_profile(vendor_update: VendorUpdate, current_vendor: dict = Depends(get_current_vendor)):
    update_data = {k: v for k, v in vendor_update.dict().items() if v is not None}
    
    if not update_data:
        return current_vendor
        
    # Hash staff PIN if it is being updated
    if "staff_pin" in update_data:
        update_data["staff_pin"] = pwd_context.hash(update_data["staff_pin"])
        
    response = supabase.table("vendors").update(update_data).eq("id", current_vendor["id"]).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to update vendor")
        
    return response.data[0]

@router.get("/subscriptions/plans")
def get_vendor_subscription_plans():
    # Publicly accessible or vendor accessible
    res = supabase.table("subscription_plans").select("*").eq("active", True).order("price").execute()
    return res.data

@router.post("/subscriptions/subscribe")
def vendor_subscribe(data: VendorSubscribe, current_vendor: dict = Depends(get_current_vendor)):
    vendor_id = current_vendor["id"]
    
    # 1. Fetch plan
    plan_res = supabase.table("subscription_plans").select("*").eq("id", data.plan_id).execute()
    if not plan_res.data:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    plan = plan_res.data[0]
    
    # 2. Insert subscription
    sub_data = {
        "vendor_id": vendor_id,
        "plan_name": plan["name"],
        "amount": plan["price"],
        "status": "active"
    }
    
    supabase.table("subscriptions").insert(sub_data).execute()
    
    # 3. Update renewal deadline (+30 days)
    new_deadline = (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()
    
    supabase.table("vendors").update({
        "renewal_deadline": new_deadline,
        "renewal_warned": False
    }).eq("id", vendor_id).execute()
    
    return {"message": f"Successfully subscribed to {plan['name']}", "renewal_deadline": new_deadline}

@router.get("/analytics")
def get_vendor_analytics(current_vendor: dict = Depends(get_current_vendor)):
    vendor_id = current_vendor["id"]
    
    # Total scans
    scans = current_vendor.get("total_scans") or 0
    
    # Total checkins (visits)
    visits_res = supabase.table("visits").select("id").eq("vendor_id", vendor_id).execute()
    checkins = len(visits_res.data) if visits_res.data else 0
    
    conversion_rate = 0
    if scans > 0:
        conversion_rate = round((checkins / scans) * 100, 1)
        
    return {
        "total_scans": scans,
        "total_checkins": checkins,
        "conversion_rate": conversion_rate
    }

@router.get("/tickets")
def get_vendor_tickets(current_vendor: dict = Depends(get_current_vendor)):
    vendor_id = current_vendor["id"]
    tickets_res = supabase.table("feedback_tickets").select("*").eq("vendor_id", vendor_id).order("created_at", desc=True).execute()
    return tickets_res.data

class ResolveTicketRequest(BaseModel):
    resolution_image_url: str

@router.post("/tickets/{ticket_id}/resolve")
def resolve_vendor_ticket(ticket_id: str, req: ResolveTicketRequest, current_vendor: dict = Depends(get_current_vendor)):
    vendor_id = current_vendor["id"]
    
    ticket_res = supabase.table("feedback_tickets").select("*").eq("id", ticket_id).eq("vendor_id", vendor_id).execute()
    if not ticket_res.data:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    ticket = ticket_res.data[0]
    if ticket["status"] == "resolved":
        raise HTTPException(status_code=400, detail="Ticket is already resolved")
        
    from datetime import datetime, timezone
    supabase.table("feedback_tickets").update({
        "status": "resolved",
        "resolution_image_url": req.resolution_image_url,
        "resolved_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", ticket_id).execute()
    
    # Reward for resolving (e.g. +3 points)
    vendor_score = current_vendor["trust_score"]
    new_score = min(100, vendor_score + 3)
    supabase.table("vendors").update({"trust_score": new_score}).eq("id", vendor_id).execute()
    
    return {"message": "Ticket resolved successfully."}
