from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import date

from core.auth import get_current_user
from core.supabase import get_supabase
from core.exceptions import NotFoundError, ForbiddenError
from models.business_expense import BusinessExpenseCreate, BusinessExpenseUpdate, BusinessExpenseResponse

router = APIRouter(prefix="/business/expenses", tags=["Business Expenses"])


@router.get("", response_model=list[BusinessExpenseResponse])
async def list_business_expenses(
    start_date: Optional[date] = Query(None, description="Filter from this date"),
    end_date: Optional[date] = Query(None, description="Filter to this date"),
    category: Optional[str] = Query(None, description="Filter by category"),
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    query = sb.table("business_expenses").select("*").eq("user_id", user_id).order("date", desc=True)

    if start_date:
        query = query.gte("date", start_date.isoformat())
    if end_date:
        query = query.lte("date", end_date.isoformat())
    if category:
        query = query.eq("category", category)

    response = query.execute()
    return response.data


@router.get("/{expense_id}", response_model=BusinessExpenseResponse)
async def get_business_expense(
    expense_id: str,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    response = sb.table("business_expenses").select("*").eq("id", expense_id).execute()

    if not response.data:
        raise NotFoundError("Business expense entry")

    entry = response.data[0]
    if entry["user_id"] != user_id:
        raise ForbiddenError()

    return entry


@router.post("", response_model=BusinessExpenseResponse, status_code=201)
async def create_business_expense(
    expense: BusinessExpenseCreate,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    data = expense.model_dump(mode="json")
    data["user_id"] = user_id

    response = sb.table("business_expenses").insert(data).execute()
    return response.data[0]


@router.put("/{expense_id}", response_model=BusinessExpenseResponse)
async def update_business_expense(
    expense_id: str,
    expense: BusinessExpenseUpdate,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()

    existing = sb.table("business_expenses").select("*").eq("id", expense_id).execute()
    if not existing.data:
        raise NotFoundError("Business expense entry")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    update_data = expense.model_dump(mode="json", exclude_none=True)
    if not update_data:
        return existing.data[0]

    response = sb.table("business_expenses").update(update_data).eq("id", expense_id).execute()
    return response.data[0]


@router.delete("/{expense_id}", status_code=204)
async def delete_business_expense(
    expense_id: str,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()

    existing = sb.table("business_expenses").select("*").eq("id", expense_id).execute()
    if not existing.data:
        raise NotFoundError("Business expense entry")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    sb.table("business_expenses").delete().eq("id", expense_id).execute()
