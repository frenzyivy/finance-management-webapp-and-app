from fastapi import APIRouter, Depends
from core.auth import get_current_user
from core.supabase import get_supabase

router = APIRouter(prefix="/recurring", tags=["Recurring"])


@router.post("/generate")
async def generate_recurring_entries(
    user_id: str = Depends(get_current_user),
):
    """
    Trigger recurring entry generation for the current user.
    Calls the Supabase RPC which idempotently creates entries
    for all missed periods up to today.
    """
    sb = get_supabase()
    response = sb.rpc("generate_recurring_entries").execute()
    return response.data


@router.get("/templates")
async def list_recurring_templates(
    user_id: str = Depends(get_current_user),
):
    """List all recurring entry templates (originals) for the current user."""
    sb = get_supabase()

    income = (
        sb.table("income_entries")
        .select("id, amount, category, source_name, date, payment_method, recurrence_frequency, last_recurrence_date")
        .eq("user_id", user_id)
        .eq("is_recurring", True)
        .eq("is_auto_generated", False)
        .order("date", desc=True)
        .execute()
    )

    expenses = (
        sb.table("expense_entries")
        .select("id, amount, category, payee_name, date, payment_method, recurrence_frequency, last_recurrence_date")
        .eq("user_id", user_id)
        .eq("is_recurring", True)
        .eq("is_auto_generated", False)
        .order("date", desc=True)
        .execute()
    )

    return {
        "income_templates": income.data,
        "expense_templates": expenses.data,
    }
