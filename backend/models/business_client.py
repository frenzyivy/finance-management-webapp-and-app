from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from enum import Enum


class ClientStatus(str, Enum):
    active = "active"
    prospect = "prospect"
    churned = "churned"
    paused = "paused"


class EngagementType(str, Enum):
    project = "project"
    retainer = "retainer"
    hourly = "hourly"
    pilot = "pilot"
    one_off = "one_off"


class BusinessClientCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    country: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    engagement_type: Optional[EngagementType] = None
    monthly_value: Optional[float] = None
    start_date: Optional[date] = None
    status: ClientStatus = ClientStatus.active
    notes: Optional[str] = None


class BusinessClientUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    engagement_type: Optional[EngagementType] = None
    monthly_value: Optional[float] = None
    start_date: Optional[date] = None
    status: Optional[ClientStatus] = None
    notes: Optional[str] = None


class BusinessClientResponse(BaseModel):
    id: str
    user_id: str
    name: str
    industry: Optional[str]
    country: Optional[str]
    contact_name: Optional[str]
    contact_email: Optional[str]
    contact_phone: Optional[str]
    engagement_type: Optional[EngagementType]
    monthly_value: Optional[float]
    start_date: Optional[date]
    status: ClientStatus
    notes: Optional[str]
    created_at: str
    updated_at: str
