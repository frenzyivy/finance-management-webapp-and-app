"""
Shared Supabase client initialization.
Loads credentials from .env and returns an initialized Supabase client.
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')


def get_client() -> Client:
    """Get an initialized Supabase client using service role key."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ValueError(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file. "
            "Copy .env.example to .env and fill in your credentials."
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


if __name__ == '__main__':
    client = get_client()
    print(f"Connected to Supabase at {SUPABASE_URL}")
