import random
from app.database import supabase
from datetime import datetime, timedelta, timezone

def send_mock_otp(email: str) -> str:
    # Generate 6 digit OTP
    otp_code = str(random.randint(100000, 999999))
    
    # Expires in 10 minutes
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Insert into DB
    new_otp = {
        "email": email,
        "otp_code": otp_code,
        "expires_at": expires_at.isoformat(),
        "used": False
    }
    supabase.table("otp_tokens").insert(new_otp).execute()
    
    # Log to console
    print(f"=====================================")
    print(f"MOCK OTP for {email}: {otp_code}")
    print(f"=====================================")
    
    return otp_code

def verify_otp(email: str, otp_code: str) -> bool:
    # Find latest valid OTP
    now = datetime.now(timezone.utc).isoformat()
    response = supabase.table("otp_tokens").select("*").eq("email", email).eq("used", False).gte("expires_at", now).order("created_at", desc=True).limit(1).execute()
    
    if not response.data:
        return False
        
    db_otp = response.data[0]
    
    if db_otp["otp_code"] == otp_code:
        # Mark as used
        supabase.table("otp_tokens").update({"used": True}).eq("id", db_otp["id"]).execute()
        return True
        
    return False
