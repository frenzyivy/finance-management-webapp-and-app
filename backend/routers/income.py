from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import date

from core.auth import get_current_user
from core.supabase import get_supabase
from core.exceptions import NotFoundError, ForbiddenError
from models.income import IncomeCreate, IncomeUpdate, IncomeResponse

router = APIRouter(prefix="/income", tags=["Income"])


@router.get("", response_model=list[IncomeResponse])
async def list_income(
    start_date: Optional[date] = Query(None, description="Filter from this date"),
    end_date: Optional[date] = Query(None, description="Filter to this date"),
    user_id: str = Depends(get_current_user),
):
    """List all income entries for the current user, with optional date range filter."""
    sb = get_supabase()
    query = sb.table("income").select("*").eq("user_id", user_id).order("date", desc=True)

    if start_date:
        query = query.gte("date", start_date.isoformat())
    if end_date:
        query = query.lte("date", end_date.isoformat())

    response = query.execute()
    return response.data


@router.get("/{income_id}", response_model=IncomeResponse)
async def get_income(
    income_id: str,
    user_id: str = Depends(get_current_user),
):
    """Get a single income entry by ID."""
    sb = get_supabase()
    response = sb.table("income").select("*").eq("id", income_id).execute()

    if not response.data:
        raise NotFoundError("Income entry")

    entry = response.data[0]
    if entry["user_id"] != user_id:
        raise ForbiddenError()

    return entry


@router.post("", response_model=IncomeResponse, status_code=201)
async def create_income(
    income: IncomeCreate,
    user_id: str = Depends(get_current_user),
):
    """Create a new income entry."""
    sb = get_supabase()
    data = income.model_dump(mode="json")
    data["user_id"] = user_id

    response = sb.table("income").insert(data).execute()
    return response.data[0]


@router.put("/{income_id}", response_model=IncomeResponse)
async def update_income(
    income_id: str,
    income: IncomeUpdate,
    user_id: str = Depends(get_current_user),
):
    """Update an existing income entry."""
    sb = get_supabase()

    # Verify ownership
    existing = sb.table("income").select("*").eq("id", income_id).execute()
    if not existing.data:
        raise NotFoundError("Income entry")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    update_data = income.model_dump(mode="json", exclude_none=True)
    if not update_data:
        return existing.data[0]

    response = sb.table("income").update(update_data).eq("id", income_id).execute()
    return response.data[0]


@router.delete("/{income_id}", status_code=204)
async def delete_income(
    income_id: str,
    user_id: str = Depends(get_current_user),
):
    """Delete an income entry."""
    sb = get_supabase()

    # Verify ownership
    existing = sb.table("income").select("*").eq("id", income_id).execute()
    if not existing.data:
        raise NotFoundError("Income entry")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    sb.table("income").delete().eq("id", income_id).execute()
