from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import date

from core.auth import get_current_user
from core.supabase import get_supabase
from core.exceptions import NotFoundError, ForbiddenError
from models.business_subscription import (
    BusinessSubscriptionCreate,
    BusinessSubscriptionUpdate,
    BusinessSubscriptionResponse,
)
from services.subscription_renewal import process_daily_renewals

router = APIRouter(prefix="/business/subscriptions", tags=["Business Subscriptions"])


@router.post("/process-renewals")
async def process_renewals_manually(
    target_date: Optional[date] = Query(None, description="Process renewals for this date (default: today)"),
    user_id: str = Depends(get_current_user),
):
    """Manually trigger the subscription renewal job. Useful for testing or catching up."""
    summary = process_daily_renewals(target_date=target_date)
    return summary


@router.get("", response_model=list[BusinessSubscriptionResponse])
async def list_subscriptions(
    status: Optional[str] = Query(None, description="Filter by status"),
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    query = sb.table("business_subscriptions").select("*").eq("user_id", user_id).order("next_renewal_date")

    if status:
        query = query.eq("status", status)

    response = query.execute()
    return response.data


@router.get("/{subscription_id}", response_model=BusinessSubscriptionResponse)
async def get_subscription(
    subscription_id: str,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    response = sb.table("business_subscriptions").select("*").eq("id", subscription_id).execute()

    if not response.data:
        raise NotFoundError("Business subscription")

    entry = response.data[0]
    if entry["user_id"] != user_id:
        raise ForbiddenError()

    return entry


@router.post("", response_model=BusinessSubscriptionResponse, status_code=201)
async def create_subscription(
    subscription: BusinessSubscriptionCreate,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    data = subscription.model_dump(mode="json")
    data["user_id"] = user_id

    response = sb.table("business_subscriptions").insert(data).execute()
    return response.data[0]


@router.put("/{subscription_id}", response_model=BusinessSubscriptionResponse)
async def update_subscription(
    subscription_id: str,
    subscription: BusinessSubscriptionUpdate,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()

    existing = sb.table("business_subscriptions").select("*").eq("id", subscription_id).execute()
    if not existing.data:
        raise NotFoundError("Business subscription")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    update_data = subscription.model_dump(mode="json", exclude_none=True)
    if not update_data:
        return existing.data[0]

    response = sb.table("business_subscriptions").update(update_data).eq("id", subscription_id).execute()
    return response.data[0]


@router.delete("/{subscription_id}", status_code=204)
async def delete_subscription(
    subscription_id: str,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()

    existing = sb.table("business_subscriptions").select("*").eq("id", subscription_id).execute()
    if not existing.data:
        raise NotFoundError("Business subscription")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    sb.table("business_subscriptions").delete().eq("id", subscription_id).execute()
