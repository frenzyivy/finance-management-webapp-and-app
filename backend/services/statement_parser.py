"""
Bank statement parser for CSV and PDF files.
Supports common Indian bank statement formats (SBI, HDFC, ICICI, Axis, Kotak, BOB, PNB, etc.).
"""

import csv
import hashlib
import io
import logging
import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class ParsedTransaction:
    amount: float
    transaction_type: str  # "debit" or "credit"
    date: date
    description: Optional[str] = None
    reference: Optional[str] = None
    balance: Optional[float] = None
    dedup_hash: Optional[str] = None


def generate_dedup_hash(amount: float, txn_date: date, reference: Optional[str], description: Optional[str]) -> str:
    raw = f"{amount:.2f}|{txn_date.isoformat()}|{reference or ''}|{description or ''}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


# ── Date Parsing ──

DATE_FORMATS = [
    "%d/%m/%Y",   # 13/04/2026
    "%d-%m-%Y",   # 13-04-2026
    "%d/%m/%y",   # 13/04/26
    "%d-%m-%y",   # 13-04-26
    "%Y-%m-%d",   # 2026-04-13
    "%d-%b-%Y",   # 13-Apr-2026
    "%d-%b-%y",   # 13-Apr-26
    "%d %b %Y",   # 13 Apr 2026
    "%d/%b/%Y",   # 13/Apr/2026
    "%d %b %y",   # 13 Apr 26
    "%m/%d/%Y",   # 04/13/2026 (US format, less common)
    "%d %B %Y",   # 13 April 2026
    "%d-%B-%Y",   # 13-April-2026
    "%d/%m/%Y %H:%M:%S",  # 13/04/2026 14:30:00
    "%d-%m-%Y %H:%M:%S",  # 13-04-2026 14:30:00
    "%Y-%m-%dT%H:%M:%S",  # ISO with time
]


def parse_date(value: str) -> Optional[date]:
    value = value.strip()
    # Remove extra whitespace/newlines that can appear in PDF extraction
    value = re.sub(r"\s+", " ", value).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


# ── Amount Parsing ──

def parse_amount(value: str) -> Optional[float]:
    if not value:
        return None
    value = value.strip()
    # Remove currency prefixes like "Rs.", "Rs", "INR", "₹" (but NOT the decimal point in the number)
    cleaned = re.sub(r"(?:Rs\.?\s*|INR\s*|₹\s*)", "", value, flags=re.I)
    # Remove commas and spaces used as thousands separators
    cleaned = re.sub(r"[,\s]", "", cleaned)
    # Remove trailing minus/parentheses that some banks use
    cleaned = cleaned.strip("()")
    # Remove leading/trailing whitespace and hyphens used as nil
    cleaned = cleaned.strip()
    if not cleaned or cleaned in ("-", "--", ""):
        return None
    try:
        return abs(float(cleaned))
    except ValueError:
        return None


# ── Column Mapping Heuristics ──

# Expanded header patterns to cover more Indian bank statement formats
COLUMN_PATTERNS = {
    "date": re.compile(
        r"date|txn\s*\.?\s*date|transaction\s*date|value\s*\.?\s*date|posting\s*date"
        r"|trans\.?\s*date|tran\s*date|dated|book\s*date",
        re.I,
    ),
    "description": re.compile(
        r"description|narration|particulars|details|remarks"
        r"|transaction\s*details|transaction\s*particulars|transaction\s*remarks"
        r"|mode\s*/?\s*description|narr",
        re.I,
    ),
    "debit": re.compile(
        r"debit|withdrawal|dr\.?\b|amount\s*debited|debit\s*amount"
        r"|withdrawal\s*\(?(?:dr\.?\)?)?"
        r"|withdraw(?:als?)?"
        r"|spent|paid|outflow",
        re.I,
    ),
    "credit": re.compile(
        r"credit|deposit|cr\.?\b|amount\s*credited|credit\s*amount"
        r"|deposit\s*\(?(?:cr\.?\)?)?"
        r"|received|inflow",
        re.I,
    ),
    "amount": re.compile(
        r"^amount$|transaction\s*amount|txn\s*\.?\s*amount|amt\.?$",
        re.I,
    ),
    "dr_cr_indicator": re.compile(
        r"^dr\s*/\s*cr$|^cr\s*/\s*dr$|^type$|^txn\s*type$|^transaction\s*type$",
        re.I,
    ),
    "balance": re.compile(
        r"balance|closing\s*balance|available\s*balance|running\s*balance"
        r"|bal\.?$|closing\s*bal\.?",
        re.I,
    ),
    "reference": re.compile(
        r"ref\.?\s*(?:no\.?|number)?|reference|chq\.?\s*(?:no\.?)?|cheque"
        r"|utr|txn\s*\.?\s*(?:id|no\.?)|transaction\s*(?:id|no\.?)"
        r"|instrument\s*id|ref\s*id",
        re.I,
    ),
}


