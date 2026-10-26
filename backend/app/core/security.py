"""
Segurança: Papel e tenant_id lidos da tabela profiles (PostgreSQL/Supabase).
Validação de JWT e verificação de usuário ativo com efeito imediato.
"""
from typing import Annotated, Optional
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from app.core.config import settings

bearer = HTTPBearer(auto_error=True)


class CurrentUser:
    def __init__(
        self,
        user_id: str,
        tenant_id: str,
        role: str,
        can_inspect: bool = False,
        full_name: str = "",
        active: bool = True,
    ):
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.role = role  # admin | supervisor | inspector
        self.can_inspect = can_inspect
        self.full_name = full_name
        self.active = active

    @property
    def is_inspector(self) -> bool:
        return self.role == "inspector" or self.can_inspect

    @property
    def is_reviewer(self) -> bool:
        return self.role in ("supervisor", "admin")

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


async def fetch_user_profile(user_id: str) -> Optional[dict]:
    """Consulta a tabela profiles no Supabase via REST API autenticada com service_role."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None

    url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/profiles"
    params = {
        "id": f"eq.{user_id}",
        "select": "id,tenant_id,role,can_inspect,active,full_name",
    }
    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
    }

    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.get(url, params=params, headers=headers)
            if resp.status_code == 200:
                rows = resp.json()
                return rows[0] if rows else None
            return None
        except httpx.RequestError:
            return None


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
) -> CurrentUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = creds.credentials

    try:
        # Decodifica JWT do Supabase Auth
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        user_id: str = payload.get("sub", "")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Fonte única do papel: tabela profiles
    profile = await fetch_user_profile(user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="PROFILE_NOT_FOUND: Perfil do usuário não encontrado no sistema",
        )

    # Regra: desativação tem efeito imediato sem aguardar expiração do JWT
    if not profile.get("active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="USER_INACTIVE: Usuário desativado. Acesso revogado imediatamente.",
        )

    return CurrentUser(
        user_id=profile["id"],
        tenant_id=profile["tenant_id"],
        role=profile["role"],
        can_inspect=profile.get("can_inspect", False),
        full_name=profile.get("full_name", ""),
        active=profile.get("active", True),
    )


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
