from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import date

from core.auth import get_current_user
from core.supabase import get_supabase
from core.exceptions import NotFoundError, ForbiddenError
from models.expense import ExpenseCreate, ExpenseUpdate, ExpenseResponse

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.get("", response_model=list[ExpenseResponse])
async def list_expenses(
    start_date: Optional[date] = Query(None, description="Filter from this date"),
    end_date: Optional[date] = Query(None, description="Filter to this date"),
    category: Optional[str] = Query(None, description="Filter by category"),
    user_id: str = Depends(get_current_user),
):
    """List all expense entries for the current user, with optional filters."""
    sb = get_supabase()
    query = sb.table("expenses").select("*").eq("user_id", user_id).order("date", desc=True)

    if start_date:
        query = query.gte("date", start_date.isoformat())
    if end_date:
        query = query.lte("date", end_date.isoformat())
    if category:
        query = query.eq("category", category)

    response = query.execute()
    return response.data


@router.get("/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: str,
    user_id: str = Depends(get_current_user),
):
    """Get a single expense entry by ID."""
    sb = get_supabase()
    response = sb.table("expenses").select("*").eq("id", expense_id).execute()

    if not response.data:
        raise NotFoundError("Expense entry")

    entry = response.data[0]
    if entry["user_id"] != user_id:
        raise ForbiddenError()

    return entry


@router.post("", response_model=ExpenseResponse, status_code=201)
async def create_expense(
    expense: ExpenseCreate,
    user_id: str = Depends(get_current_user),
):
    """Create a new expense entry."""
    sb = get_supabase()
    data = expense.model_dump(mode="json")
    data["user_id"] = user_id

    response = sb.table("expenses").insert(data).execute()
    return response.data[0]


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: str,
    expense: ExpenseUpdate,
    user_id: str = Depends(get_current_user),
):
    """Update an existing expense entry."""
    sb = get_supabase()

    # Verify ownership
    existing = sb.table("expenses").select("*").eq("id", expense_id).execute()
    if not existing.data:
        raise NotFoundError("Expense entry")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    update_data = expense.model_dump(mode="json", exclude_none=True)
    if not update_data:
        return existing.data[0]

    response = sb.table("expenses").update(update_data).eq("id", expense_id).execute()
    return response.data[0]


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: str,
    user_id: str = Depends(get_current_user),
):
    """Delete an expense entry."""
    sb = get_supabase()

    # Verify ownership
    existing = sb.table("expenses").select("*").eq("id", expense_id).execute()
    if not existing.data:
        raise NotFoundError("Expense entry")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    sb.table("expenses").delete().eq("id", expense_id).execute()