def detect_columns(headers: list[str]) -> dict[str, int]:
    """Map logical column names to their index in the CSV row."""
    mapping = {}
    for idx, header in enumerate(headers):
        header_clean = header.strip()
        if not header_clean:
            continue
        for col_type, pattern in COLUMN_PATTERNS.items():
            if pattern.search(header_clean) and col_type not in mapping:
                mapping[col_type] = idx
                break
    logger.debug("Column detection result: headers=%s mapping=%s", headers, mapping)
    return mapping


def detect_delimiter(content: str) -> str:
    """Detect the CSV delimiter by counting occurrences in the first few lines."""
    lines = content.strip().split("\n")[:10]
    candidates = {",": 0, "\t": 0, ";": 0, "|": 0}
    for line in lines:
        for delim in candidates:
            candidates[delim] += line.count(delim)
    best = max(candidates, key=candidates.get)
    logger.debug("Delimiter detection: counts=%s chosen='%s'", candidates, best)
    return best


# ── CSV Parser ──


def _try_infer_columns_from_data(rows: list[list[str]]) -> tuple[int, dict[str, int]]:
    """Fallback: scan each column for date-like and amount-like values to infer mapping.

    Returns (header_idx, col_map) where header_idx is -1 if no header row was found
    (meaning data starts at row 0).
    """
    if not rows:
        return -1, {}

    # Sample up to 20 data rows for inference
    sample = rows[:20]
    col_count = max(len(r) for r in sample) if sample else 0

    date_scores: dict[int, int] = {}
    amount_scores: dict[int, int] = {}
    # Track typical values to distinguish real amounts from serial numbers
    amount_sums: dict[int, float] = {}

    for row in sample:
        for idx in range(min(len(row), col_count)):
            cell = row[idx].strip()
            if not cell:
                continue
            if parse_date(cell):
                date_scores[idx] = date_scores.get(idx, 0) + 1
            amt = parse_amount(cell)
            if amt is not None and re.search(r"\d", cell):
                amount_scores[idx] = amount_scores.get(idx, 0) + 1
                amount_sums[idx] = amount_sums.get(idx, 0) + amt

    if not date_scores:
        return -1, {}

    # Best date column = most date-parseable values
    date_col = max(date_scores, key=date_scores.get)

    # Amount columns: all columns where >30% of samples parsed as amounts, excluding date col
    # Filter out likely serial number columns (avg value < 50 and values are sequential small ints)
    threshold = len(sample) * 0.3
    candidate_amount_cols = []
    for c, s in amount_scores.items():
        if c == date_col or s < threshold:
            continue
        avg_val = amount_sums.get(c, 0) / max(s, 1)
        # Serial numbers typically have small sequential values; real amounts are usually > 10
        if avg_val < 10 and s == len(sample):
            logger.debug("Column inference: skipping col %d (avg=%.1f, likely serial number)", c, avg_val)
            continue
        candidate_amount_cols.append(c)

    amount_cols = sorted(
        candidate_amount_cols,
        key=lambda c: amount_sums.get(c, 0),  # Prefer columns with larger total sums (real money)
        reverse=True,
    )

    col_map: dict[str, int] = {"date": date_col}

    if len(amount_cols) >= 2:
        # Two amount columns → likely debit/credit (pick first two by column position)
        sorted_by_pos = sorted(amount_cols[:2])
        col_map["debit"] = sorted_by_pos[0]
        col_map["credit"] = sorted_by_pos[1]
    elif len(amount_cols) == 1:
        col_map["amount"] = amount_cols[0]

    # Description = longest text column that isn't date/amount
    used = {date_col} | set(amount_cols[:2])
    text_scores: dict[int, int] = {}
    for row in sample:
        for idx in range(min(len(row), col_count)):
            if idx in used:
                continue
            cell = row[idx].strip()
            if len(cell) > 5:
                text_scores[idx] = text_scores.get(idx, 0) + len(cell)

    if text_scores:
        col_map["description"] = max(text_scores, key=text_scores.get)

    logger.info("Column inference from data: col_map=%s (date_scores=%s, amount_cols=%s)", col_map, date_scores, amount_cols)
    return -1, col_map


