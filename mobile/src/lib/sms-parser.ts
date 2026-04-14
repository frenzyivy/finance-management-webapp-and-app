/**
 * SMS Parser for Indian bank transaction messages.
 * Extracts maximum data from bank SMS: amount, type, date, account numbers,
 * UPI remarks, merchant names, VPA, reference numbers, payment mode, etc.
 * All parsing happens client-side — no raw SMS is sent to any server.
 */

export interface ParsedSmsTransaction {
  rawText: string;
  amount: number;
  type: "debit" | "credit";
  date: string; // ISO format YYYY-MM-DD
  reference: string | null;
  accountHint: string | null; // last digits of YOUR account
  recipientAccount: string | null; // last digits of recipient/sender account
  description: string | null; // best extracted payee/remark
  upiId: string | null; // VPA like merchant@upi
  upiRemark: string | null; // UPI remark/note the user typed
  merchantName: string | null; // extracted merchant/payee name
  paymentMode: string | null; // UPI, NEFT, IMPS, RTGS, ATM, POS, etc.
  bankName: string | null; // which bank sent the SMS
  confidence: number; // 0-1
}

// ── Bank SMS Sender ID Patterns ──

const BANK_SENDER_MAP: [RegExp, string][] = [
  [/SBIBNK|SBIPSG|SBISMA|SBIINB|SBIATM/i, "SBI"],
  [/HDFCBK|HDFCBN/i, "HDFC"],
  [/ICICIB|ICICBA/i, "ICICI"],
  [/AXISBK|AXISBN/i, "Axis"],
  [/KOTAKB|KOTKBK/i, "Kotak"],
  [/BOIIND/i, "BOI"],
  [/BOBTXN|BOBSMS|BOBSMA|BOBIND/i, "BOB"],
  [/CANBNK/i, "Canara"],
  [/CENTBK/i, "Central Bank"],
  [/PNBSMS|PUNBNK/i, "PNB"],
  [/IABORB/i, "Indian Bank"],
  [/INDBNK/i, "IndusInd"],
  [/UCOBNK/i, "UCO"],
  [/YESBNK/i, "Yes Bank"],
  [/FEDERL/i, "Federal"],
  [/IDFCBK/i, "IDFC First"],
  [/PAYTMB/i, "Paytm Payments Bank"],
  [/AIRBNK/i, "Airtel Payments Bank"],
  [/JUPBNK/i, "Jupiter"],
  [/FIBNK/i, "Fi"],
  [/SCBNIN/i, "Standard Chartered"],
  [/CITIBK/i, "Citi"],
  [/DBS/i, "DBS"],
  [/RBLBNK/i, "RBL"],
  [/AUSFIN/i, "AU Small Finance"],
];

const BANK_GENERIC_PATTERNS = [
  /\w{2}BANK/i,
  /\w{2}BNK/i,
  /BOB/i,
  /SBI/i,
  /HDFC/i,
  /ICICI/i,
  /AXIS/i,
  /KOTAK/i,
  /PNB/i,
  /YES/i,
  /IDFC/i,
  /RBL/i,
  /UCO/i,
  /CITI/i,
  /PAYTM/i,
  /PHONEPE|PHPE/i,
  /GPAY|GOOGLE\s*PAY/i,
  /BHIM/i,
  /AMZNPA|AMAZON/i,
  /FREECHRG|MOBIKWIK|SIMPL|SLICE|CRED/i,
];

export function isBankSms(sender: string, body?: string): boolean {
  if (BANK_SENDER_MAP.some(([p]) => p.test(sender))) return true;
  if (BANK_GENERIC_PATTERNS.some((p) => p.test(sender))) return true;
  // Content-based fallback: if the body has a currency amount AND a clear
  // debit/credit keyword, treat it as a candidate transaction regardless of sender.
  // parseSms() will still reject it if amount/type can't be extracted.
  if (body) {
    const hasAmount = /(?:Rs\.?|INR|₹)\s*[\d,]+/i.test(body);
    const hasTxnKeyword =
      /\b(?:debited|credited|deducted|withdrawn|spent|paid|received|deposited|transferred|Dr\.?|Cr\.?)\b/i.test(
        body,
      );
    const hasAccountHint = /(?:A\/c|a\/c|account|acct|card)\s*(?:no\.?\s*)?(?:XX|xx|X{2,}|x{2,}|\*{2,}|\d)/i.test(body);
    if (hasAmount && hasTxnKeyword && hasAccountHint) return true;
  }
  return false;
}

