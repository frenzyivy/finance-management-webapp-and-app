"""
Credit card statement router.

Endpoints:
  POST /api/cc/parse-statement      — Parse CC statement PDF, return extracted data
  POST /api/cc/statements           — Save approved statement + transactions
  GET  /api/cc/statements           — List statements for a credit card
  GET  /api/cc/statements/{id}      — Get statement with transactions
  POST /api/cc/statements/{id}/pay  — Record payment against statement
  POST /api/cc/statements/{id}/approve-transactions — Approve transactions as expenses
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field

from core.auth import get_current_user
from core.supabase import get_supabase
from services.cc_statement_parser import parse_cc_statement, parsed_cc_statement_to_dict

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cc", tags=["Credit Cards"])

ALLOWED_MIME_TYPES = {"application/pdf", "image/jpeg", "image/jpg", "image/png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


# ── Parse Statement ──

@router.post("/parse-statement")
async def parse_statement(
    statement_file: UploadFile = File(..., description="Credit card statement PDF"),
    user_id: str = Depends(get_current_user),
):
    """Parse a credit card statement PDF and return extracted data.

    Privacy-first: nothing is stored. The parsed data is returned to the client
    for review. The user then decides what to save.
    """
    if statement_file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{statement_file.content_type}'. Use PDF, JPG, or PNG.",
        )

    file_bytes = await statement_file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 10 MB limit.",
        )

    logger.info("CC parse-statement: user_id=%s size=%d type=%s",
                user_id, len(file_bytes), statement_file.content_type)

    try:
        parsed = parse_cc_statement(file_bytes, statement_file.content_type)
    except ValueError as e:
        logger.warning("CC parse failed (user error): %s", e)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error("CC parse failed (server error): %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse statement. Please try again or enter details manually.",
        )

    return {
        "success": True,
        "data": parsed_cc_statement_to_dict(parsed),
    }


# ── Save Statement ──

class SaveTransactionInput(BaseModel):
    transaction_date: str
    posting_date: Optional[str] = None
    description: str
    reference: Optional[str] = None
    merchant_name: Optional[str] = None
    amount: float
    transaction_type: str = "purchase"
    category: Optional[str] = None


class SaveStatementInput(BaseModel):
    credit_card_id: str
    statement_date: str
    due_date: str
    billing_period_start: Optional[str] = None
    billing_period_end: Optional[str] = None
    total_amount_due: float = 0
    minimum_amount_due: float = 0
    previous_balance: float = 0
    payments_received: float = 0
    new_charges: float = 0
    interest_charged: float = 0
    fees_charged: float = 0
    credit_limit: Optional[float] = None
    available_credit: Optional[float] = None
    transactions: list[SaveTransactionInput] = Field(default_factory=list)
    notes: Optional[str] = None


@router.post("/statements")
async def save_statement(
    body: SaveStatementInput,
    user_id: str = Depends(get_current_user),
):
    """Save a reviewed statement and its transactions."""
    sb = get_supabase()

    # Build transactions JSONB array
    txn_jsonb = [
        {
            "transaction_date": t.transaction_date,
            "posting_date": t.posting_date,
            "description": t.description,
            "reference": t.reference,
            "merchant_name": t.merchant_name,
            "amount": t.amount,
            "transaction_type": t.transaction_type,
            "category": t.category,
        }
        for t in body.transactions
    ]

    try:
        result = sb.rpc("create_cc_statement_with_transactions", {
            "p_user_id": user_id,
            "p_credit_card_id": body.credit_card_id,
            "p_statement_date": body.statement_date,
            "p_due_date": body.due_date,
            "p_billing_period_start": body.billing_period_start,
            "p_billing_period_end": body.billing_period_end,
            "p_total_amount_due": body.total_amount_due,
            "p_minimum_amount_due": body.minimum_amount_due,
            "p_previous_balance": body.previous_balance,
            "p_payments_received": body.payments_received,
            "p_new_charges": body.new_charges,
            "p_interest_charged": body.interest_charged,
            "p_fees_charged": body.fees_charged,
            "p_credit_limit": body.credit_limit,
            "p_available_credit": body.available_credit,
            "p_transactions": txn_jsonb,
            "p_notes": body.notes,
        }).execute()
    except Exception as e:
        logger.error("Failed to save CC statement: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save statement: {e}",
        )

    return {"success": True, "data": result.data}


# ── List Statements ──

@router.get("/statements")
async def list_statements(
    credit_card_id: str = Query(..., description="Credit card ID to fetch statements for"),
    user_id: str = Depends(get_current_user),
):
    """List all statements for a credit card, ordered by statement date descending."""
    sb = get_supabase()

    try:
        result = (
            sb.table("cc_statements")
            .select("*")
            .eq("user_id", user_id)
            .eq("credit_card_id", credit_card_id)
            .order("statement_date", desc=True)
            .execute()
        )
    except Exception as e:
        logger.error("Failed to list CC statements: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    return {"success": True, "data": result.data or []}


# ── Get Statement with Transactions ──

@router.get("/statements/{statement_id}")
async def get_statement(
    statement_id: str,
    user_id: str = Depends(get_current_user),
):
    """Get a single statement with all its transactions."""
    sb = get_supabase()

    try:
        stmt_result = (
            sb.table("cc_statements")
            .select("*")
            .eq("id", statement_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail="Statement not found")

    try:
        txn_result = (
            sb.table("cc_statement_transactions")
            .select("*")
            .eq("statement_id", statement_id)
            .eq("user_id", user_id)
            .order("transaction_date")
            .execute()
        )
    except Exception as e:
        logger.error("Failed to fetch CC transactions: %s", e)
        txn_result = type("R", (), {"data": []})()

    return {
        "success": True,
        "data": {
            **stmt_result.data,
            "transactions": txn_result.data or [],
        },
    }


# ── Pay Statement ──

class PayStatementInput(BaseModel):
    amount: float = Field(..., gt=0)
    paid_date: Optional[str] = None
    payment_method: str = "bank_transfer"
    notes: Optional[str] = None


@router.post("/statements/{statement_id}/pay")
async def pay_statement(
    statement_id: str,
    body: PayStatementInput,
    user_id: str = Depends(get_current_user),
):
    """Record a payment against a credit card statement."""
    sb = get_supabase()

    try:
        result = sb.rpc("pay_cc_statement", {
            "p_statement_id": statement_id,
            "p_user_id": user_id,
            "p_amount": body.amount,
            "p_paid_date": body.paid_date,
            "p_payment_method": body.payment_method,
            "p_notes": body.notes,
        }).execute()
    except Exception as e:
        logger.error("Failed to pay CC statement: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    return {"success": True, "data": result.data}


# ── Approve Transactions as Expenses ──

class ApproveTransactionsInput(BaseModel):
    transaction_ids: list[str]
    categories: dict[str, str] = Field(
        default_factory=dict,
        description="Optional category overrides: {transaction_id: category_name}",
    )


@router.post("/statements/{statement_id}/approve-transactions")
async def approve_transactions(
    statement_id: str,
    body: ApproveTransactionsInput,
    user_id: str = Depends(get_current_user),
):
    """Approve selected transactions from a statement as expense entries."""
    if not body.transaction_ids:
        raise HTTPException(status_code=400, detail="No transaction IDs provided")

    sb = get_supabase()

    try:
        result = sb.rpc("approve_cc_transactions_as_expenses", {
            "p_user_id": user_id,
            "p_transaction_ids": body.transaction_ids,
            "p_categories": body.categories,
        }).execute()
    except Exception as e:
        logger.error("Failed to approve CC transactions: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    return {"success": True, "data": result.data}
