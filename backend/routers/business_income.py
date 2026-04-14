from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import date

from core.auth import get_current_user
from core.supabase import get_supabase
from core.exceptions import NotFoundError, ForbiddenError
from models.business_income import BusinessIncomeCreate, BusinessIncomeUpdate, BusinessIncomeResponse

router = APIRouter(prefix="/business/income", tags=["Business Income"])


@router.get("", response_model=list[BusinessIncomeResponse])
async def list_business_income(
    start_date: Optional[date] = Query(None, description="Filter from this date"),
    end_date: Optional[date] = Query(None, description="Filter to this date"),
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    query = sb.table("business_income").select("*").eq("user_id", user_id).order("date", desc=True)

    if start_date:
        query = query.gte("date", start_date.isoformat())
    if end_date:
        query = query.lte("date", end_date.isoformat())

    response = query.execute()
    return response.data


@router.get("/{income_id}", response_model=BusinessIncomeResponse)
async def get_business_income(
    income_id: str,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    response = sb.table("business_income").select("*").eq("id", income_id).execute()

    if not response.data:
        raise NotFoundError("Business income entry")

    entry = response.data[0]
    if entry["user_id"] != user_id:
        raise ForbiddenError()

    return entry


@router.post("", response_model=BusinessIncomeResponse, status_code=201)
async def create_business_income(
    income: BusinessIncomeCreate,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    data = income.model_dump(mode="json")
    data["user_id"] = user_id

    response = sb.table("business_income").insert(data).execute()
    return response.data[0]


@router.put("/{income_id}", response_model=BusinessIncomeResponse)
async def update_business_income(
    income_id: str,
    income: BusinessIncomeUpdate,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()

    existing = sb.table("business_income").select("*").eq("id", income_id).execute()
    if not existing.data:
        raise NotFoundError("Business income entry")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    update_data = income.model_dump(mode="json", exclude_none=True)
    if not update_data:
        return existing.data[0]

    response = sb.table("business_income").update(update_data).eq("id", income_id).execute()
    return response.data[0]


@router.delete("/{income_id}", status_code=204)
async def delete_business_income(
    income_id: str,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()

    existing = sb.table("business_income").select("*").eq("id", income_id).execute()
    if not existing.data:
        raise NotFoundError("Business income entry")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    sb.table("business_income").delete().eq("id", income_id).execute()
