"""
BNPL invoice parser using Claude Vision API.
Extracts structured purchase data from Amazon Pay Later invoices.

Supports:
- PDF (converted to images)
- JPG/PNG images
- Two-file input: order invoice + optional EMI confirmation
"""

import base64
import io
import json
import logging
import re
from dataclasses import dataclass, field, asdict
from typing import Any, Optional

from anthropic import Anthropic

from core.config import get_settings

logger = logging.getLogger(__name__)

# Cost-effective, fast model for document extraction
MODEL = "claude-haiku-4-5-20251001"

# Default tenure assumption for Amazon Pay Later if not present in docs
DEFAULT_PAYLATER_DAYS = 30


@dataclass
class ParsedInvoice:
    # Core purchase fields
    item_name: Optional[str] = None
    item_category: Optional[str] = None
    merchant_name: Optional[str] = None
    order_id: Optional[str] = None
    total_amount: Optional[float] = None
    down_payment: Optional[float] = None
    interest_rate: Optional[float] = None
    interest_rate_type: Optional[str] = None  # "per_annum" | "flat"
    processing_fee: Optional[float] = None
    total_payable: Optional[float] = None
    emi_amount: Optional[float] = None
    total_emis: Optional[int] = None
    purchase_date: Optional[str] = None  # ISO yyyy-mm-dd
    first_emi_date: Optional[str] = None
    emi_day_of_month: Optional[int] = None
    notes: Optional[str] = None
    # Metadata
    confidence: dict[str, str] = field(default_factory=dict)  # field -> "high" | "low" | "missing"
    warnings: list[str] = field(default_factory=list)
    raw_response: Optional[str] = None


EXTRACTION_PROMPT = """You are an expert at extracting structured data from Amazon Pay Later invoices and EMI confirmation documents for India.

You will be shown one or two documents:
1. Order invoice / order summary (required — shows the purchase)
2. EMI confirmation / Pay Later dashboard screenshot (optional — shows EMI terms)

Extract the following fields and return ONLY a JSON object (no markdown, no explanation):

{
  "item_name": "Primary product name, trimmed to max 100 chars. If multiple items, use the primary one.",
  "item_category": "One of: electronics, appliances, fashion, furniture, groceries, health_personal, books_education, home_kitchen, travel, software, other. Infer from item_name.",
  "merchant_name": "Seller/brand name (e.g. RetailEZ Pvt Ltd, Amazon).",
  "order_id": "Order number exactly as shown (e.g. 171-7679010-9117957).",
  "total_amount": "Grand Total / final amount paid (number, no currency symbol). Use Grand Total if shown, else Total.",
  "down_payment": "Down payment if shown, else 0.",
  "interest_rate": "Interest rate percentage (number). Amazon Pay Later standard rate is 20% p.a. for paid-interest EMIs. For 'No Cost EMI' or 'No Cost EMI Discount', set 0.",
  "interest_rate_type": "'per_annum' for standard EMIs (including Amazon Pay Later at 20% p.a.). 'flat' ONLY for No Cost EMI where effective rate is 0.",
  "processing_fee": "Processing / convenience fee if shown (look for 'Processing Fee', 'Convenience Fee', 'Service Fee'), else 0.",
  "total_payable": "Sum of all EMIs + processing fee. Equal to total_amount if single payment.",
  "emi_amount": "Monthly EMI amount (number). If not explicitly shown but tenure is visible, leave null — the frontend will calculate it.",
  "total_emis": "Number of EMIs (integer). See Amazon Pay Later inference rules below.",
  "purchase_date": "Order date in YYYY-MM-DD format.",
  "first_emi_date": "First EMI due date in YYYY-MM-DD. If not shown, leave null.",
  "emi_day_of_month": "Day of month the EMI is due (1-31). If not shown, null.",
  "notes": "Relevant extras: 'No Cost EMI', 'Cashback applied', seller info, payment mode, etc. Max 200 chars.",
  "confidence": {
    "<field_name>": "high | low | missing"
  },
  "warnings": ["List any issues, ambiguities, or fields the user MUST verify manually."]
}

## Amazon Pay Later — Inference Rules

When the invoice shows "Amazon Pay Later", "AmazonCredit", or "Pay Later" as payment mode:

1. **If tenure/EMI count is NOT explicit in the document**:
   - DO NOT assume 1 EMI (single payment). Amazon Pay Later defaults to monthly EMI plans (3, 6, 9, or 12 months).
   - For amounts ₹3,000–₹20,000: most common tenure is 3 months.
   - For amounts ₹20,000–₹50,000: most common tenure is 6 or 9 months.
   - For amounts above ₹50,000: most common is 9 or 12 months.
   - Set `total_emis` to null and add a warning: "EMI tenure not in document — please verify (3/6/9/12 months)".
   - Default `interest_rate` to 20 (standard Amazon Pay Later rate) and `interest_rate_type` to "per_annum".
   - Add warning: "Assumed standard Amazon Pay Later rate of 20% p.a. — verify against actual EMI terms".

2. **If "No Cost EMI" is visible**: set `interest_rate = 0` and `interest_rate_type = "flat"`.

3. **Processing fee detection**: Amazon Pay Later typically charges a processing fee (often called "EMI Processing Fee" or bundled into the total). If you see an itemized fee line, extract it exactly.

## General Guidelines

- NEVER invent specific data like exact EMI amounts or due dates — leave them null if not shown.
- DO apply reasonable defaults for Amazon Pay Later rate (20% p.a.) since it's a well-known constant.
- Dates: convert "2 December 2025" → "2025-12-02".
- Amounts: remove ₹ and commas. "₹18,421.09" → 18421.09.
- If multiple totals appear (Item Total, Shipping, Grand Total), use Grand Total.
- For item_category inference:
  * Desk / chair / table → furniture
  * Phone / laptop / earbuds / monitor / keyboard → electronics
  * Refrigerator / washing machine / AC → appliances
  * Book / course / kindle → books_education
  * Shirt / dress / shoes → fashion
  * Food / snacks → groceries

## Warnings — Be Specific

Good warnings:
- "EMI tenure not in document — please verify (typical: 3, 6, 9, or 12 months)"
- "Interest rate assumed 20% p.a. based on Amazon Pay Later standard — verify with EMI confirmation"
- "Processing fee not visible in invoice — check your EMI confirmation email"
- "First EMI date not shown — typically 30 days after purchase"

Avoid vague warnings like "Please verify all details" — be specific about which field is uncertain and why.

Return ONLY the JSON. No markdown fences, no prose."""


