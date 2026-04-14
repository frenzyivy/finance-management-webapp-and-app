import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient
from .config import get_settings

logger = logging.getLogger("auth")
security = HTTPBearer()

# Cache one JWKS client per run so we don't fetch the keys on every request.
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        settings = get_settings()
        # Supabase exposes its asymmetric signing keys at /auth/v1/.well-known/jwks.json
        jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Extract and verify user ID from Supabase JWT. Returns user_id string.

    Supports both symmetric (HS256, legacy) and asymmetric (ES256/RS256, current)
    Supabase token formats.
    """
    settings = get_settings()
    token = credentials.credentials

    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "unknown")

        if alg in ("HS256", "HS384", "HS512"):
            # Legacy symmetric token — verify with shared JWT secret
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS256", "HS384", "HS512"],
                audience="authenticated",
            )
        elif alg in ("ES256", "RS256", "EdDSA"):
            # Asymmetric token — fetch the public key from Supabase JWKS
            jwks_client = _get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                audience="authenticated",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Unsupported token algorithm: {alg}",
            )

        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token: no sub claim",
            )
        return user_id

    except jwt.PyJWTError as e:
        logger.error("JWT decode failed: %s: %s", type(e).__name__, e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {e}",
        )
