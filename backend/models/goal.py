from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from enum import Enum


class PriorityLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class GoalStatus(str, Enum):
    active = "active"
    paused = "paused"
    completed = "completed"
    cancelled = "cancelled"


class GoalCreate(BaseModel):
    name: str
    target_amount: float = Field(gt=0)
    current_amount: float = Field(default=0, ge=0)
    priority: PriorityLevel = PriorityLevel.medium
    target_date: Optional[date] = None
    notes: Optional[str] = None


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = Field(default=None, gt=0)
    current_amount: Optional[float] = Field(default=None, ge=0)
    priority: Optional[PriorityLevel] = None
    status: Optional[GoalStatus] = None
    target_date: Optional[date] = None
    notes: Optional[str] = None


class GoalResponse(BaseModel):
    id: str
    user_id: str
    name: str
    target_amount: float
    current_amount: float
    priority: PriorityLevel
    status: GoalStatus
    target_date: Optional[date]
    notes: Optional[str]
    created_at: str
    updated_at: str


class ContributionCreate(BaseModel):
    amount: float = Field(gt=0)
    date: date
    notes: Optional[str] = None


class ContributionResponse(BaseModel):
    id: str
    goal_id: str
    user_id: str
    amount: float
    date: date
    notes: Optional[str]
    created_at: str
