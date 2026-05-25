from fastapi import APIRouter, HTTPException, Depends
from passlib.context import CryptContext
from app.models.vendor import VendorCreate, VendorLogin, VendorOut, VendorUpdate
from app.database import supabase
from app.utils.jwt import create_access_token
from app.dependencies import get_current_vendor

router = APIRouter(prefix="/vendors", tags=["vendors"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

@router.post("/register")
def register_vendor(vendor: VendorCreate):
    # Check if email exists
    existing = supabase.table("vendors").select("id").eq("email", vendor.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_password = get_password_hash(vendor.password)
    
    new_vendor = {
        "business_name": vendor.business_name,
        "owner_name": vendor.owner_name,
        "email": vendor.email,
        "address": vendor.address,
        "category": vendor.category,
        "password_hash": hashed_password,
        "verified": False,
        "active": True
    }
    
    response = supabase.table("vendors").insert(new_vendor).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create vendor")
        
    return {"message": "Registration successful. Awaiting admin approval.", "vendor_id": response.data[0]["id"]}

@router.post("/login")
def login_vendor(creds: VendorLogin):
    response = supabase.table("vendors").select("*").eq("email", creds.email).execute()
    
    if not response.data:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    vendor = response.data[0]
    
    if not verify_password(creds.password, vendor["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    access_token = create_access_token(data={"sub": vendor["id"], "role": "vendor"})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=VendorOut)
def get_vendor_profile(current_vendor: dict = Depends(get_current_vendor)):
    return current_vendor

@router.put("/me", response_model=VendorOut)
def update_vendor_profile(vendor_update: VendorUpdate, current_vendor: dict = Depends(get_current_vendor)):
    update_data = {k: v for k, v in vendor_update.dict().items() if v is not None}
    
    if not update_data:
        return current_vendor
        
    response = supabase.table("vendors").update(update_data).eq("id", current_vendor["id"]).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to update vendor")
        
    return response.data[0]
