"""
BNPL invoice parser router.

POST /api/bnpl/parse-invoice
  - Accepts 1-2 files (order invoice + optional EMI confirmation)
  - Returns structured JSON for auto-filling the purchase form
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from core.auth import get_current_user
from services.bnpl_invoice_parser import parse_invoice, parsed_invoice_to_dict

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bnpl", tags=["BNPL"])

ALLOWED_MIME_TYPES = {"application/pdf", "image/jpeg", "image/jpg", "image/png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _validate_upload(upload: UploadFile, label: str) -> None:
    if upload.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label}: unsupported file type '{upload.content_type}'. Use PDF, JPG, or PNG.",
        )


@router.post("/parse-invoice")
async def parse_bnpl_invoice(
    order_file: UploadFile = File(..., description="Order invoice (PDF/JPG/PNG)"),
    emi_file: Optional[UploadFile] = File(None, description="Optional EMI confirmation"),
    user_id: str = Depends(get_current_user),
):
    """Parse an Amazon Pay Later invoice via Claude Vision and return extracted fields."""
    _validate_upload(order_file, "Order invoice")
    if emi_file is not None and emi_file.filename:
        _validate_upload(emi_file, "EMI confirmation")

    # Read into memory with size limit
    order_bytes = await order_file.read()
    if len(order_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Order invoice exceeds 10 MB limit.",
        )

    emi_tuple = None
    if emi_file is not None and emi_file.filename:
        emi_bytes = await emi_file.read()
        if len(emi_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="EMI confirmation exceeds 10 MB limit.",
            )
        emi_tuple = (emi_bytes, emi_file.content_type)

    logger.info(
        "BNPL parse-invoice: user_id=%s order_size=%d emi_present=%s",
        user_id, len(order_bytes), emi_tuple is not None,
    )

    try:
        parsed = parse_invoice(
            order_file=(order_bytes, order_file.content_type),
            emi_file=emi_tuple,
        )
    except ValueError as e:
        # Expected errors: bad API key, unsupported format, JSON parse fail
        logger.warning("Parse failed (user error): %s", e)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error("Parse failed (server error): %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse invoice. Please fill the form manually.",
        )

    return {
        "success": True,
        "data": parsed_invoice_to_dict(parsed),
    }