def parse_csv(file_content: bytes) -> list[ParsedTransaction]:
    """Parse a bank statement CSV file into transactions."""
    # Try multiple encodings
    text = None
    for encoding in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
        try:
            text = file_content.decode(encoding)
            break
        except (UnicodeDecodeError, ValueError):
            continue
    if text is None:
        logger.error("CSV: could not decode file with any known encoding")
        return []

    delimiter = detect_delimiter(text)

    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    rows = list(reader)

    if not rows:
        logger.warning("CSV: file is empty (no rows)")
        return []

    # Find header row (first row with enough non-empty cells)
    header_idx = 0
    for i, row in enumerate(rows):
        non_empty = sum(1 for cell in row if cell.strip())
        if non_empty >= 3:
            header_idx = i
            break

    headers = rows[header_idx]
    col_map = detect_columns(headers)

    logger.info("CSV: %d rows, header at row %d, headers=%s, detected columns=%s",
                len(rows), header_idx, headers[:10], col_map)

    # If header detection failed, try content-based inference
    data_start = header_idx + 1
    if "date" not in col_map:
        logger.info("CSV: header-based detection failed, trying content-based inference")
        inferred_idx, col_map = _try_infer_columns_from_data(rows)
        if "date" not in col_map:
            logger.warning("CSV: could not detect date column by header or content inference. "
                           "Headers found: %s", headers[:10])
            return []
        # If inference worked, data starts from row 0 (no header) or we skip the header-like row
        if inferred_idx == -1:
            # Check if the first row looks like a header (non-date in date column)
            first_date = parse_date(rows[0][col_map["date"]].strip()) if rows[0] else None
            data_start = 0 if first_date else 1

    has_separate_debit_credit = "debit" in col_map and "credit" in col_map
    has_single_amount = "amount" in col_map and not has_separate_debit_credit
    has_dr_cr_indicator = "dr_cr_indicator" in col_map

    if not has_separate_debit_credit and not has_single_amount:
        logger.warning("CSV: no debit/credit or amount columns detected. col_map=%s", col_map)
        return []

    _cr_indicator_re = re.compile(r"cr\.?|credit", re.I)
    _dr_indicator_re = re.compile(r"dr\.?|debit", re.I)

    transactions = []
    skipped = 0

    for row in rows[data_start:]:
        if len(row) <= col_map.get("date", 0):
            continue

        # Parse date
        date_val = parse_date(row[col_map["date"]])
        if not date_val:
            skipped += 1
            continue

        # Parse amount and type
        amount = None
        txn_type = None

        if has_separate_debit_credit:
            debit_val = parse_amount(row[col_map["debit"]]) if col_map["debit"] < len(row) else None
            credit_val = parse_amount(row[col_map["credit"]]) if col_map["credit"] < len(row) else None

            if debit_val and debit_val > 0:
                amount = debit_val
                txn_type = "debit"
            elif credit_val and credit_val > 0:
                amount = credit_val
                txn_type = "credit"
        elif has_single_amount:
            raw_val = row[col_map["amount"]].strip() if col_map["amount"] < len(row) else ""
            amount = parse_amount(raw_val)
            if amount:
                # First check Dr/Cr indicator column if available
                if has_dr_cr_indicator and col_map["dr_cr_indicator"] < len(row):
                    indicator = row[col_map["dr_cr_indicator"]].strip()
                    if _cr_indicator_re.search(indicator):
                        txn_type = "credit"
                    else:
                        txn_type = "debit"
                else:
                    # Infer debit/credit from sign or description keywords
                    is_negative = raw_val.startswith("-") or raw_val.startswith("(")
                    desc_text = row[col_map["description"]].strip().lower() if "description" in col_map and col_map["description"] < len(row) else ""
                    credit_keywords = {"credit", "deposit", "received", "credited", "refund", "cashback", "salary", "interest"}
                    if is_negative or any(kw in desc_text for kw in credit_keywords):
                        txn_type = "credit"
                    else:
                        txn_type = "debit"

        if not amount or amount <= 0:
            skipped += 1
            continue

        # Parse optional fields
        description = row[col_map["description"]].strip() if "description" in col_map and col_map["description"] < len(row) else None
        reference = row[col_map["reference"]].strip() if "reference" in col_map and col_map["reference"] < len(row) else None
        balance_val = parse_amount(row[col_map["balance"]]) if "balance" in col_map and col_map["balance"] < len(row) else None

        dedup = generate_dedup_hash(amount, date_val, reference, description)

        transactions.append(ParsedTransaction(
            amount=amount,
            transaction_type=txn_type,
            date=date_val,
            description=description,
            reference=reference,
            balance=balance_val,
            dedup_hash=dedup,
        ))

    logger.info("CSV: parsed %d transactions, skipped %d rows", len(transactions), skipped)
    return transactions


