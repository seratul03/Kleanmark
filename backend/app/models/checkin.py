from pydantic import BaseModel

class CheckInRequest(BaseModel):
    vendor_id: str

class CheckInResponse(BaseModel):
    stars: int
    reward_unlocked: bool
    next_reward: str | None
    visits_needed: int | None
