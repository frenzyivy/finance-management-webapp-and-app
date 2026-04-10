from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from enum import Enum


class DebtType(str, Enum):
    credit_card = "credit_card"
    personal_loan = "personal_loan"
    home_loan = "home_loan"
    car_loan = "car_loan"
    education_loan = "education_loan"
    business_loan = "business_loan"
    other = "other"


class DebtStatus(str, Enum):
    active = "active"
    paid_off = "paid_off"
    defaulted = "defaulted"
    restructured = "restructured"


class DebtCreate(BaseModel):
    name: str
    debt_type: DebtType
    principal_amount: float = Field(gt=0)
    outstanding_amount: float = Field(gt=0)
    interest_rate: float = Field(ge=0)
    emi_amount: Optional[float] = Field(default=None, gt=0)
    start_date: date
    due_date: Optional[date] = None
    lender: Optional[str] = None
    notes: Optional[str] = None


class DebtUpdate(BaseModel):
    name: Optional[str] = None
    debt_type: Optional[DebtType] = None
    principal_amount: Optional[float] = Field(default=None, gt=0)
    outstanding_amount: Optional[float] = Field(default=None, ge=0)
    interest_rate: Optional[float] = Field(default=None, ge=0)
    emi_amount: Optional[float] = Field(default=None, gt=0)
    status: Optional[DebtStatus] = None
    due_date: Optional[date] = None
    lender: Optional[str] = None
    notes: Optional[str] = None


class DebtResponse(BaseModel):
    id: str
    user_id: str
    name: str
    debt_type: DebtType
    principal_amount: float
    outstanding_amount: float
    interest_rate: float
    emi_amount: Optional[float]
    status: DebtStatus
    start_date: date
    due_date: Optional[date]
    lender: Optional[str]
    notes: Optional[str]
    created_at: str
    updated_at: str


class DebtPaymentCreate(BaseModel):
    amount: float = Field(gt=0)
    date: date
    notes: Optional[str] = None


class DebtPaymentResponse(BaseModel):
    id: str
    debt_id: str
    user_id: str
    amount: float
    date: date
    notes: Optional[str]
    created_at: str
