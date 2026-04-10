from fastapi import APIRouter, Depends

from core.auth import get_current_user
from core.supabase import get_supabase
from core.exceptions import NotFoundError, ForbiddenError
from models.debt import (
    DebtCreate,
    DebtUpdate,
    DebtResponse,
    DebtPaymentCreate,
    DebtPaymentResponse,
)

router = APIRouter(prefix="/debts", tags=["Debts"])


@router.get("", response_model=list[DebtResponse])
async def list_debts(
    user_id: str = Depends(get_current_user),
):
    """List all debts for the current user."""
    sb = get_supabase()
    response = (
        sb.table("debts")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


@router.post("", response_model=DebtResponse, status_code=201)
async def create_debt(
    debt: DebtCreate,
    user_id: str = Depends(get_current_user),
):
    """Create a new debt entry."""
    sb = get_supabase()
    data = debt.model_dump(mode="json")
    data["user_id"] = user_id
    data["status"] = "active"

    response = sb.table("debts").insert(data).execute()
    return response.data[0]


@router.put("/{debt_id}", response_model=DebtResponse)
async def update_debt(
    debt_id: str,
    debt: DebtUpdate,
    user_id: str = Depends(get_current_user),
):
    """Update an existing debt entry."""
    sb = get_supabase()

    # Verify ownership
    existing = sb.table("debts").select("*").eq("id", debt_id).execute()
    if not existing.data:
        raise NotFoundError("Debt")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    update_data = debt.model_dump(mode="json", exclude_none=True)
    if not update_data:
        return existing.data[0]

    response = sb.table("debts").update(update_data).eq("id", debt_id).execute()
    return response.data[0]


@router.delete("/{debt_id}", status_code=204)
async def delete_debt(
    debt_id: str,
    user_id: str = Depends(get_current_user),
):
    """Delete a debt and its payment records."""
    sb = get_supabase()

    # Verify ownership
    existing = sb.table("debts").select("*").eq("id", debt_id).execute()
    if not existing.data:
        raise NotFoundError("Debt")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    # Delete payments first, then the debt
    sb.table("debt_payments").delete().eq("debt_id", debt_id).execute()
    sb.table("debts").delete().eq("id", debt_id).execute()


@router.post("/{debt_id}/payments", response_model=DebtPaymentResponse, status_code=201)
async def add_payment(
    debt_id: str,
    payment: DebtPaymentCreate,
    user_id: str = Depends(get_current_user),
):
    """Record a payment against a debt."""
    sb = get_supabase()

    # Verify debt ownership
    existing = sb.table("debts").select("*").eq("id", debt_id).execute()
    if not existing.data:
        raise NotFoundError("Debt")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    # Insert payment
    data = payment.model_dump(mode="json")
    data["debt_id"] = debt_id
    data["user_id"] = user_id

    response = sb.table("debt_payments").insert(data).execute()

    # Update outstanding amount
    new_outstanding = existing.data[0]["outstanding_amount"] - payment.amount
    update_fields = {"outstanding_amount": max(new_outstanding, 0)}

    # Mark as paid off if outstanding is zero or below
    if new_outstanding <= 0:
        update_fields["status"] = "paid_off"

    sb.table("debts").update(update_fields).eq("id", debt_id).execute()

    return response.data[0]


@router.get("/{debt_id}/payments", response_model=list[DebtPaymentResponse])
async def list_payments(
    debt_id: str,
    user_id: str = Depends(get_current_user),
):
    """List all payments for a debt."""
    sb = get_supabase()

    # Verify debt ownership
    existing = sb.table("debts").select("*").eq("id", debt_id).execute()
    if not existing.data:
        raise NotFoundError("Debt")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    response = (
        sb.table("debt_payments")
        .select("*")
        .eq("debt_id", debt_id)
        .order("date", desc=True)
        .execute()
    )
    return response.data
