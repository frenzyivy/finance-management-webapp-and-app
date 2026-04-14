from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from enum import Enum


class BusinessIncomeCategory(str, Enum):
    client_project = "client_project"
    retainer = "retainer"
    freelance_platform = "freelance_platform"
    affiliate_commission = "affiliate_commission"
    consultation = "consultation"
    one_off_gig = "one_off_gig"
    refund = "refund"
    other = "other"


class LandedIn(str, Enum):
    personal_account = "personal_account"
    business_direct = "business_direct"
    reinvested = "reinvested"


class RecurrenceFrequency(str, Enum):
    weekly = "weekly"
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"


class BusinessIncomeCreate(BaseModel):
    amount: float = Field(gt=0)
    category: BusinessIncomeCategory
    source_name: str
    project_name: Optional[str] = None
    client_id: Optional[str] = None
    invoice_number: Optional[str] = None
    date: date
    payment_method: Optional[str] = None
    landed_in: LandedIn = LandedIn.personal_account
    notes: Optional[str] = None
    is_recurring: bool = False
    recurrence_frequency: Optional[RecurrenceFrequency] = None


class BusinessIncomeUpdate(BaseModel):
    amount: Optional[float] = Field(default=None, gt=0)
    category: Optional[BusinessIncomeCategory] = None
    source_name: Optional[str] = None
    project_name: Optional[str] = None
    client_id: Optional[str] = None
    invoice_number: Optional[str] = None
    date: Optional[date] = None
    payment_method: Optional[str] = None
    landed_in: Optional[LandedIn] = None
    notes: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_frequency: Optional[RecurrenceFrequency] = None


class BusinessIncomeResponse(BaseModel):
    id: str
    user_id: str
    amount: float
    category: BusinessIncomeCategory
    source_name: str
    project_name: Optional[str]
    client_id: Optional[str]
    invoice_number: Optional[str]
    date: date
    payment_method: Optional[str]
    landed_in: LandedIn
    notes: Optional[str]
    is_recurring: bool
    recurrence_frequency: Optional[RecurrenceFrequency]
    created_at: str
    updated_at: str
