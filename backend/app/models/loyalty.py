from pydantic import BaseModel
from typing import List, Optional

class RewardTierOut(BaseModel):
    id: str
    required_stars: int
    reward_name: str
    active: bool

class LoyaltyProgressOut(BaseModel):
    stars: int
    next_reward_name: Optional[str]
    stars_needed: Optional[int]
    all_tiers: List[RewardTierOut]
    unlocked_rewards: List[RewardTierOut]
    redeemed_rewards: List[dict] # simplified
