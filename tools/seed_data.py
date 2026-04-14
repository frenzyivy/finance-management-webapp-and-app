"""
Insert sample data for development.
Creates sample income, expense, savings, and debt entries.

Usage:
    python seed_data.py

Note: Requires a valid user in Supabase Auth. Set TEST_USER_ID in .env
or this script will print instructions to create one.
"""

import os
from datetime import date, timedelta
from dotenv import load_dotenv
from supabase_client import get_client

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

TEST_USER_ID = os.getenv('TEST_USER_ID')


def seed_income(client, user_id: str):
    """Insert sample income entries."""
    entries = [
        {
            "user_id": user_id,
            "amount": 50000.00,
            "category": "salary",
            "source_name": "TechCorp",
            "date": str(date.today().replace(day=1)),
            "payment_method": "bank_transfer",
            "is_recurring": True,
            "recurrence_frequency": "monthly",
            "notes": "Monthly salary"
        },
        {
            "user_id": user_id,
            "amount": 15000.00,
            "category": "freelance",
            "source_name": "Allianza Biz",
            "date": str(date.today() - timedelta(days=5)),
            "payment_method": "upi",
            "is_recurring": False,
            "notes": "Website project"
        },
        {
            "user_id": user_id,
            "amount": 2500.00,
            "category": "side_income",
            "source_name": "YouTube",
            "date": str(date.today() - timedelta(days=10)),
            "payment_method": "bank_transfer",
            "is_recurring": False,
            "notes": "Ad revenue"
        }
    ]
    result = client.table('income_entries').insert(entries).execute()
    print(f"  Inserted {len(result.data)} income entries")


def seed_expenses(client, user_id: str):
    """Insert sample expense entries."""
    entries = [
        {
            "user_id": user_id,
            "amount": 12000.00,
            "category": "rent",
            "payee_name": "Landlord",
            "date": str(date.today().replace(day=1)),
            "payment_method": "bank_transfer",
            "is_recurring": True,
            "recurrence_frequency": "monthly",
            "is_emi": False
        },
        {
            "user_id": user_id,
            "amount": 3500.00,
            "category": "food_groceries",
            "payee_name": "Swiggy",
            "date": str(date.today() - timedelta(days=2)),
            "payment_method": "upi",
            "is_recurring": False,
            "is_emi": False,
            "notes": "Weekly groceries + dining"
        },
        {
            "user_id": user_id,
            "amount": 999.00,
            "category": "subscriptions",
            "payee_name": "Claude Max",
            "date": str(date.today() - timedelta(days=7)),
            "payment_method": "credit_card",
            "is_recurring": True,
            "recurrence_frequency": "monthly",
            "is_emi": False
        }
    ]
    result = client.table('expense_entries').insert(entries).execute()
    print(f"  Inserted {len(result.data)} expense entries")


def seed_savings_goals(client, user_id: str):
    """Insert sample savings goals."""
    goals = [
        {
            "user_id": user_id,
            "name": "Emergency Fund",
            "target_amount": 100000.00,
            "current_balance": 15000.00,
            "priority": "high",
            "color": "#0d9488",
            "icon": "shield",
            "status": "active"
        },
        {
            "user_id": user_id,
            "name": "Study Fund (GRE + College)",
            "target_amount": 500000.00,
            "current_balance": 25000.00,
            "priority": "high",
            "target_date": str(date.today() + timedelta(days=365)),
            "color": "#f59e0b",
            "icon": "graduation-cap",
            "status": "active"
        }
    ]
    result = client.table('savings_goals').insert(goals).execute()
    print(f"  Inserted {len(result.data)} savings goals")


def seed_debts(client, user_id: str):
    """Insert sample debts."""
    debts = [
        {
            "user_id": user_id,
            "name": "Amazon Pay Later",
            "type": "bnpl",
            "creditor_name": "Amazon",
            "original_amount": 10000.00,
            "outstanding_balance": 6000.00,
            "emi_amount": 2000.00,
            "emi_day_of_month": 15,
            "total_emis": 5,
            "remaining_emis": 3,
            "start_date": str(date.today() - timedelta(days=60)),
            "expected_payoff_date": str(date.today() + timedelta(days=90)),
            "status": "active"
        }
    ]
    result = client.table('debts').insert(debts).execute()
    print(f"  Inserted {len(result.data)} debts")


def main():
    if not TEST_USER_ID:
        print("ERROR: TEST_USER_ID not set in .env")
        print("1. Create a user in Supabase Auth (Dashboard → Authentication → Users)")
        print("2. Copy the user's UUID")
        print("3. Add TEST_USER_ID=<uuid> to your .env file")
        return

    client = get_client()
    print(f"Seeding data for user: {TEST_USER_ID}\n")

    seed_income(client, TEST_USER_ID)
    seed_expenses(client, TEST_USER_ID)
    seed_savings_goals(client, TEST_USER_ID)
    seed_debts(client, TEST_USER_ID)

    print("\nSeeding complete!")


if __name__ == '__main__':
    main()