# ── PDF Parser ──


def _explode_merged_pdf_rows(rows: list[list[str]], col_map: dict[str, int]) -> list[list[str]]:
    """Handle PDFs where pdfplumber merges all transactions into a single row.

    Some bank PDFs (notably HDFC) have no horizontal lines between transactions,
    causing pdfplumber to extract all data as one row with newline-separated values
    in each cell. This function detects that pattern and splits them back into
    individual transaction rows.

    Strategy: use the date column as the anchor (1 line per transaction). Columns
    with the same line count (ref, balance, value date) align directly by index.
    The narration column has MORE lines (multi-line descriptions) and must be
    grouped by transaction. Debit/credit columns have FEWER lines (only transactions
    of that type) and must be assigned using the balance column as a guide.
    """
    if "date" not in col_map:
        return rows

    date_col = col_map["date"]
    exploded: list[list[str]] = []

    for row in rows:
        date_cell = row[date_col] if date_col < len(row) else ""
        date_lines = [line.strip() for line in date_cell.split("\n") if line.strip()]
        parseable_dates = [line for line in date_lines if parse_date(line)]

        if len(parseable_dates) <= 1:
            exploded.append(row)
            continue

        num_txns = len(parseable_dates)
        logger.info("PDF: exploding merged row with %d transactions", num_txns)

        # Split each cell by newlines
        col_lines: dict[int, list[str]] = {}
        for ci in range(len(row)):
            col_lines[ci] = [line.strip() for line in (row[ci] or "").split("\n")]

        # Identify column roles and their line counts
        ref_col = col_map.get("reference")
        desc_col = col_map.get("description")
        debit_col = col_map.get("debit")
        credit_col = col_map.get("credit")
        balance_col = col_map.get("balance")

        # 1:1 aligned columns (same count as date column)
        ref_lines = col_lines.get(ref_col, []) if ref_col is not None else []
        balance_lines = col_lines.get(balance_col, []) if balance_col is not None else []

        # Amount columns (fewer lines — only non-empty values)
        debit_vals = [v for v in col_lines.get(debit_col, []) if v.strip()] if debit_col is not None else []
        credit_vals = [v for v in col_lines.get(credit_col, []) if v.strip()] if credit_col is not None else []

        # Narration: more lines than transactions, need to group by transaction
        narr_lines = col_lines.get(desc_col, []) if desc_col is not None else []

        # Group narration lines by transaction: use ref column alignment.
        # Each ref has exactly one line per txn. The narration lines between
        # two ref entries belong to that transaction.
        # But since we know the exact number of txns and refs align 1:1 with dates,
        # we can use a different strategy: find which narration lines start a new txn
        # by looking for lines that match UPI/NEFT/IMPS transaction patterns or
        # by counting lines per ref entry.
        #
        # Simplest approach: since ref has N lines and narration has M > N lines,
        # the first narration line of each txn starts a "block". We match blocks
        # by looking for ref numbers in the narration text.
        narr_groups = _group_narration_lines(narr_lines, num_txns, ref_lines)

        # Assign debit/credit using balance progression
        debit_assignment, credit_assignment = _assign_debit_credit_by_balance(
            num_txns, debit_vals, credit_vals, balance_lines
        )

        # Build the exploded rows
        for i in range(num_txns):
            new_row = [""] * len(row)
            new_row[date_col] = date_lines[i] if i < len(date_lines) else ""
            if desc_col is not None:
                new_row[desc_col] = narr_groups[i] if i < len(narr_groups) else ""
            if ref_col is not None:
                new_row[ref_col] = ref_lines[i] if i < len(ref_lines) else ""
            if debit_col is not None:
                new_row[debit_col] = debit_assignment[i]
            if credit_col is not None:
                new_row[credit_col] = credit_assignment[i]
            if balance_col is not None:
                new_row[balance_col] = balance_lines[i] if i < len(balance_lines) else ""
            exploded.append(new_row)

        logger.debug("PDF: exploded into %d rows", num_txns)

    return exploded


