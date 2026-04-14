from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from enum import Enum


class BusinessExpenseCategory(str, Enum):
    saas_tools = "saas_tools"
    marketing_ads = "marketing_ads"
    contractor_freelancer = "contractor_freelancer"
    hardware_equipment = "hardware_equipment"
    learning_courses = "learning_courses"
    travel_meetings = "travel_meetings"
    communication = "communication"
    domain_hosting = "domain_hosting"
    office_supplies = "office_supplies"
    taxes_compliance = "taxes_compliance"
    miscellaneous = "miscellaneous"


class FundedFrom(str, Enum):
    personal_pocket = "personal_pocket"
    business_revenue = "business_revenue"
    mixed = "mixed"


class RecurrenceFrequency(str, Enum):
    weekly = "weekly"
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"


class BusinessExpenseCreate(BaseModel):
    amount: float = Field(gt=0)
    category: BusinessExpenseCategory
    sub_category: Optional[str] = None
    vendor_name: str
    subscription_id: Optional[str] = None
    client_id: Optional[str] = None
    date: date
    payment_method: Optional[str] = None
    funded_from: FundedFrom = FundedFrom.personal_pocket
    personal_portion: Optional[float] = 0
    is_tax_deductible: bool = True
    gst_applicable: bool = False
    gst_amount: Optional[float] = 0
    receipt_url: Optional[str] = None
    notes: Optional[str] = None
    is_recurring: bool = False
    recurrence_frequency: Optional[RecurrenceFrequency] = None


class BusinessExpenseUpdate(BaseModel):
    amount: Optional[float] = Field(default=None, gt=0)
    category: Optional[BusinessExpenseCategory] = None
    sub_category: Optional[str] = None
    vendor_name: Optional[str] = None
    subscription_id: Optional[str] = None
    client_id: Optional[str] = None
    date: Optional[date] = None
    payment_method: Optional[str] = None
    funded_from: Optional[FundedFrom] = None
    personal_portion: Optional[float] = None
    is_tax_deductible: Optional[bool] = None
    gst_applicable: Optional[bool] = None
    gst_amount: Optional[float] = None
    receipt_url: Optional[str] = None
    notes: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_frequency: Optional[RecurrenceFrequency] = None


class BusinessExpenseResponse(BaseModel):
    id: str
    user_id: str
    amount: float
    category: BusinessExpenseCategory
    sub_category: Optional[str]
    vendor_name: str
    subscription_id: Optional[str]
    client_id: Optional[str]
    date: date
    payment_method: Optional[str]
    funded_from: FundedFrom
    personal_portion: Optional[float]
    is_tax_deductible: bool
    gst_applicable: bool
    gst_amount: Optional[float]
    receipt_url: Optional[str]
    notes: Optional[str]
    is_recurring: bool
    recurrence_frequency: Optional[RecurrenceFrequency]
    is_auto_generated: bool
    created_at: str
    updated_at: str
