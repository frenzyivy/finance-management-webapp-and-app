from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from enum import Enum

class IncomeCategory(str, Enum):
    salary = "salary"
    freelance = "freelance"
    borrowed = "borrowed"
    side_income = "side_income"
    other = "other"

class RecurrenceFrequency(str, Enum):
    weekly = "weekly"
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"

class IncomeCreate(BaseModel):
    amount: float = Field(gt=0)
    category: IncomeCategory
    source_name: str
    date: date
    payment_method: str
    is_recurring: bool = False
    recurrence_frequency: Optional[RecurrenceFrequency] = None
    linked_debt_id: Optional[str] = None
    notes: Optional[str] = None

class IncomeUpdate(BaseModel):
    amount: Optional[float] = Field(default=None, gt=0)
    category: Optional[IncomeCategory] = None
    source_name: Optional[str] = None
    date: Optional[date] = None
    payment_method: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_frequency: Optional[RecurrenceFrequency] = None
    linked_debt_id: Optional[str] = None
    notes: Optional[str] = None

class IncomeResponse(BaseModel):
    id: str
    user_id: str
    amount: float
    category: IncomeCategory
    source_name: str
    date: date
    payment_method: str
    is_recurring: bool
    recurrence_frequency: Optional[RecurrenceFrequency]
    linked_debt_id: Optional[str]
    notes: Optional[str]
    created_at: str
    updated_at: str
