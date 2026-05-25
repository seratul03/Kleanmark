from pydantic import BaseModel

class AdminLogin(BaseModel):
    username: str
    password: str

class TrustScoreOverride(BaseModel):
    trust_score: float

class RewardTierCreate(BaseModel):
    required_stars: int
    reward_name: str
    active: bool = True
