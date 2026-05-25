from pydantic import BaseModel

class RewardRedeemRequest(BaseModel):
    customer_email: str
    reward_tier_id: str
