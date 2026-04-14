"""
Credit card statement parser using Claude Vision API.
Extracts statement summary + individual transactions from HDFC credit card PDFs.

Hybrid approach:
1. Try pdfplumber table extraction first (fast, free, private)
2. Fall back to Claude Vision for complex layouts
"""

import base64
import io
import json
import logging
import re
from dataclasses import dataclass, field, asdict
from datetime import date
from typing import Any, Optional

from anthropic import Anthropic

from core.config import get_settings
from services.statement_parser import parse_date, parse_amount

logger = logging.getLogger(__name__)

MODEL = "claude-haiku-4-5-20251001"


@dataclass
class ParsedCCTransaction:
    transaction_date: Optional[str] = None   # YYYY-MM-DD
    posting_date: Optional[str] = None       # YYYY-MM-DD
    description: Optional[str] = None
    reference: Optional[str] = None
    merchant_name: Optional[str] = None
    amount: Optional[float] = None
    transaction_type: Optional[str] = None   # purchase|refund|fee|interest|payment|cashback|emi_charge
    category: Optional[str] = None           # auto-inferred expense category


@dataclass
class ParsedCCStatement:
    # Statement summary
    card_last_four: Optional[str] = None
    statement_date: Optional[str] = None     # YYYY-MM-DD
    due_date: Optional[str] = None           # YYYY-MM-DD
    billing_period_start: Optional[str] = None
    billing_period_end: Optional[str] = None
    total_amount_due: Optional[float] = None
    minimum_amount_due: Optional[float] = None
    previous_balance: Optional[float] = None
    payments_received: Optional[float] = None
    new_charges: Optional[float] = None
    interest_charged: Optional[float] = None
    fees_charged: Optional[float] = None
    credit_limit: Optional[float] = None
    available_credit: Optional[float] = None
    # Transactions
    transactions: list[ParsedCCTransaction] = field(default_factory=list)
    # Metadata
    confidence: dict[str, str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    raw_response: Optional[str] = None


CC_STATEMENT_EXTRACTION_PROMPT = """You are an expert at extracting structured data from HDFC Bank credit card statements (India).

You will be shown a credit card statement PDF (as images). Extract ALL data and return ONLY a JSON object (no markdown, no explanation).

{
  "card_last_four": "Last 4 digits of card number (e.g., '4321').",
  "statement_date": "Statement generation date in YYYY-MM-DD format.",
  "due_date": "Payment due date in YYYY-MM-DD format.",
  "billing_period_start": "Billing period start date in YYYY-MM-DD.",
  "billing_period_end": "Billing period end date in YYYY-MM-DD.",
  "total_amount_due": "Total Amount Due / Total Outstanding (number, no currency symbol).",
  "minimum_amount_due": "Minimum Amount Due (number).",
  "previous_balance": "Previous statement balance / Opening Balance.",
  "payments_received": "Total payments/credits received during this period.",
  "new_charges": "Total new purchases/charges during this period.",
  "interest_charged": "Finance Charges / Interest charged this period. 0 if paid in full.",
  "fees_charged": "Sum of all fees: Late Payment Fee, Annual Fee, GST on fees, etc. 0 if none.",
  "credit_limit": "Total Credit Limit on the card.",
  "available_credit": "Available Credit Limit.",

  "transactions": [
    {
      "transaction_date": "Transaction date in YYYY-MM-DD.",
      "posting_date": "Posting/booking date in YYYY-MM-DD if different from transaction date.",
      "description": "Full transaction description as shown on statement.",
      "reference": "Reference number / Auth Code if shown.",
      "merchant_name": "Clean merchant name extracted from description (e.g., 'AMAZON' from 'AMAZON.IN/AMZN MKTP IN').",
      "amount": "Transaction amount (positive for charges/debits, negative for credits/refunds).",
      "transaction_type": "One of: purchase, refund, fee, interest, payment, cashback, emi_charge.",
      "category": "Infer expense category: food_groceries, shopping, transport, entertainment, subscriptions, utilities, health, education, rent, miscellaneous."
    }
  ],

  "confidence": {
    "<field_name>": "high | low | missing"
  },
  "warnings": ["List any issues or fields the user should verify."]
}

## HDFC Credit Card Statement Patterns

1. **Statement Summary Section**: Usually appears first with:
   - "Statement of Card Account" or "Card Statement"
   - Total Amount Due, Minimum Amount Due
   - Statement Date, Payment Due Date
   - Credit Limit, Available Credit
   - Previous Balance, Payments, New Charges

2. **Transaction Sections**:
   - "Domestic Transactions" — INR purchases
   - "International Transactions" — foreign currency (convert to INR amount shown)
   - "Cash Advances" — treat as purchase type
   - "EMI Transactions" / "EMI Details" — treat as emi_charge type

3. **Fee Lines** (treat as transaction_type = "fee"):
   - "Late Payment Charges", "Annual Fee", "Membership Fee"
   - "Goods and Services Tax" / "GST" on fees
   - "Overlimit Fee", "Cash Advance Fee"
   - "Fuel Surcharge", "Railway Surcharge"

4. **Interest Lines** (treat as transaction_type = "interest"):
   - "Finance Charges", "Interest", "Retail Finance Charges"
   - "Cash Advance Interest"

5. **Payment Lines** (treat as transaction_type = "payment"):
   - "Payment Received - Thank You"
   - "Online Payment", "NEFT Payment", "Auto Debit"
   - Amount should be negative (credit to card)

6. **Refund Lines** (treat as transaction_type = "refund"):
   - "Refund", "Reversal", "Cashback", "Credit Adjustment"
   - Amount should be negative (credit to card)

## Category Inference Rules
- Amazon, Flipkart, Myntra, Ajio → shopping
- Swiggy, Zomato, restaurant names → food_groceries
- BigBasket, Blinkit, DMart, grocery → food_groceries
- Uber, Ola, Metro, Petrol, fuel → transport
- Netflix, Hotstar, Spotify, Prime Video → entertainment/subscriptions
- Hospital, Pharmacy, medical → health
- Electricity, Water, Gas bill, mobile recharge → utilities
- Rent, maintenance, society → rent

## Important Rules
- Extract EVERY transaction, including fees, interest, and payments.
- Amounts for purchases/fees/interest should be POSITIVE (debit to card).
- Amounts for payments/refunds/cashback should be NEGATIVE (credit to card).
- Dates: convert "02 Apr 2026" → "2026-04-02".
- Remove ₹, Rs, commas from amounts.
- For merchant_name: clean up the raw description to a human-readable name.
- If a transaction description contains "EMI" or "InstaCred" or "SmartEMI", set type to "emi_charge".
- Don't skip any line — even small charges like ₹1.18 GST matter.

Return ONLY the JSON. No markdown fences, no prose."""


def _pdf_to_images(pdf_bytes: bytes) -> list[bytes]:
    """Convert each PDF page to a PNG image."""
    try:
        import pdfplumber
        from PIL import Image
    except ImportError as e:
        logger.error("PDF conversion requires pdfplumber + pillow: %s", e)
        raise

    images: list[bytes] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        # CC statements can be 3-6 pages
        for page in pdf.pages[:8]:
            img = page.to_image(resolution=150).original
            buf = io.BytesIO()
            img.save(buf, format="PNG", optimize=True)
            images.append(buf.getvalue())
    return images


def _try_pdfplumber_extraction(pdf_bytes: bytes) -> Optional[ParsedCCStatement]:
    """Attempt to extract CC statement data using pdfplumber table extraction.

    Returns None if extraction fails or is unreliable (falls back to Claude Vision).
    """
    try:
        import pdfplumber
    except ImportError:
        return None

    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            full_text = ""
            all_tables = []

            for page in pdf.pages[:8]:
                text = page.extract_text() or ""
                full_text += text + "\n"
                tables = page.extract_tables() or []
                all_tables.extend(tables)

            if not full_text.strip():
                return None

            # Check if this looks like an HDFC CC statement
            if not re.search(r"HDFC|Statement of Card|Card Statement", full_text, re.I):
                logger.info("CC pdfplumber: does not look like HDFC CC statement, skipping local parse")
                return None

            statement = ParsedCCStatement()

            # Extract summary fields from text using regex
            _extract_summary_from_text(full_text, statement)

            # Extract transactions from tables
            transactions = _extract_transactions_from_tables(all_tables, full_text)

            if not transactions:
                logger.info("CC pdfplumber: no transactions extracted from tables")
                return None

            statement.transactions = transactions
            statement.warnings.append("Parsed locally via pdfplumber — verify totals match statement summary")

            logger.info("CC pdfplumber: extracted %d transactions", len(transactions))
            return statement

    except Exception as e:
        logger.warning("CC pdfplumber extraction failed: %s", e)
        return None


def _extract_summary_from_text(text: str, statement: ParsedCCStatement) -> None:
    """Extract statement summary fields from raw text using regex patterns."""

    # Total Amount Due
    m = re.search(r"Total\s+Amount\s+Due[:\s]*(?:Rs\.?\s*|₹\s*)?([\d,]+\.?\d*)", text, re.I)
    if m:
        statement.total_amount_due = parse_amount(m.group(1))
        statement.confidence["total_amount_due"] = "high"

    # Minimum Amount Due
    m = re.search(r"Minimum\s+Amount\s+Due[:\s]*(?:Rs\.?\s*|₹\s*)?([\d,]+\.?\d*)", text, re.I)
    if m:
        statement.minimum_amount_due = parse_amount(m.group(1))
        statement.confidence["minimum_amount_due"] = "high"

    # Statement Date
    m = re.search(r"Statement\s+Date[:\s]*([\d/\-]+\s*[\w]*\s*\d*)", text, re.I)
    if m:
        d = parse_date(m.group(1).strip())
        if d:
            statement.statement_date = d.isoformat()
            statement.confidence["statement_date"] = "high"

    # Due Date / Payment Due Date
    m = re.search(r"(?:Payment\s+)?Due\s+Date[:\s]*([\d/\-]+\s*[\w]*\s*\d*)", text, re.I)
    if m:
        d = parse_date(m.group(1).strip())
        if d:
            statement.due_date = d.isoformat()
            statement.confidence["due_date"] = "high"

    # Credit Limit
    m = re.search(r"(?:Total\s+)?Credit\s+Limit[:\s]*(?:Rs\.?\s*|₹\s*)?([\d,]+\.?\d*)", text, re.I)
    if m:
        statement.credit_limit = parse_amount(m.group(1))

    # Available Credit
    m = re.search(r"Available\s+(?:Credit|Limit)[:\s]*(?:Rs\.?\s*|₹\s*)?([\d,]+\.?\d*)", text, re.I)
    if m:
        statement.available_credit = parse_amount(m.group(1))

    # Card last four digits
    m = re.search(r"(?:Card\s+(?:No|Number|#)[:\s]*)?(?:\*{4,}\s*)?(\d{4})\s*$", text, re.M)
    if m:
        statement.card_last_four = m.group(1)

    # Previous balance
    m = re.search(r"(?:Previous|Opening)\s+Balance[:\s]*(?:Rs\.?\s*|₹\s*)?([\d,]+\.?\d*)", text, re.I)
    if m:
        statement.previous_balance = parse_amount(m.group(1))

    # Interest / Finance Charges
    m = re.search(r"(?:Finance|Interest)\s+Charges?[:\s]*(?:Rs\.?\s*|₹\s*)?([\d,]+\.?\d*)", text, re.I)
    if m:
        statement.interest_charged = parse_amount(m.group(1))


def _extract_transactions_from_tables(tables: list, full_text: str) -> list[ParsedCCTransaction]:
    """Extract transactions from pdfplumber table data."""
    transactions: list[ParsedCCTransaction] = []

    for table in tables:
        if not table or len(table) < 2:
            continue

        # Find header row
        header_idx = -1
        for i, row in enumerate(table):
            if not row:
                continue
            row_text = " ".join(str(c or "") for c in row).lower()
            if "date" in row_text and ("amount" in row_text or "debit" in row_text or "credit" in row_text):
                header_idx = i
                break

        if header_idx == -1:
            continue

        headers = [str(c or "").strip().lower() for c in table[header_idx]]

        # Map columns
        date_col = next((i for i, h in enumerate(headers) if "date" in h), None)
        desc_col = next((i for i, h in enumerate(headers) if any(k in h for k in ["description", "particular", "narration", "detail"])), None)
        amount_col = next((i for i, h in enumerate(headers) if "amount" in h and "due" not in h), None)
        debit_col = next((i for i, h in enumerate(headers) if "debit" in h or h.strip() in ("dr", "dr.")), None)
        credit_col = next((i for i, h in enumerate(headers) if "credit" in h or h.strip() in ("cr", "cr.")), None)
        ref_col = next((i for i, h in enumerate(headers) if "ref" in h or "auth" in h), None)

        if date_col is None:
            continue

        for row in table[header_idx + 1:]:
            if not row or len(row) <= date_col:
                continue

            date_str = str(row[date_col] or "").strip()
            d = parse_date(date_str)
            if not d:
                continue

            desc = str(row[desc_col] or "").strip() if desc_col is not None and desc_col < len(row) else ""
            ref = str(row[ref_col] or "").strip() if ref_col is not None and ref_col < len(row) else None

            amount = None
            is_credit = False

            if debit_col is not None and credit_col is not None:
                dv = parse_amount(str(row[debit_col] or "")) if debit_col < len(row) else None
                cv = parse_amount(str(row[credit_col] or "")) if credit_col < len(row) else None
                if dv and dv > 0:
                    amount = dv
                elif cv and cv > 0:
                    amount = cv
                    is_credit = True
            elif amount_col is not None and amount_col < len(row):
                raw = str(row[amount_col] or "").strip()
                amount = parse_amount(raw)
                if raw.endswith("Cr") or raw.endswith("CR") or raw.startswith("-"):
                    is_credit = True

            if not amount:
                continue

            txn_type = _infer_transaction_type(desc, is_credit)
            category = _infer_category(desc) if txn_type == "purchase" else None

            transactions.append(ParsedCCTransaction(
                transaction_date=d.isoformat(),
                description=desc,
                reference=ref,
                merchant_name=_clean_merchant_name(desc),
                amount=-amount if is_credit else amount,
                transaction_type=txn_type,
                category=category,
            ))

    return transactions


def _infer_transaction_type(description: str, is_credit: bool) -> str:
    """Infer the transaction type from description text."""
    desc_lower = description.lower()

    if is_credit:
        if any(k in desc_lower for k in ["refund", "reversal"]):
            return "refund"
        if any(k in desc_lower for k in ["cashback", "reward"]):
            return "cashback"
        if any(k in desc_lower for k in ["payment", "neft", "imps", "auto debit", "thank you"]):
            return "payment"
        return "refund"

    if any(k in desc_lower for k in ["finance charge", "interest"]):
        return "interest"
    if any(k in desc_lower for k in ["late payment", "annual fee", "membership fee", "gst", "surcharge", "overlimit", "cash advance fee"]):
        return "fee"
    if any(k in desc_lower for k in ["emi", "instacred", "smartemi", "flexi pay"]):
        return "emi_charge"
    return "purchase"


_CATEGORY_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"swiggy|zomato|dominos|pizza|restaurant|cafe|starbucks|mcdonald|kfc|food|biryani|chicken", re.I), "food_groceries"),
    (re.compile(r"bigbasket|blinkit|zepto|dmart|grofers|grocery|supermarket|more\s+mega|reliance\s+fresh|nature.s\s+basket", re.I), "food_groceries"),
    (re.compile(r"amazon|flipkart|myntra|ajio|meesho|nykaa|tata\s*cliq|shopping|mall|lifestyle|shoppers", re.I), "shopping"),
    (re.compile(r"uber|ola|rapido|metro|irctc|petrol|fuel|hp\s*petroleum|bharat\s*petroleum|indian\s*oil|toll|fastag|parking", re.I), "transport"),
    (re.compile(r"netflix|hotstar|disney|prime\s*video|youtube|spotify|apple\s*music|jio\s*cinema|zee5|sony\s*liv", re.I), "subscriptions"),
    (re.compile(r"movie|pvr|inox|bookmyshow|gaming|playstation|xbox|steam", re.I), "entertainment"),
    (re.compile(r"hospital|pharmacy|medic|apollo|doctor|dr\.|health|dental|1mg|pharmeasy|netmeds", re.I), "health"),
    (re.compile(r"electricity|water|gas\s*bill|broadband|jio|airtel|vodafone|bsnl|recharge|postpaid|wifi|internet|tata\s*play|dish\s*tv", re.I), "utilities"),
    (re.compile(r"rent|society|maintenance|housing", re.I), "rent"),
    (re.compile(r"school|college|university|udemy|coursera|education|tuition|book|kindle", re.I), "education"),
]