function detectBank(sender: string): string | null {
  for (const [pattern, name] of BANK_SENDER_MAP) {
    if (pattern.test(sender)) return name;
  }
  return null;
}

// ── Amount Extraction ──

const AMOUNT_PATTERNS = [
  // "Rs.500.00" or "Rs 1,500.00" or "INR 500" or "₹500"
  /(?:Rs\.?\s*|INR\.?\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)/i,
  // "500.00 Rs" (reverse — less common)
  /([\d,]+\.\d{2})\s*(?:Rs\.?|INR|₹)/i,
  // "debited by Rs 500" — require currency marker after keyword
  /(?:debited|credited|withdrawn|deposited|received|sent|paid|transferred)\s+(?:by|with|of|for)\s+(?:Rs\.?\s*|INR\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)/i,
  // "amt: 500.00" or "amount Rs 500"
  /(?:amt|amount)[\s.:]*(?:Rs\.?\s*|INR\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)/i,
];

function extractAmount(text: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const cleaned = match[1].replace(/,/g, "");
      const num = parseFloat(cleaned);
      if (num > 0 && num < 100_000_000) return num;
    }
  }
  return null;
}

// ── Transaction Type Detection ──

const DEBIT_KEYWORDS =
  /\b(?:debited|deducted|withdrawn|spent|paid|purchase|sent|transferred|debit|payment|outgoing|charged|Dr\.?)\b/i;
const CREDIT_KEYWORDS =
  /\b(?:credited|received|deposited|refund|cashback|added|credit|reversed|incoming|settled|Cr\.?)\b/i;

function extractType(text: string): "debit" | "credit" | null {
  const hasDebit = DEBIT_KEYWORDS.test(text);
  const hasCredit = CREDIT_KEYWORDS.test(text);

  if (hasDebit && !hasCredit) return "debit";
  if (hasCredit && !hasDebit) return "credit";
  if (hasDebit && hasCredit) {
    const debitIdx = text.search(DEBIT_KEYWORDS);
    const creditIdx = text.search(CREDIT_KEYWORDS);
    return debitIdx < creditIdx ? "debit" : "credit";
  }
  return null;
}

// ── Account Number Extraction ──

const OWN_ACCOUNT_PATTERNS = [
  // "A/c XX1234" or "account **1234" or "A/c no. XX5678"
  /(?:A\/c|a\/c|account|acct|AC|A\/C)\s*(?:no\.?\s*)?(?:XX|xx|X{2,}|x{2,}|\*{2,})(\d{3,6})/i,
  // "from XX1234" (your account)
  /(?:from\s+)(?:A\/c\s*)?(?:XX|xx|\*{2,})(\d{4,6})\b/i,
  // Standalone XX1234 at start of typical patterns
  /(?:XX|xx|\*{2,})(\d{4,6})\b/,
];

const RECIPIENT_ACCOUNT_PATTERNS = [
  // "to A/c XX9876" or "to account **9876"
  /(?:to\s+)(?:A\/c\s*)?(?:XX|xx|\*{2,})(\d{4,6})\b/i,
  // "beneficiary A/c 9876"
  /(?:beneficiary|payee)\s*(?:A\/c\s*)?(?:XX|xx|\*{2,})?(\d{4,6})\b/i,
];

