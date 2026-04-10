from supabase import create_client, Client
from .config import get_settings

def get_supabase() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return create_client(settings.supabase_url, settings.supabase_service_key)
