from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.utils.jwt import decode_token
from app.database import supabase
from app.config import settings

security = HTTPBearer()

def get_current_vendor(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload or payload.get("role") != "vendor":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    vendor_id = payload.get("sub")
    if not vendor_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
        
    response = supabase.table("vendors").select("*").eq("id", vendor_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=401, detail="Vendor not found")
        
    return response.data[0]

def get_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload or payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    
    return {"username": settings.ADMIN_USERNAME, "role": "admin"}

def get_current_customer(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload or payload.get("role") != "customer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid customer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    customer_id = payload.get("sub")
    return {"id": customer_id, "email": payload.get("email")}

def require_active_vendor(vendor: dict = Depends(get_current_vendor)):
    if not vendor.get("active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vendor account is inactive. Please renew your hygiene verification."
        )
    return vendor
