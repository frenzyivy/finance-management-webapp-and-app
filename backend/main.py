import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from core.config import get_settings
from core.supabase import get_supabase
from routers import health, income, expenses, goals, debts, imports, recurring, bnpl_parser, cc_statements
from routers import business_income, business_expenses, business_subscriptions, business_clients
from services.subscription_renewal import run_daily_renewal_job

logger = logging.getLogger("komalfin")


def run_recurring_generation():
    """Background job: generate recurring entries for today."""
    try:
        sb = get_supabase()
        result = sb.rpc("generate_recurring_entries").execute()
        data = result.data or {}
        count = data.get("entries_created", 0) if isinstance(data, dict) else 0
        logger.info(f"Recurring generation complete: {count} entries created")
    except Exception as e:
        logger.error(f"Recurring generation failed: {e}")


scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run once at startup, then daily at 00:05 IST (18:35 UTC previous day)
    scheduler.add_job(run_recurring_generation, "cron", hour=18, minute=35, id="daily_recurring")
    # Also run immediately on startup to catch up
    scheduler.add_job(run_recurring_generation, id="startup_recurring")
    # Subscription renewals: daily at 08:00 IST (02:30 UTC)
    scheduler.add_job(run_daily_renewal_job, "cron", hour=2, minute=30, id="daily_subscription_renewal")
    # Also run on startup to catch up on any missed renewals
    scheduler.add_job(run_daily_renewal_job, id="startup_subscription_renewal")
    scheduler.start()
    logger.info("Schedulers started: recurring entries (00:05 IST), subscription renewals (08:00 IST)")
    yield
    scheduler.shutdown()


app = FastAPI(
    title="KomalFin API",
    description="Personal Finance Management API",
    version="0.1.0",
    lifespan=lifespan,
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(income.router, prefix="/api")
app.include_router(expenses.router, prefix="/api")
app.include_router(goals.router, prefix="/api")
app.include_router(debts.router, prefix="/api")
app.include_router(imports.router, prefix="/api")
app.include_router(recurring.router, prefix="/api")
app.include_router(business_income.router, prefix="/api")
app.include_router(business_expenses.router, prefix="/api")
app.include_router(business_subscriptions.router, prefix="/api")
app.include_router(business_clients.router, prefix="/api")
app.include_router(bnpl_parser.router, prefix="/api")
app.include_router(cc_statements.router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.backend_port, reload=True)