def _infer_category(description: str) -> Optional[str]:
    """Infer expense category from transaction description."""
    for pattern, category in _CATEGORY_RULES:
        if pattern.search(description):
            return category
    return "miscellaneous"


def _clean_merchant_name(description: str) -> Optional[str]:
    """Extract a clean merchant name from raw transaction description."""
    if not description:
        return None
    # Remove common suffixes
    cleaned = re.sub(r"\s*(?:IN|INDIA|PVT|LTD|PRIVATE|LIMITED|MUMBAI|BANGALORE|DELHI|CHENNAI|HYDERABAD|PUNE|GURGAON|NOIDA)\b.*$", "", description, flags=re.I)
    # Remove reference numbers at the end
    cleaned = re.sub(r"\s+\d{6,}$", "", cleaned)
    # Remove trailing special characters
    cleaned = cleaned.rstrip("*- /.")
    return cleaned.strip()[:60] if cleaned.strip() else None


def _extract_json_from_response(text: str) -> dict[str, Any]:
    """Strip markdown fences if present and parse JSON."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    return json.loads(text)


def parse_cc_statement(
    file_bytes: bytes,
    mime_type: str = "application/pdf",
) -> ParsedCCStatement:
    """
    Parse an HDFC credit card statement PDF.

    Uses hybrid approach:
    1. Try pdfplumber table extraction (fast, free)
    2. Fall back to Claude Vision for complex layouts

    Args:
        file_bytes: Raw file bytes
        mime_type: MIME type of the file

    Returns:
        ParsedCCStatement with summary + transactions
    """
    # Step 1: Try local extraction for PDFs
    if mime_type == "application/pdf":
        local_result = _try_pdfplumber_extraction(file_bytes)
        if local_result and len(local_result.transactions) >= 3:
            logger.info("CC parser: local extraction succeeded with %d transactions", len(local_result.transactions))
            return local_result
        logger.info("CC parser: local extraction insufficient, falling back to Claude Vision")

    # Step 2: Claude Vision extraction
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY not configured in .env")

    client = Anthropic(api_key=settings.anthropic_api_key)

    # Build content blocks
    content: list[dict[str, Any]] = [
        {"type": "text", "text": "Extract all data from the following HDFC credit card statement:"},
    ]

    if mime_type == "application/pdf":
        try:
            page_images = _pdf_to_images(file_bytes)
        except Exception as e:
            logger.error("PDF conversion failed: %s", e)
            raise ValueError(f"Could not process PDF: {e}")

        for img_bytes in page_images:
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": base64.standard_b64encode(img_bytes).decode("utf-8"),
                },
            })
    elif mime_type in ("image/jpeg", "image/jpg", "image/png"):
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg" if "jpeg" in mime_type or "jpg" in mime_type else "image/png",
                "data": base64.standard_b64encode(file_bytes).decode("utf-8"),
            },
        })
    else:
        raise ValueError(f"Unsupported file type: {mime_type}")

    logger.info("Sending CC statement to Claude (model=%s)", MODEL)

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=8192,  # CC statements can have many transactions
            system=CC_STATEMENT_EXTRACTION_PROMPT,
            messages=[{"role": "user", "content": content}],
        )
    except Exception as e:
        logger.error("Claude API call failed: %s", e)
        raise

    response_text = response.content[0].text if response.content else ""
    logger.info("Claude CC response (first 500 chars): %s", response_text[:500])

    try:
        data = _extract_json_from_response(response_text)
    except json.JSONDecodeError as e:
        logger.error("Could not parse Claude response as JSON: %s\nResponse: %s", e, response_text)
        raise ValueError(f"Parser returned invalid JSON: {e}")

    # Build the result
    def _num(v: Any) -> Optional[float]:
        if v is None or v == "":
            return None
        try:
            return float(v)
        except (ValueError, TypeError):
            return None

    def _str(v: Any) -> Optional[str]:
        if v is None or v == "":
            return None
        return str(v).strip() or None

    parsed = ParsedCCStatement(
        card_last_four=_str(data.get("card_last_four")),
        statement_date=_str(data.get("statement_date")),
        due_date=_str(data.get("due_date")),
        billing_period_start=_str(data.get("billing_period_start")),
        billing_period_end=_str(data.get("billing_period_end")),
        total_amount_due=_num(data.get("total_amount_due")),
        minimum_amount_due=_num(data.get("minimum_amount_due")) or 0.0,
        previous_balance=_num(data.get("previous_balance")) or 0.0,
        payments_received=_num(data.get("payments_received")) or 0.0,
        new_charges=_num(data.get("new_charges")) or 0.0,
        interest_charged=_num(data.get("interest_charged")) or 0.0,
        fees_charged=_num(data.get("fees_charged")) or 0.0,
        credit_limit=_num(data.get("credit_limit")),
        available_credit=_num(data.get("available_credit")),
        confidence=data.get("confidence") or {},
        warnings=data.get("warnings") or [],
        raw_response=response_text,
    )

    # Parse transactions
    for txn_data in data.get("transactions") or []:
        txn_type = _str(txn_data.get("transaction_type")) or "purchase"
        if txn_type not in ("purchase", "refund", "fee", "interest", "payment", "cashback", "emi_charge"):
            txn_type = "purchase"

        parsed.transactions.append(ParsedCCTransaction(
            transaction_date=_str(txn_data.get("transaction_date")),
            posting_date=_str(txn_data.get("posting_date")),
            description=_str(txn_data.get("description")),
            reference=_str(txn_data.get("reference")),
            merchant_name=_str(txn_data.get("merchant_name")),
            amount=_num(txn_data.get("amount")),
            transaction_type=txn_type,
            category=_str(txn_data.get("category")),
        ))

    logger.info("CC parser: extracted %d transactions, total_due=%s",
                len(parsed.transactions), parsed.total_amount_due)

    return parsed


def parsed_cc_statement_to_dict(p: ParsedCCStatement) -> dict[str, Any]:
    """Convert to a JSON-serializable dict for the API response."""
    d = asdict(p)
    d.pop("raw_response", None)
    return d