_NARR_START_RE = re.compile(
    r"^(?:UPI[-/]|NEFT[-/]|IMPS[-/]|RTGS[-/]|POS[-/]|ATM[-/]|ACH[-/]"
    r"|AQB|BIL|MMT|CMS|CLG|ECS|SI[-/]|MPS"
    r"|\d{5,}[-/])"  # long numeric prefix like "50100693574894-TPT-..."
    , re.I,
)


def _group_narration_lines(narr_lines: list[str], num_txns: int, ref_lines: list[str]) -> list[str]:
    """Group multi-line narration text into per-transaction descriptions.

    Bank statement narrations span multiple lines. We detect transaction boundaries
    by looking for lines that start with known prefixes (UPI-, NEFT-, IMPS-, etc.)
    or long numeric codes that indicate a new transaction.
    """
    if not narr_lines:
        return [""] * num_txns

    if len(narr_lines) <= num_txns:
        return narr_lines + [""] * (num_txns - len(narr_lines))

    # Find lines that start a new transaction narration
    boundary_indices: list[int] = [0]  # First line always starts txn 1
    for i in range(1, len(narr_lines)):
        if _NARR_START_RE.match(narr_lines[i]):
            boundary_indices.append(i)

    # If we found the right number of boundaries, use them
    if len(boundary_indices) == num_txns:
        groups: list[str] = []
        for bi in range(num_txns):
            start = boundary_indices[bi]
            end = boundary_indices[bi + 1] if bi + 1 < len(boundary_indices) else len(narr_lines)
            groups.append(" ".join(narr_lines[start:end]))
        return groups

    # Fallback: try ref-based grouping
    if ref_lines and len(ref_lines) == num_txns:
        groups_ref: list[list[str]] = [[] for _ in range(num_txns)]
        current_txn = 0

        for line in narr_lines:
            if current_txn + 1 < num_txns:
                next_ref = ref_lines[current_txn + 1].strip()
                if next_ref and next_ref in line:
                    current_txn += 1
            groups_ref[current_txn].append(line)

        result = [" ".join(g) for g in groups_ref]
        if all(r for r in result):
            return result

    # Last fallback: distribute lines evenly
    lines_per_txn = len(narr_lines) / num_txns
    groups_fb: list[str] = []
    for i in range(num_txns):
        start = int(i * lines_per_txn)
        end = int((i + 1) * lines_per_txn)
        groups_fb.append(" ".join(narr_lines[start:end]))

    return groups_fb


