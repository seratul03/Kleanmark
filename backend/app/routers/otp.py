from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.otp_service import send_mock_otp, verify_otp
from app.utils.jwt import create_access_token
from app.database import supabase
from datetime import timedelta

router = APIRouter(prefix="/otp", tags=["otp"])

class SendOtpRequest(BaseModel):
    email: str

class VerifyOtpRequest(BaseModel):
    email: str
    otp: str

@router.post("/send")
def request_otp(req: SendOtpRequest):
    # Ensure customer exists or create them
    res = supabase.table("customers").select("id").eq("email", req.email).execute()
    if not res.data:
        supabase.table("customers").insert({"email": req.email}).execute()
        
    send_mock_otp(req.email)
    return {"message": "OTP sent successfully (check console)"}

@router.post("/verify")
def validate_otp(req: VerifyOtpRequest):
    is_valid = verify_otp(req.email, req.otp)
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
    # Get customer id
    res = supabase.table("customers").select("id").eq("email", req.email).execute()
    customer_id = res.data[0]["id"]
    
    # Create short lived token for customer checkin flow (24 hours)
    access_token = create_access_token(
        data={"sub": customer_id, "email": req.email, "role": "customer"},
        expires_delta=timedelta(days=1)
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/dev-peek")
def dev_peek_otp(email: str):
    # Only for development!
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    response = supabase.table("otp_tokens").select("otp_code").eq("email", email).eq("used", False).gte("expires_at", now).order("created_at", desc=True).limit(1).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="No active OTP found")
        
    return {"otp": response.data[0]["otp_code"]}
