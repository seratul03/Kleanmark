from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date

class VendorCreate(BaseModel):
    business_name: str
    owner_name: str
    email: str
    address: str
    category: str
    password: str

class VendorLogin(BaseModel):
    email: str
    password: str

class VendorUpdate(BaseModel):
    address: Optional[str] = None
    category: Optional[str] = None
    staff_pin: Optional[str] = None

class VendorOut(BaseModel):
    id: str
    business_name: str
    owner_name: str
    email: str
    address: Optional[str]
    category: Optional[str]
    trust_score: float
    verified: bool
    active: bool
    qr_code: Optional[str]
    created_at: datetime
    last_checklist_at: Optional[datetime]
    last_image_at: Optional[datetime]
    renewal_deadline: Optional[date]
    renewal_warned: bool
    staff_pin: Optional[str] = None

class VendorSubscribe(BaseModel):
    plan_id: str