def _assign_debit_credit_by_balance(
    num_txns: int,
    debit_vals: list[str],
    credit_vals: list[str],
    balance_lines: list[str],
) -> tuple[list[str], list[str]]:
    """Determine which transactions are debits vs credits using balance progression.

    For each transaction, compare balance[i] with balance[i-1]:
    - If balance decreased → it's a debit (withdrawal)
    - If balance increased → it's a credit (deposit)
    Then assign the next available debit/credit value accordingly.
    """
    debit_out = [""] * num_txns
    credit_out = [""] * num_txns

    # Parse all balance values
    balances = [parse_amount(b) for b in balance_lines[:num_txns]]

    debit_idx = 0
    credit_idx = 0

    for i in range(num_txns):
        is_debit = True  # default

        if i == 0:
            # First transaction: if we have a debit value, assume debit;
            # if only credit values exist or balance > 0 starting from 0, it's credit
            if not debit_vals and credit_vals:
                is_debit = False
            elif balances[0] is not None:
                # If first balance equals a credit value, it's a credit
                if credit_idx < len(credit_vals):
                    cv = parse_amount(credit_vals[credit_idx])
                    if cv and balances[0] is not None and abs(balances[0] - cv) < 0.01:
                        is_debit = False
        else:
            # Compare with previous balance
            if balances[i] is not None and balances[i - 1] is not None:
                if balances[i] > balances[i - 1]:
                    is_debit = False
                else:
                    is_debit = True

        if is_debit and debit_idx < len(debit_vals):
            debit_out[i] = debit_vals[debit_idx]
            debit_idx += 1
        elif not is_debit and credit_idx < len(credit_vals):
            credit_out[i] = credit_vals[credit_idx]
            credit_idx += 1
        else:
            # Fallback: try whichever has remaining values
            if debit_idx < len(debit_vals):
                debit_out[i] = debit_vals[debit_idx]
                debit_idx += 1
            elif credit_idx < len(credit_vals):
                credit_out[i] = credit_vals[credit_idx]
                credit_idx += 1

    return debit_out, credit_out


def parse_pdf(file_content: bytes) -> list[ParsedTransaction]:
    """Parse a bank statement PDF file into transactions."""
    try:
        import pdfplumber
    except ImportError:
        logger.error("PDF: pdfplumber not installed — run: pip install pdfplumber")
        return []

    transactions = []

    try:
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            all_rows = []
            headers_found = False
            col_map = {}

            logger.info("PDF: opened file with %d pages", len(pdf.pages))

            for page_num, page in enumerate(pdf.pages):
                tables = page.extract_tables()
                logger.debug("PDF: page %d has %d tables", page_num + 1, len(tables) if tables else 0)

                if not tables:
                    # Try extracting text line-by-line as fallback
                    text = page.extract_text()
                    if text:
                        logger.debug("PDF: page %d falling back to text extraction (%d chars)", page_num + 1, len(text))
                        line_txns = _parse_pdf_text_lines(text)
                        transactions.extend(line_txns)
                    continue

                for table in tables:
                    if not table:
                        continue

                    for row in table:
                        if not row or all(cell is None or str(cell).strip() == "" for cell in row):
                            continue

                        cleaned_row = [str(cell).strip() if cell else "" for cell in row]

                        # Try to detect header row
                        if not headers_found:
                            potential_map = detect_columns(cleaned_row)
                            if "date" in potential_map and ("debit" in potential_map or "credit" in potential_map or "amount" in potential_map):
                                col_map = potential_map
                                headers_found = True
                                logger.info("PDF: found header row on page %d: %s → %s", page_num + 1, cleaned_row, col_map)
                                continue

                        if not headers_found:
                            continue

                        all_rows.append(cleaned_row)

            # Explode merged rows (HDFC-style PDFs where all transactions are in one row)
            if headers_found and all_rows:
                all_rows = _explode_merged_pdf_rows(all_rows, col_map)
                logger.info("PDF: after explosion, %d data rows", len(all_rows))

            # If table extraction found headers but no data rows, try text fallback on all pages
            if headers_found and not all_rows:
                logger.info("PDF: headers found but no data rows in tables, trying text fallback")
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        line_txns = _parse_pdf_text_lines(text)
                        transactions.extend(line_txns)

            # If no headers found in tables at all, try content-based inference on table rows
            if not headers_found and not transactions:
                logger.info("PDF: no headers detected in tables, trying content-based inference")
                all_table_rows = []
                for page in pdf.pages:
                    for table in (page.extract_tables() or []):
                        for row in (table or []):
                            if row and not all(cell is None or str(cell).strip() == "" for cell in row):
                                all_table_rows.append([str(cell).strip() if cell else "" for cell in row])

                if all_table_rows:
                    inferred_idx, col_map = _try_infer_columns_from_data(all_table_rows)
                    if "date" in col_map:
                        headers_found = True
                        first_date = parse_date(all_table_rows[0][col_map["date"]]) if all_table_rows[0] else None
                        start = 0 if first_date else 1
                        all_rows = all_table_rows[start:]
                        logger.info("PDF: inferred columns from table data: %s, %d data rows", col_map, len(all_rows))

            # If still nothing, try full text extraction from all pages
            if not headers_found and not transactions:
                logger.info("PDF: no tables or headers found, trying full text extraction")
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        line_txns = _parse_pdf_text_lines(text)
                        transactions.extend(line_txns)

            # Parse data rows using detected column mapping
            has_separate = "debit" in col_map and "credit" in col_map
            for row in all_rows:
                if len(row) <= col_map.get("date", 0):
                    continue

                date_val = parse_date(row[col_map["date"]])
                if not date_val:
                    continue

                amount = None
                txn_type = None

                if has_separate:
                    debit_val = parse_amount(row[col_map["debit"]]) if col_map["debit"] < len(row) else None
                    credit_val = parse_amount(row[col_map["credit"]]) if col_map["credit"] < len(row) else None
                    if debit_val and debit_val > 0:
                        amount = debit_val
                        txn_type = "debit"
                    elif credit_val and credit_val > 0:
                        amount = credit_val
                        txn_type = "credit"
                elif "amount" in col_map and col_map["amount"] < len(row):
                    amount = parse_amount(row[col_map["amount"]])
                    if amount:
                        txn_type = "debit"

                if not amount or amount <= 0:
                    continue

                description = row[col_map["description"]].strip() if "description" in col_map and col_map["description"] < len(row) else None
                reference = row[col_map["reference"]].strip() if "reference" in col_map and col_map["reference"] < len(row) else None

                dedup = generate_dedup_hash(amount, date_val, reference, description)

                transactions.append(ParsedTransaction(
                    amount=amount,
                    transaction_type=txn_type,
                    date=date_val,
                    description=description,
                    reference=reference,
                    dedup_hash=dedup,
                ))

    except Exception as e:
        logger.error("PDF: parsing failed with error: %s", e, exc_info=True)
        return []

    logger.info("PDF: total parsed transactions = %d", len(transactions))
    return transactions


