"""Subscription renewal service.

Runs daily to:
1. Find active subscriptions whose next_renewal_date == today
2. Auto-create a business_expenses row (is_auto_generated=true)
3. Advance next_renewal_date by the billing cycle
"""
import logging
from datetime import date, timedelta
from calendar import monthrange

from core.supabase import get_supabase

logger = logging.getLogger("komalfin")


# Map subscription categories to business expense categories
SUBSCRIPTION_TO_EXPENSE_CATEGORY = {
    "ai_tools": "saas_tools",
    "outreach": "saas_tools",
    "email_marketing": "saas_tools",
    "hosting": "domain_hosting",
    "domain": "domain_hosting",
    "design": "saas_tools",
    "analytics": "saas_tools",
    "crm": "saas_tools",
    "communication": "communication",
    "development": "saas_tools",
    "storage": "saas_tools",
    "other": "miscellaneous",
}


def advance_renewal_date(current: date, billing_cycle: str, renewal_day: int) -> date:
    """Advance the renewal date by one billing cycle, handling month-end edge cases."""
    if billing_cycle == "monthly":
        # Next month, same day (clamp to last day if needed)
        new_month = current.month + 1
        new_year = current.year
        if new_month > 12:
            new_month = 1
            new_year += 1
        last_day = monthrange(new_year, new_month)[1]
        return date(new_year, new_month, min(renewal_day, last_day))
    elif billing_cycle == "quarterly":
        # +3 months
        new_month = current.month + 3
        new_year = current.year
        while new_month > 12:
            new_month -= 12
            new_year += 1
        last_day = monthrange(new_year, new_month)[1]
        return date(new_year, new_month, min(renewal_day, last_day))
    elif billing_cycle == "yearly":
        # +1 year (handle Feb 29 → Feb 28)
        try:
            return current.replace(year=current.year + 1)
        except ValueError:
            # Feb 29 on a non-leap year
            return current.replace(year=current.year + 1, day=28)
    else:
        # Unknown cycle — just bump by 30 days as fallback
        return current + timedelta(days=30)


def process_daily_renewals(target_date: date | None = None) -> dict:
    """Process subscription renewals for the given date (default today).

    Returns a summary dict: {processed: N, created_expenses: N, errors: [...]}
    """
    target = target_date or date.today()
    logger.info(f"Processing subscription renewals for {target.isoformat()}")

    sb = get_supabase()
    summary = {"processed": 0, "created_expenses": 0, "errors": []}

    try:
        # Find active subscriptions renewing today
        result = (
            sb.table("business_subscriptions")
            .select("*")
            .eq("status", "active")
            .eq("next_renewal_date", target.isoformat())
            .execute()
        )
        subscriptions = result.data or []
        logger.info(f"Found {len(subscriptions)} subscriptions to renew")

        for sub in subscriptions:
            try:
                # Create auto-generated expense
                expense_payload = {
                    "user_id": sub["user_id"],
                    "amount": sub["cost_amount"],
                    "category": SUBSCRIPTION_TO_EXPENSE_CATEGORY.get(
                        sub["category"], "saas_tools"
                    ),
                    "sub_category": sub["name"],
                    "vendor_name": sub["name"],
                    "subscription_id": sub["id"],
                    "date": target.isoformat(),
                    "funded_from": sub["funded_from"],
                    "is_recurring": True,
                    "recurrence_frequency": sub["billing_cycle"]
                    if sub["billing_cycle"] in ("weekly", "monthly", "quarterly", "yearly")
                    else None,
                    "is_auto_generated": True,
                    "notes": f"Auto-generated from subscription renewal ({sub['billing_cycle']})",
                }
                sb.table("business_expenses").insert(expense_payload).execute()

                # Advance renewal date
                current_renewal = date.fromisoformat(sub["next_renewal_date"])
                new_renewal = advance_renewal_date(
                    current_renewal, sub["billing_cycle"], sub["renewal_day"]
                )
                sb.table("business_subscriptions").update(
                    {"next_renewal_date": new_renewal.isoformat()}
                ).eq("id", sub["id"]).execute()

                summary["processed"] += 1
                summary["created_expenses"] += 1
                logger.info(
                    f"Renewed '{sub['name']}' ({sub['cost_amount']} {sub['cost_currency']}) "
                    f"→ next: {new_renewal.isoformat()}"
                )
            except Exception as e:
                err_msg = f"Failed to renew subscription {sub.get('id')}: {e}"
                logger.error(err_msg)
                summary["errors"].append(err_msg)

    except Exception as e:
        err_msg = f"Subscription renewal job failed: {e}"
        logger.error(err_msg)
        summary["errors"].append(err_msg)

    logger.info(
        f"Renewal job complete: {summary['processed']} processed, "
        f"{summary['created_expenses']} expenses created, "
        f"{len(summary['errors'])} errors"
    )
    return summary


def run_daily_renewal_job():
    """APScheduler entry point — wraps process_daily_renewals with error handling."""
    try:
        process_daily_renewals()
    except Exception as e:
        logger.error(f"Daily renewal job failed: {e}")