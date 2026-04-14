from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from dotenv import load_dotenv

_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
_ROOT_DIR = os.path.abspath(os.path.join(_BACKEND_DIR, '..'))

for _env_path in (os.path.join(_BACKEND_DIR, '.env'), os.path.join(_ROOT_DIR, '.env')):
    if os.path.exists(_env_path):
        load_dotenv(_env_path)
        break

class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_anon_key: str = ""
    jwt_secret: str = ""
    backend_port: int = 8000
    cors_origins: str = "http://localhost:3000,http://localhost:8081"
    anthropic_api_key: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

@lru_cache()
def get_settings() -> Settings:
    return Settings()