# ── PDF Text Line Fallback ──

# More flexible amount pattern: match numbers with optional currency prefix
_LINE_AMOUNT_RE = re.compile(
    r"(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)"
    r"|([\d,]+\.\d{2})\b"  # Also match bare amounts like 1,234.56
)
_LINE_DATE_RE = re.compile(
    r"(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}"
    r"|\d{1,2}[/\-][A-Za-z]{3}[/\-]\d{2,4}"
    r"|\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})"  # Also match "13 Apr 2026"
)
_LINE_DEBIT_RE = re.compile(r"debit|dr\.?\b|withdrawal|paid|sent|debited|spent", re.I)
_LINE_CREDIT_RE = re.compile(r"credit|cr\.?\b|deposit|received|credited|refund|cashback|salary", re.I)


def _parse_pdf_text_lines(text: str) -> list[ParsedTransaction]:
    """Fallback: parse transactions from raw PDF text lines."""
    transactions = []

    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue

        date_match = _LINE_DATE_RE.search(line)
        amount_match = _LINE_AMOUNT_RE.search(line)

        if not date_match or not amount_match:
            continue

        date_val = parse_date(date_match.group(1))
        # Get amount from either the currency-prefixed group or the bare number group
        amount_str = amount_match.group(1) or amount_match.group(2)
        amount = parse_amount(amount_str) if amount_str else None

        if not date_val or not amount or amount <= 0:
            continue

        # Skip lines that look like balance summaries or headers
        skip_patterns = re.compile(r"opening\s*balance|closing\s*balance|total|statement|page\s*\d|account\s*summary", re.I)
        if skip_patterns.search(line):
            continue

        if _LINE_CREDIT_RE.search(line):
            txn_type = "credit"
        elif _LINE_DEBIT_RE.search(line):
            txn_type = "debit"
        else:
            txn_type = "debit"  # Default

        dedup = generate_dedup_hash(amount, date_val, None, line[:100])

        transactions.append(ParsedTransaction(
            amount=amount,
            transaction_type=txn_type,
            date=date_val,
            description=line[:200],
            dedup_hash=dedup,
        ))

    logger.debug("PDF text fallback: found %d transactions in %d lines", len(transactions), len(text.split("\n")))
    return transactions