def _pdf_to_images(pdf_bytes: bytes) -> list[bytes]:
    """Convert each PDF page to a PNG image. Returns list of PNG bytes."""
    try:
        import pdfplumber
        from PIL import Image
    except ImportError as e:
        logger.error("PDF conversion requires pdfplumber + pillow: %s", e)
        raise

    images: list[bytes] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        # Cap at 4 pages — invoices are usually 1-2 pages
        for page in pdf.pages[:4]:
            img = page.to_image(resolution=150).original
            buf = io.BytesIO()
            img.save(buf, format="PNG", optimize=True)
            images.append(buf.getvalue())
    return images


def _file_to_content_blocks(file_bytes: bytes, mime_type: str, label: str) -> list[dict[str, Any]]:
    """Convert a file (PDF or image) to Claude message content blocks."""
    blocks: list[dict[str, Any]] = [{"type": "text", "text": f"\n\n=== {label} ===\n"}]

    if mime_type == "application/pdf":
        # Convert PDF pages to images
        try:
            page_images = _pdf_to_images(file_bytes)
        except Exception as e:
            logger.error("PDF conversion failed: %s", e)
            raise ValueError(f"Could not process PDF: {e}")

        for i, img_bytes in enumerate(page_images):
            blocks.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": base64.standard_b64encode(img_bytes).decode("utf-8"),
                },
            })
    elif mime_type in ("image/jpeg", "image/jpg", "image/png"):
        blocks.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg" if mime_type in ("image/jpg", "image/jpeg") else "image/png",
                "data": base64.standard_b64encode(file_bytes).decode("utf-8"),
            },
        })
    else:
        raise ValueError(f"Unsupported file type: {mime_type}")

    return blocks


def _extract_json_from_response(text: str) -> dict[str, Any]:
    """Strip markdown fences if present and parse JSON."""
    text = text.strip()
    # Remove markdown code fences
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    return json.loads(text)


