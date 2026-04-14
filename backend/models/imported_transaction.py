from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from enum import Enum


class ImportSource(str, Enum):
    sms = "sms"
    bank_statement_csv = "bank_statement_csv"
    bank_statement_pdf = "bank_statement_pdf"


class TransactionType(str, Enum):
    debit = "debit"
    credit = "credit"


class ImportStatus(str, Enum):
    pending = "pending"
    imported = "imported"
    rejected = "rejected"
    duplicate = "duplicate"


class ImportedTransactionCreate(BaseModel):
    import_source: ImportSource
    raw_text: Optional[str] = None
    import_batch_id: Optional[str] = None
    parsed_amount: float = Field(gt=0)
    parsed_type: TransactionType
    parsed_date: date
    parsed_reference: Optional[str] = None
    parsed_account_hint: Optional[str] = None
    parsed_description: Optional[str] = None
    assigned_category: Optional[str] = None
    assigned_payee_name: Optional[str] = None
    assigned_payment_method: Optional[str] = None
    dedup_hash: Optional[str] = None
    notes: Optional[str] = None


class ImportedTransactionUpdate(BaseModel):
    assigned_category: Optional[str] = None
    assigned_payee_name: Optional[str] = None
    assigned_payment_method: Optional[str] = None
    status: Optional[ImportStatus] = None
    notes: Optional[str] = None


class ImportedTransactionResponse(BaseModel):
    id: str
    user_id: str
    import_source: ImportSource
    raw_text: Optional[str]
    import_batch_id: Optional[str]
    parsed_amount: float
    parsed_type: TransactionType
    parsed_date: date
    parsed_reference: Optional[str]
    parsed_account_hint: Optional[str]
    parsed_description: Optional[str]
    assigned_category: Optional[str]
    assigned_payee_name: Optional[str]
    assigned_payment_method: Optional[str]
    status: ImportStatus
    linked_expense_id: Optional[str]
    linked_income_id: Optional[str]
    dedup_hash: Optional[str]
    notes: Optional[str]
    created_at: str
    updated_at: str


class BulkImportRequest(BaseModel):
    transactions: list[ImportedTransactionCreate]


class ApproveItem(BaseModel):
    id: str
    assigned_category: str
    assigned_payee_name: Optional[str] = None
    assigned_payment_method: Optional[str] = "upi"


class BulkApproveRequest(BaseModel):
    items: list[ApproveItem]


class BulkRejectRequest(BaseModel):
    ids: list[str]


# ── Privacy-first models (local staging, no cloud until approved) ──


class ParsedTransactionItem(BaseModel):
    """A single parsed transaction returned from local PDF/CSV parsing.
    Never stored in Supabase — lives only in the API response / browser."""
    amount: float = Field(gt=0)
    transaction_type: TransactionType
    date: date
    description: Optional[str] = None
    reference: Optional[str] = None
    dedup_hash: Optional[str] = None
    is_duplicate: bool = False


class ParsedStatementResponse(BaseModel):
    """Response from upload-statement: parsed data returned to client, not stored."""
    batch_id: str
    source: ImportSource
    transactions: list[ParsedTransactionItem]
    total_count: int
    duplicate_count: int


class DirectApproveItem(BaseModel):
    """A transaction approved directly from local staging (no DB id needed)."""
    amount: float = Field(gt=0)
    transaction_type: TransactionType
    date: date
    description: Optional[str] = None
    reference: Optional[str] = None
    dedup_hash: Optional[str] = None
    assigned_category: str
    assigned_payee_name: Optional[str] = None
    assigned_payment_method: Optional[str] = "upi"
    import_source: ImportSource = ImportSource.bank_statement_pdf
    import_batch_id: Optional[str] = None


class DirectApproveRequest(BaseModel):
    items: list[DirectApproveItem]
