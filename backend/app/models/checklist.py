from pydantic import BaseModel
from typing import List

class ChecklistItem(BaseModel):
    category: str
    question: str
    answer: bool

class ChecklistSubmit(BaseModel):
    items: List[ChecklistItem]
