from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AdminLogin(BaseModel):
    username: str
    password: str

class TrustScoreOverride(BaseModel):
    trust_score: float

class RewardTierCreate(BaseModel):
    required_stars: int
    reward_name: str

class VendorCreateByAdmin(BaseModel):
    business_name: str
    owner_name: str
    email: str
    address: Optional[str] = None
    category: Optional[str] = None
    password: str
    trust_score: float = 0.0
    verified: bool = False
    active: bool = True

class VendorUpdateByAdmin(BaseModel):
    business_name: Optional[str] = None
    owner_name: Optional[str] = None
    address: Optional[str] = None
    category: Optional[str] = None

class VendorSuspend(BaseModel):
    reason: str

class SubscriptionCreate(BaseModel):
    vendor_id: str
    plan_name: str
    amount: float
    end_date: Optional[datetime] = None

class AdminLogOut(BaseModel):
    id: str
    admin_username: str
    action: str
    target_id: Optional[str]
    details: Optional[str]
    created_at: datetime
    active: bool = True

class SubscriptionPlanCreate(BaseModel):
    name: str
    price: float
    description_1: Optional[str] = None
    description_2: Optional[str] = None
    description_3: Optional[str] = None

class SubscriptionPlanUpdate(BaseModel):
    price: Optional[float] = None
    description_1: Optional[str] = None
    description_2: Optional[str] = None
    description_3: Optional[str] = None
    active: Optional[bool] = None

class ImageScoreSubmit(BaseModel):
    score: int
