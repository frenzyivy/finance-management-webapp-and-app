import uuid
from fastapi import APIRouter, Depends, File, Query, UploadFile
from typing import Optional
from datetime import date

from core.auth import get_current_user
from core.supabase import get_supabase
from core.exceptions import NotFoundError, ForbiddenError
from models.imported_transaction import (
    BulkApproveRequest,
    BulkImportRequest,
    BulkRejectRequest,
    DirectApproveRequest,
    ImportedTransactionResponse,
    ImportedTransactionUpdate,
    ParsedStatementResponse,
    ParsedTransactionItem,
)
from services.statement_parser import parse_csv, parse_pdf, generate_dedup_hash

router = APIRouter(prefix="/imports", tags=["Imports"])


@router.get("", response_model=list[ImportedTransactionResponse])
async def list_imported_transactions(
    status: Optional[str] = Query(None, description="Filter by status (pending, imported, rejected, duplicate)"),
    source: Optional[str] = Query(None, description="Filter by import source"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    user_id: str = Depends(get_current_user),
):
    """List imported transactions for the current user."""
    sb = get_supabase()
    query = sb.table("imported_transactions").select("*").eq("user_id", user_id).order("parsed_date", desc=True)

    if status:
        query = query.eq("status", status)
    if source:
        query = query.eq("import_source", source)
    if start_date:
        query = query.gte("parsed_date", start_date.isoformat())
    if end_date:
        query = query.lte("parsed_date", end_date.isoformat())

    response = query.execute()
    return response.data


@router.get("/pending-count")
async def get_pending_count(user_id: str = Depends(get_current_user)):
    """Get count of pending imported transactions."""
    sb = get_supabase()
    response = sb.table("imported_transactions").select("id", count="exact").eq("user_id", user_id).eq("status", "pending").execute()
    return {"count": response.count or 0}


@router.get("/{txn_id}", response_model=ImportedTransactionResponse)
async def get_imported_transaction(
    txn_id: str,
    user_id: str = Depends(get_current_user),
):
    """Get a single imported transaction."""
    sb = get_supabase()
    response = sb.table("imported_transactions").select("*").eq("id", txn_id).execute()

    if not response.data:
        raise NotFoundError("Imported transaction")

    entry = response.data[0]
    if entry["user_id"] != user_id:
        raise ForbiddenError()

    return entry


@router.post("/bulk", response_model=list[ImportedTransactionResponse], status_code=201)
async def bulk_import(
    request: BulkImportRequest,
    user_id: str = Depends(get_current_user),
):
    """Bulk insert parsed transactions (from SMS scan or client-side parsing)."""
    sb = get_supabase()

    # Check for existing dedup hashes
    hashes = [t.dedup_hash for t in request.transactions if t.dedup_hash]
    existing_hashes = set()
    if hashes:
        existing = sb.table("imported_transactions").select("dedup_hash").eq("user_id", user_id).in_("dedup_hash", hashes).execute()
        existing_hashes = {row["dedup_hash"] for row in existing.data}

    rows = []
    for txn in request.transactions:
        data = txn.model_dump(mode="json")
        data["user_id"] = user_id
        if txn.dedup_hash and txn.dedup_hash in existing_hashes:
            data["status"] = "duplicate"
        rows.append(data)

    if not rows:
        return []

    response = sb.table("imported_transactions").insert(rows).execute()
    return response.data


@router.put("/{txn_id}", response_model=ImportedTransactionResponse)
async def update_imported_transaction(
    txn_id: str,
    update: ImportedTransactionUpdate,
    user_id: str = Depends(get_current_user),
):
    """Update an imported transaction (assign category, edit fields)."""
    sb = get_supabase()

    existing = sb.table("imported_transactions").select("*").eq("id", txn_id).execute()
    if not existing.data:
        raise NotFoundError("Imported transaction")
    if existing.data[0]["user_id"] != user_id:
        raise ForbiddenError()

    update_data = update.model_dump(mode="json", exclude_none=True)
    if not update_data:
        return existing.data[0]

    response = sb.table("imported_transactions").update(update_data).eq("id", txn_id).execute()
    return response.data[0]


@router.post("/approve")
async def bulk_approve(
    request: BulkApproveRequest,
    user_id: str = Depends(get_current_user),
):
    """Approve imported transactions: create expense/income entries and update status."""
    sb = get_supabase()
    approved = []

    for item in request.items:
        # Fetch the imported transaction
        txn_resp = sb.table("imported_transactions").select("*").eq("id", item.id).execute()
        if not txn_resp.data:
            continue
        txn = txn_resp.data[0]
        if txn["user_id"] != user_id or txn["status"] != "pending":
            continue

        payee = item.assigned_payee_name or txn["parsed_description"] or "Unknown"
        payment_method = item.assigned_payment_method or "upi"

        if txn["parsed_type"] == "debit":
            # Create expense entry
            expense_data = {
                "user_id": user_id,
                "amount": txn["parsed_amount"],
                "category": item.assigned_category,
                "payee_name": payee,
                "date": txn["parsed_date"],
                "payment_method": payment_method,
                "is_emi": False,
                "is_recurring": False,
                "notes": f"Imported from {txn['import_source']}",
            }
            entry_resp = sb.table("expense_entries").insert(expense_data).execute()
            if entry_resp.data:
                sb.table("imported_transactions").update({
                    "status": "imported",
                    "linked_expense_id": entry_resp.data[0]["id"],
                    "assigned_category": item.assigned_category,
                    "assigned_payee_name": payee,
                    "assigned_payment_method": payment_method,
                }).eq("id", item.id).execute()
                approved.append(item.id)

        elif txn["parsed_type"] == "credit":
            # Create income entry
            income_data = {
                "user_id": user_id,
                "amount": txn["parsed_amount"],
                "category": item.assigned_category,
                "source_name": payee,
                "date": txn["parsed_date"],
                "payment_method": payment_method,
                "is_recurring": False,
                "notes": f"Imported from {txn['import_source']}",
            }
            entry_resp = sb.table("income_entries").insert(income_data).execute()
            if entry_resp.data:
                sb.table("imported_transactions").update({
                    "status": "imported",
                    "linked_income_id": entry_resp.data[0]["id"],
                    "assigned_category": item.assigned_category,
                    "assigned_payee_name": payee,
                    "assigned_payment_method": payment_method,
                }).eq("id", item.id).execute()
                approved.append(item.id)

    return {"approved": approved, "count": len(approved)}


@router.post("/reject")
async def bulk_reject(
    request: BulkRejectRequest,
    user_id: str = Depends(get_current_user),
):
    """Reject imported transactions."""
    sb = get_supabase()
    rejected = []

    for txn_id in request.ids:
        existing = sb.table("imported_transactions").select("user_id", "status").eq("id", txn_id).execute()
        if not existing.data:
            continue
        if existing.data[0]["user_id"] != user_id:
            continue
        if existing.data[0]["status"] != "pending":
            continue

        sb.table("imported_transactions").update({"status": "rejected"}).eq("id", txn_id).execute()
        rejected.append(txn_id)

    return {"rejected": rejected, "count": len(rejected)}


@router.post("/approve-direct")
async def approve_direct(
    request: DirectApproveRequest,
    user_id: str = Depends(get_current_user),
):
    """Approve transactions directly from local staging (privacy-first flow).

    Accepts full transaction data from the browser's local staging queue.
    Creates expense/income entries and writes an audit trail to imported_transactions.
    Only approved data touches Supabase — rejected items never leave the browser.
    """
    sb = get_supabase()
    approved = []

    for item in request.items:
        payee = item.assigned_payee_name or item.description or "Unknown"
        payment_method = item.assigned_payment_method or "upi"
        batch_id = item.import_batch_id or str(uuid.uuid4())

        if item.transaction_type == "debit":
            entry_data = {
                "user_id": user_id,
                "amount": item.amount,
                "category": item.assigned_category,
                "payee_name": payee,
                "date": item.date.isoformat(),
                "payment_method": payment_method,
                "is_emi": False,
                "is_recurring": False,
                "notes": f"Imported from {item.import_source}",
            }
            entry_resp = sb.table("expense_entries").insert(entry_data).execute()
            linked_field = "linked_expense_id"
        else:
            entry_data = {
                "user_id": user_id,
                "amount": item.amount,
                "category": item.assigned_category,
                "source_name": payee,
                "date": item.date.isoformat(),
                "payment_method": payment_method,
                "is_recurring": False,
                "notes": f"Imported from {item.import_source}",
            }
            entry_resp = sb.table("income_entries").insert(entry_data).execute()
            linked_field = "linked_income_id"

        if entry_resp.data:
            # Write audit trail (only approved items touch cloud)
            audit_row = {
                "user_id": user_id,
                "import_source": item.import_source,
                "raw_text": item.description,
                "import_batch_id": batch_id,
                "parsed_amount": item.amount,
                "parsed_type": item.transaction_type,
                "parsed_date": item.date.isoformat(),
                "parsed_reference": item.reference,
                "parsed_description": item.description,
                "assigned_category": item.assigned_category,
                "assigned_payee_name": payee,
                "assigned_payment_method": payment_method,
                "dedup_hash": item.dedup_hash,
                "status": "imported",
                linked_field: entry_resp.data[0]["id"],
            }
            sb.table("imported_transactions").insert(audit_row).execute()
            approved.append(entry_resp.data[0]["id"])

    return {"approved": approved, "count": len(approved)}


@router.post("/upload-statement", response_model=ParsedStatementResponse)
async def upload_statement(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    """Upload a bank statement (PDF/CSV), parse locally, and return results.

    Privacy: The PDF is parsed on this local server only. Parsed transactions
    are returned in the response and NOT stored in any cloud database.
    They remain in the browser until the user explicitly approves them.
    """
    from fastapi import HTTPException

    # Validate file type
    filename = file.filename or ""
    content_type = file.content_type or ""
    is_csv = filename.lower().endswith(".csv") or "csv" in content_type
    is_pdf = filename.lower().endswith(".pdf") or "pdf" in content_type

    if not is_csv and not is_pdf:
        raise HTTPException(status_code=400, detail="Only CSV and PDF files are supported")

    # Read file content
    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    # Parse locally (pdfplumber / csv — no network calls)
    import logging
    logger = logging.getLogger("imports.upload")

    if is_csv:
        logger.info("Parsing CSV file: %s (%d bytes)", filename, len(file_content))
        parsed = parse_csv(file_content)
        source = "bank_statement_csv"
    else:
        logger.info("Parsing PDF file: %s (%d bytes)", filename, len(file_content))
        parsed = parse_pdf(file_content)
        source = "bank_statement_pdf"

    if not parsed:
        file_type = "CSV" if is_csv else "PDF"
        raise HTTPException(
            status_code=422,
            detail=(
                f"Could not extract any transactions from this {file_type} file. "
                f"This usually means the statement format was not recognized. "
                f"Supported formats: SBI, HDFC, ICICI, Axis, Kotak, BOB, PNB, and most Indian bank statements "
                f"with standard column headers (Date, Description, Debit/Credit/Amount). "
                f"If your file uses a different format, please try exporting as CSV from your bank's website."
            ),
        )

    batch_id = str(uuid.uuid4())

    # Check for existing dedup hashes (read-only query — no data is written)
    sb = get_supabase()
    hashes = [t.dedup_hash for t in parsed if t.dedup_hash]
    existing_hashes: set[str] = set()
    if hashes:
        existing = sb.table("imported_transactions").select("dedup_hash").eq("user_id", user_id).in_("dedup_hash", hashes).execute()
        existing_hashes = {row["dedup_hash"] for row in existing.data}

    # Also check expense/income entries dedup via the approved imported_transactions
    # (covers transactions approved in previous sessions)

    # Build response — data stays in the HTTP response, never stored in cloud
    items: list[ParsedTransactionItem] = []
    dup_count = 0
    for txn in parsed:
        is_dup = txn.dedup_hash in existing_hashes if txn.dedup_hash else False
        if is_dup:
            dup_count += 1
        items.append(ParsedTransactionItem(
            amount=txn.amount,
            transaction_type=txn.transaction_type,
            date=txn.date,
            description=txn.description,
            reference=txn.reference,
            dedup_hash=txn.dedup_hash,
            is_duplicate=is_dup,
        ))

    return ParsedStatementResponse(
        batch_id=batch_id,
        source=source,
        transactions=items,
        total_count=len(items),
        duplicate_count=dup_count,
    )