function extractAccountHint(text: string): string | null {
  for (const pattern of OWN_ACCOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractRecipientAccount(text: string): string | null {
  for (const pattern of RECIPIENT_ACCOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  // If there are multiple XX patterns, the second one is likely the recipient
  const allAccounts = [...text.matchAll(/(?:XX|xx|\*{2,})(\d{4,6})/g)];
  if (allAccounts.length >= 2) return allAccounts[1][1];
  return null;
}

// ── Date Extraction ──

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Date patterns that require a date-like context keyword nearby
// This prevents matching random numbers (ref IDs, amounts) as dates
const DATE_CONTEXT_KEYWORDS = /(?:on|dated|date|dt)\s*/i;

const DATE_PATTERNS_WITH_CONTEXT = [
  // "on 13/04/2026" or "dated 13-04-2026" or "on 13.04.26"
  { pattern: /(?:on|dated|date|dt)[\s.:]*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i, hasContext: true },
  // "on 13-Apr-2026" or "on 13 Apr 26"
  { pattern: /(?:on|dated|date|dt)[\s.:]*(\d{1,2})[\/\-.\s]([A-Za-z]{3})[\/\-.\s](\d{2,4})/i, hasContext: true },
];

const DATE_PATTERNS_STANDALONE = [
  // DD/MM/YYYY — only match if 4-digit year (stricter)
  { pattern: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/, hasContext: false },
  // DD-Mon-YYYY or DD-Mon-YY
  { pattern: /\b(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{2,4})\b/, hasContext: false },
  // DD Mon YYYY
  { pattern: /\b(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})\b/, hasContext: false },
  // DD/MM/YY — only 2-digit year, lower priority
  { pattern: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})\b/, hasContext: false },
];

function parseDateParts(part1: string, part2: string, part3: string): Date | null {
  let day: number;
  let month: number;
  let year: number;

  // YYYY-MM-DD format (part1 > 1000)
  if (parseInt(part1, 10) > 1000) {
    year = parseInt(part1, 10);
    month = parseInt(part2, 10) - 1;
    day = parseInt(part3, 10);
  } else {
    const monthName = part2.toLowerCase();
    if (MONTH_MAP[monthName] !== undefined) {
      day = parseInt(part1, 10);
      month = MONTH_MAP[monthName];
      year = parseInt(part3, 10);
    } else {
      day = parseInt(part1, 10);
      month = parseInt(part2, 10) - 1;
      year = parseInt(part3, 10);
    }
  }

  if (year < 100) year += year < 50 ? 2000 : 1900;

  if (day < 1 || day > 31 || month < 0 || month > 11 || year < 2000) return null;

  const d = new Date(year, month, day);
  // Validate the date is real (e.g., Feb 30 would shift to March)
  if (d.getDate() !== day || d.getMonth() !== month) return null;

  return d;
}

function extractDate(text: string, smsDate: Date): string {
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today

  // Try context patterns first (higher confidence)
  const allPatterns = [...DATE_PATTERNS_WITH_CONTEXT, ...DATE_PATTERNS_STANDALONE];

  for (const { pattern } of allPatterns) {
    const match = text.match(pattern);
    if (!match) continue;

    // match[1], match[2], match[3] are the date parts
    // But for context patterns, the groups are offset
    const groups = match.slice(1);
    if (groups.length < 3) continue;

    const d = parseDateParts(groups[0], groups[1], groups[2]);
    if (!d) continue;

    // REJECT future dates — a transaction can't be in the future
    if (d > today) continue;

    // REJECT dates too far in the past (> 1 year) — likely a mis-parse
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (d < oneYearAgo) continue;

    return d.toISOString().split("T")[0];
  }

  // Fallback: use the SMS received date (always correct)
  return smsDate.toISOString().split("T")[0];
}

// ── UPI ID / VPA Extraction ──

const UPI_ID_PATTERNS = [
  /(?:VPA|vpa|UPI\s*ID)[\s.:]*([a-zA-Z0-9._\-]+@[a-zA-Z0-9._\-]+)/i,
  /(?:to|from|payee)\s+([a-zA-Z0-9._\-]+@[a-z]{2,})/i,
  // Standalone UPI ID pattern
  /\b([a-zA-Z0-9._\-]{3,}@(?:upi|ybl|okhdfcbank|okaxis|oksbi|okicici|paytm|apl|axl|ibl|sbi|icici|hdfcbank|axisbank|kotak|indus|federal|rbl|yesbank|aubank|dbs|jupiteraxis))\b/i,
];