def parse_invoice(
    order_file: tuple[bytes, str],
    emi_file: Optional[tuple[bytes, str]] = None,
) -> ParsedInvoice:
    """
    Parse an Amazon Pay Later invoice using Claude Vision.

    Args:
        order_file: (bytes, mime_type) for the order invoice PDF/image
        emi_file: Optional (bytes, mime_type) for EMI confirmation

    Returns:
        ParsedInvoice with extracted fields + confidence metadata.
    """
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY not configured in .env")

    client = Anthropic(api_key=settings.anthropic_api_key)

    # Build message content
    content: list[dict[str, Any]] = [
        {"type": "text", "text": "Extract structured data from the following document(s):"},
    ]
    content.extend(_file_to_content_blocks(order_file[0], order_file[1], "ORDER INVOICE"))
    if emi_file:
        content.extend(_file_to_content_blocks(emi_file[0], emi_file[1], "EMI CONFIRMATION"))
    else:
        content.append({
            "type": "text",
            "text": "\n\nNote: No EMI confirmation provided. Extract what you can from the order invoice only.",
        })

    logger.info("Sending invoice to Claude (model=%s, has_emi_file=%s)", MODEL, bool(emi_file))

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=EXTRACTION_PROMPT,
            messages=[{"role": "user", "content": content}],
        )
    except Exception as e:
        logger.error("Claude API call failed: %s", e)
        raise

    response_text = response.content[0].text if response.content else ""
    logger.info("Claude response (first 500 chars): %s", response_text[:500])

    try:
        data = _extract_json_from_response(response_text)
    except json.JSONDecodeError as e:
        logger.error("Could not parse Claude response as JSON: %s\nResponse: %s", e, response_text)
        raise ValueError(f"Parser returned invalid JSON: {e}")

    # Coerce types and build the dataclass
    def _num(v: Any) -> Optional[float]:
        if v is None or v == "":
            return None
        try:
            return float(v)
        except (ValueError, TypeError):
            return None

    def _int(v: Any) -> Optional[int]:
        n = _num(v)
        return int(n) if n is not None else None

    def _str(v: Any) -> Optional[str]:
        if v is None or v == "":
            return None
        return str(v).strip() or None

    parsed = ParsedInvoice(
        item_name=_str(data.get("item_name")),
        item_category=_str(data.get("item_category")),
        merchant_name=_str(data.get("merchant_name")),
        order_id=_str(data.get("order_id")),
        total_amount=_num(data.get("total_amount")),
        down_payment=_num(data.get("down_payment")) or 0.0,
        interest_rate=_num(data.get("interest_rate")) or 0.0,
        interest_rate_type=_str(data.get("interest_rate_type")) or "per_annum",
        processing_fee=_num(data.get("processing_fee")) or 0.0,
        total_payable=_num(data.get("total_payable")),
        emi_amount=_num(data.get("emi_amount")),
        total_emis=_int(data.get("total_emis")),
        purchase_date=_str(data.get("purchase_date")),
        first_emi_date=_str(data.get("first_emi_date")),
        emi_day_of_month=_int(data.get("emi_day_of_month")),
        notes=_str(data.get("notes")),
        confidence=data.get("confidence") or {},
        warnings=data.get("warnings") or [],
        raw_response=response_text,
    )

    # Sanity-check interest_rate_type
    if parsed.interest_rate_type not in ("per_annum", "flat"):
        parsed.interest_rate_type = "per_annum"

    # Sanity-check item_category
    valid_cats = {"electronics", "appliances", "fashion", "furniture", "groceries",
                  "health_personal", "books_education", "home_kitchen", "travel", "software", "other"}
    if parsed.item_category not in valid_cats:
        parsed.item_category = "other"

    logger.info("Parsed invoice: item=%s, total=%s, emis=%s, warnings=%s",
                parsed.item_name, parsed.total_amount, parsed.total_emis, parsed.warnings)

    return parsed


def parsed_invoice_to_dict(p: ParsedInvoice) -> dict[str, Any]:
    """Convert to a JSON-serializable dict for the API response."""
    d = asdict(p)
    # Don't leak the raw Claude response to the client
    d.pop("raw_response", None)
    return d
