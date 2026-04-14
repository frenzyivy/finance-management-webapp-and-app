from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from enum import Enum


class SubscriptionCategory(str, Enum):
    ai_tools = "ai_tools"
    outreach = "outreach"
    email_marketing = "email_marketing"
    hosting = "hosting"
    domain = "domain"
    design = "design"
    analytics = "analytics"
    crm = "crm"
    communication = "communication"
    development = "development"
    storage = "storage"
    other = "other"


class BillingCycle(str, Enum):
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"


class SubscriptionStatus(str, Enum):
    active = "active"
    paused = "paused"
    cancelled = "cancelled"
    trial = "trial"


class FundedFrom(str, Enum):
    personal_pocket = "personal_pocket"
    business_revenue = "business_revenue"
    mixed = "mixed"


class BusinessSubscriptionCreate(BaseModel):
    name: str
    category: SubscriptionCategory
    vendor_url: Optional[str] = None
    cost_amount: float = Field(gt=0)
    cost_currency: str = "INR"
    billing_cycle: BillingCycle
    renewal_day: int = Field(ge=1, le=31)
    next_renewal_date: date
    start_date: date
    status: SubscriptionStatus = SubscriptionStatus.active
    trial_ends_date: Optional[date] = None
    auto_renew: bool = True
    funded_from: FundedFrom = FundedFrom.personal_pocket
    is_essential: bool = True
    notes: Optional[str] = None
    reminder_days_before: int = 3


class BusinessSubscriptionUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[SubscriptionCategory] = None
    vendor_url: Optional[str] = None
    cost_amount: Optional[float] = Field(default=None, gt=0)
    cost_currency: Optional[str] = None
    billing_cycle: Optional[BillingCycle] = None
    renewal_day: Optional[int] = Field(default=None, ge=1, le=31)
    next_renewal_date: Optional[date] = None
    start_date: Optional[date] = None
    status: Optional[SubscriptionStatus] = None
    trial_ends_date: Optional[date] = None
    auto_renew: Optional[bool] = None
    funded_from: Optional[FundedFrom] = None
    is_essential: Optional[bool] = None
    notes: Optional[str] = None
    reminder_days_before: Optional[int] = None


class BusinessSubscriptionResponse(BaseModel):
    id: str
    user_id: str
    name: str
    category: SubscriptionCategory
    vendor_url: Optional[str]
    cost_amount: float
    cost_currency: str
    billing_cycle: BillingCycle
    monthly_equivalent: Optional[float]
    renewal_day: int
    next_renewal_date: date
    start_date: date
    status: SubscriptionStatus
    trial_ends_date: Optional[date]
    auto_renew: bool
    funded_from: FundedFrom
    is_essential: bool
    notes: Optional[str]
    reminder_days_before: int
    created_at: str
    updated_at: str