function extractUpiId(text: string): string | null {
  for (const pattern of UPI_ID_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

// ── UPI Remark Extraction ──

const UPI_REMARK_PATTERNS = [
  // "Remarks: grocery shopping" or "Rem: food" — these are explicit remark fields
  /(?:Remarks?|Remark|Narration)[\s.:]+(.{3,60}?)(?:\s*(?:Ref|UPI|IMPS|NEFT|\.|$))/i,
  // "Note: some text"
  /\bNote[\s.:]+(.{3,50}?)(?:\s*(?:Ref|UPI|\.|$))/i,
  // "Info: some description"
  /\bInfo[\s.:]+(.{3,50}?)(?:\.|$)/i,
];

function extractUpiRemark(text: string): string | null {
  for (const pattern of UPI_REMARK_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const remark = match[1].trim();
      // Filter out things that look like references, not remarks
      if (/^\d{8,}$/.test(remark)) continue;
      if (remark.length < 3) continue;
      return remark;
    }
  }
  return null;
}

// ── Payment Mode Extraction ──

const PAYMENT_MODE_PATTERNS: [RegExp, string][] = [
  [/\bUPI\b/i, "UPI"],
  [/\bIMPS\b/i, "IMPS"],
  [/\bNEFT\b/i, "NEFT"],
  [/\bRTGS\b/i, "RTGS"],
  [/\bATM\b/i, "ATM"],
  [/\bPOS\b/i, "POS"],
  [/\bNB\b|net\s*banking/i, "Net Banking"],
  [/\bECS\b/i, "ECS"],
  [/\bACH\b/i, "ACH"],
  [/\bCHQ\b|cheque|check/i, "Cheque"],
  [/\bauto.?debit\b/i, "Auto Debit"],
  [/\bEMI\b/i, "EMI"],
  [/\bSI\b|standing instruction/i, "Standing Instruction"],
];

function extractPaymentMode(text: string): string | null {
  for (const [pattern, mode] of PAYMENT_MODE_PATTERNS) {
    if (pattern.test(text)) return mode;
  }
  return null;
}

// ── Reference Extraction ──

const REFERENCE_PATTERNS = [
  /(?:UPI\s*(?:Ref|ref|REF)[\s.:]*)([\w\-]+)/i,
  /(?:Ref\s*(?:No|no)?[\s.:]*|Txn\s*(?:ID|Id|id)?[\s.:]*|IMPS\s*Ref[\s.:]*)([\w\-]+)/i,
  /(?:NEFT|RTGS|IMPS)[\s/:]*(\w{10,})/i,
  /(?:UTR|utr)[\s.:]*(\w{10,})/i,
  /(?:RRN|rrn)[\s.:]*(\d{10,})/i,
  /(?:Transaction\s*(?:ID|Id|id|no))[\s.:]*(\w{6,})/i,
];

function extractReference(text: string): string | null {
  for (const pattern of REFERENCE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ── Merchant / Payee Name Extraction ──

const MERCHANT_PATTERNS = [
  // "paid to NAME" or "sent to NAME" or "transferred to NAME" — explicit payment context
  /(?:paid\s+to|sent\s+to|transferred\s+to)\s+([A-Za-z][A-Za-z0-9\s.&'\-]{2,30}?)(?:\s+(?:on|ref|upi|vpa|via|for|Rs|INR|₹|\d{1,2}[\/\-]))/i,
  // "received from NAME" (credits)
  /(?:received\s+from|credited\s+from)\s+([A-Za-z][A-Za-z0-9\s.&'\-]{2,30}?)(?:\s+(?:on|ref|upi|vpa|via|Rs|INR|₹|\d{1,2}[\/\-]))/i,
  // "at MERCHANT" (POS transactions)
  /\bat\s+([A-Za-z][A-Za-z0-9\s.&'\-]{2,30}?)(?:\s+(?:on|ref|Rs|INR|₹|\d{1,2}[\/\-]))/i,
  // VPA-based: extract name before @ as merchant hint
  /(?:VPA|vpa)[\s.:]*([a-zA-Z0-9._]{3,})@/i,
  // "towards NAME" — explicit
  /\btowards\s+([A-Za-z][A-Za-z0-9\s.&'\-]{2,30}?)(?:\s*(?:\.|$|on|ref|Rs|INR))/i,
];

// Words that are NOT merchant names — common SMS filler words
const MERCHANT_BLACKLIST = /^(?:your|the|this|that|a|an|bank|account|acct|card|debit|credit|transaction|balance|available|avl|bal|is|was|has|been|from|with|for)\b/i;

function extractMerchantName(text: string): string | null {
  for (const pattern of MERCHANT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      let name = match[1].trim();
      name = name.replace(/[.\s]+$/, "");
      // Reject if it's just numbers, too short, or a common filler word
      if (/^\d+$/.test(name) || name.length < 2) continue;
      if (MERCHANT_BLACKLIST.test(name)) continue;
      return name;
    }
  }
  return null;
}

// ── Build Best Description ──

function buildDescription(
  merchantName: string | null,
  upiRemark: string | null,
  upiId: string | null,
  reference: string | null,
): string | null {
  const parts: string[] = [];

  if (merchantName) parts.push(merchantName);
  if (upiRemark && upiRemark !== merchantName) parts.push(`(${upiRemark})`);
  if (!merchantName && upiId) {
    // Extract readable name from UPI ID: "shopname@upi" -> "shopname"
    const upiName = upiId.split("@")[0].replace(/[._\-]/g, " ");
    if (upiName.length >= 3) parts.push(upiName);
  }

  if (parts.length > 0) return parts.join(" ");

  // Last resort: use reference
  if (reference) return `Ref: ${reference}`;
  return null;
}

// ── Main Parser ──

export function parseSms(
  smsBody: string,
  smsDate: Date,
  smsSender?: string,
): ParsedSmsTransaction | null {
  const amount = extractAmount(smsBody);
  const type = extractType(smsBody);

  if (!amount || !type) return null;

  const date = extractDate(smsBody, smsDate);
  const reference = extractReference(smsBody);
  const accountHint = extractAccountHint(smsBody);
  const recipientAccount = extractRecipientAccount(smsBody);
  const upiId = extractUpiId(smsBody);
  const upiRemark = extractUpiRemark(smsBody);
  const merchantName = extractMerchantName(smsBody);
  const paymentMode = extractPaymentMode(smsBody);
  const bankName = smsSender ? detectBank(smsSender) : null;

  const description = buildDescription(merchantName, upiRemark, upiId, reference);

  // Confidence scoring
  let confidence = 0.5;
  if (reference) confidence += 0.1;
  if (accountHint) confidence += 0.1;
  if (upiId) confidence += 0.1;
  if (merchantName) confidence += 0.1;
  if (upiRemark) confidence += 0.05;
  if (paymentMode) confidence += 0.05;
  if (date !== smsDate.toISOString().split("T")[0]) confidence += 0.05;

  return {
    rawText: smsBody,
    amount,
    type,
    date,
    reference,
    accountHint,
    recipientAccount,
    description,
    upiId,
    upiRemark,
    merchantName,
    paymentMode,
    bankName,
    confidence: Math.min(confidence, 1),
  };
}

/**
 * Generate a dedup hash for a parsed transaction.
 * Uses amount + date + reference + account for uniqueness.
 */
export function generateDedupHash(
  amount: number,
  date: string,
  reference: string | null,
  accountHint: string | null
): string {
  return `${amount.toFixed(2)}|${date}|${reference ?? ""}|${accountHint ?? ""}`;
}
