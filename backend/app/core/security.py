"""
Segurança: tenant_id e papel SEMPRE do app_metadata do JWT.
Nunca do user_metadata (editável pelo usuário).
"""
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from app.core.config import settings

bearer = HTTPBearer()


class CurrentUser:
    def __init__(self, user_id: str, empresa_id: str, papel: str):
        self.user_id = user_id
        self.empresa_id = empresa_id
        self.papel = papel  # inspetor | supervisor | admin

    @property
    def is_inspetor(self) -> bool:
        return self.papel == "inspetor"

    @property
    def is_supervisor(self) -> bool:
        return self.papel in ("supervisor", "admin")

    @property
    def is_admin(self) -> bool:
        return self.papel == "admin"


def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
) -> CurrentUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            creds.credentials,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        # CRÍTICO: usar app_metadata, nunca user_metadata
        app_meta = payload.get("app_metadata", {})
        user_id: str = payload.get("sub", "")
        empresa_id: str = app_meta.get("empresa_id", "")
        papel: str = app_meta.get("papel", "")

        if not user_id or not empresa_id or not papel:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    return CurrentUser(user_id=user_id, empresa_id=empresa_id, papel=papel)


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
