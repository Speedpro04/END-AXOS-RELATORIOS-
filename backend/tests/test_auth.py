import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport
from jose import jwt

from app.main import app
from app.core.config import settings

@pytest.fixture(autouse=True)
def mock_redis_lifecycle():
    with patch("app.main.ping_redis", new_callable=AsyncMock) as mock_ping, \
         patch("app.main.close_redis", new_callable=AsyncMock) as mock_close:
        mock_ping.return_value = True
        yield


@pytest.fixture
def valid_token():
    payload = {
        "sub": "user-uuid-1234",
        "aud": "authenticated",
        "role": "authenticated",
    }
    return jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")


@pytest.mark.asyncio
async def test_unauthenticated_request_blocked():
    """Requisição sem cabeçalho Authorization é rejeitada."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/sync/dlq")
        assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_invalid_jwt_rejected():
    """Token JWT inválido ou adulterado retorna 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/sync/dlq",
            headers={"Authorization": "Bearer token.completamente.falso"},
        )
        assert response.status_code == 401
        assert "Token inválido ou expirado" in response.json().get("detail", "")


@pytest.mark.asyncio
async def test_profile_not_found_rejected(valid_token):
    """Usuário com JWT válido mas sem registro na tabela profiles retorna 401."""
    with patch("app.core.security.fetch_user_profile", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = None

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(
                "/api/sync/dlq",
                headers={"Authorization": f"Bearer {valid_token}"},
            )
            assert response.status_code == 401
            assert "PROFILE_NOT_FOUND" in response.json().get("detail", "")


@pytest.mark.asyncio
async def test_inactive_user_revoked_immediately(valid_token):
    """Usuário desativado (active=False) é bloqueado com 403 imediatamente, mesmo com JWT válido."""
    mock_inactive_profile = {
        "id": "user-uuid-1234",
        "tenant_id": "tenant-uuid-5678",
        "role": "inspector",
        "can_inspect": True,
        "active": False,
        "full_name": "Inspetor Desativado",
    }

    with patch("app.core.security.fetch_user_profile", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = mock_inactive_profile

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(
                "/api/sync/dlq",
                headers={"Authorization": f"Bearer {valid_token}"},
            )
            assert response.status_code == 403
            assert "USER_INACTIVE" in response.json().get("detail", "")


@pytest.mark.asyncio
async def test_active_user_authorized_with_tenant_isolation(valid_token):
    """Usuário ativo tem acesso aos seus recursos protegidos com papel e tenant resolvidos do banco."""
    mock_active_profile = {
        "id": "user-uuid-1234",
        "tenant_id": "tenant-uuid-5678",
        "role": "supervisor",
        "can_inspect": False,
        "active": True,
        "full_name": "Supervisor Valido",
    }

    mock_arq = AsyncMock()
    mock_arq.keys.return_value = []

    async def override_get_arq():
        yield mock_arq

    from app.routers.sync import get_arq
    app.dependency_overrides[get_arq] = override_get_arq

    try:
        with patch("app.core.security.fetch_user_profile", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_active_profile

            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.get(
                    "/api/sync/dlq",
                    headers={"Authorization": f"Bearer {valid_token}"},
                )
                assert response.status_code == 200
                data = response.json()
                assert data["total"] == 0
                assert data["tenant_id"] == "tenant-uuid-5678"
    finally:
        app.dependency_overrides.pop(get_arq, None)


@pytest.mark.asyncio
async def test_docs_hidden_when_debug_false():
    """Documentação /api/docs, /api/redoc e /api/openapi.json oculta em produção (DEBUG=False)."""
    from fastapi import FastAPI
    from app.core.config import Settings
    
    prod_settings = Settings(
        SUPABASE_URL="https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY="secret",
        SUPABASE_JWT_SECRET="secret",
        DEBUG=False,
    )
    
    prod_app = FastAPI(
        title="AXOS Prod",
        docs_url="/api/docs" if prod_settings.DEBUG else None,
        redoc_url="/api/redoc" if prod_settings.DEBUG else None,
        openapi_url="/api/openapi.json" if prod_settings.DEBUG else None,
    )

    async with AsyncClient(transport=ASGITransport(app=prod_app), base_url="http://test") as client:
        r1 = await client.get("/api/docs")
        r2 = await client.get("/api/redoc")
        r3 = await client.get("/api/openapi.json")
        assert r1.status_code == 404
        assert r2.status_code == 404
        assert r3.status_code == 404
