from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from enum import Enum


class ExpenseCategory(str, Enum):
    food = "food"
    transportation = "transportation"
    housing = "housing"
    utilities = "utilities"
    healthcare = "healthcare"
    entertainment = "entertainment"
    shopping = "shopping"
    education = "education"
    personal_care = "personal_care"
    insurance = "insurance"
    savings = "savings"
    debt_payment = "debt_payment"
    other = "other"


class RecurrenceFrequency(str, Enum):
    weekly = "weekly"
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"


class ExpenseCreate(BaseModel):
    amount: float = Field(gt=0)
    category: ExpenseCategory
    description: str
    date: date
    payment_method: str
    is_recurring: bool = False
    recurrence_frequency: Optional[RecurrenceFrequency] = None
    linked_goal_id: Optional[str] = None
    linked_debt_id: Optional[str] = None
    notes: Optional[str] = None


class ExpenseUpdate(BaseModel):
    amount: Optional[float] = Field(default=None, gt=0)
    category: Optional[ExpenseCategory] = None
    description: Optional[str] = None
    date: Optional[date] = None
    payment_method: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_frequency: Optional[RecurrenceFrequency] = None
    linked_goal_id: Optional[str] = None
    linked_debt_id: Optional[str] = None
    notes: Optional[str] = None


class ExpenseResponse(BaseModel):
    id: str
    user_id: str
    amount: float
    category: ExpenseCategory
    description: str
    date: date
    payment_method: str
    is_recurring: bool
    recurrence_frequency: Optional[RecurrenceFrequency]
    linked_goal_id: Optional[str]
    linked_debt_id: Optional[str]
    notes: Optional[str]
    created_at: str
    updated_at: str
