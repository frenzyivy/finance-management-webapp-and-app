from pydantic import BaseModel
from typing import Optional

class UserProfile(BaseModel):
    id: str
    name: Optional[str]
    currency: str = "INR"
    created_at: str
    updated_at: str
