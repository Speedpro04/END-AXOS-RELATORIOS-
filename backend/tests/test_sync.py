import pytest
from unittest.mock import patch, AsyncMock, MagicMock
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


# ---------------------------------------------------------------------------
# Usuários mockados
# ---------------------------------------------------------------------------
INSPECTOR_PROFILE = {
    "id": "user-uuid-inspector",
    "tenant_id": "tenant-uuid-5678",
    "role": "inspector",
    "can_inspect": True,
    "active": True,
    "full_name": "Inspetor",
}

SUPERVISOR_PROFILE = {
    "id": "user-uuid-supervisor",
    "tenant_id": "tenant-uuid-5678",
    "role": "supervisor",
    "can_inspect": False,
    "active": True,
    "full_name": "Supervisor",
}


def make_token(sub: str, role: str = "authenticated", aud: str = "authenticated") -> str:
    payload = {"sub": sub, "aud": aud, "role": role}
    return jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")


@pytest.fixture
def inspector_token():
    return make_token("user-uuid-inspector")


@pytest.fixture
def supervisor_token():
    return make_token("user-uuid-supervisor")


@pytest.fixture
def wrong_audience_token():
    return make_token("user-uuid-wrong", aud="wrong-audience")


# ---------------------------------------------------------------------------
# Mock do cliente Supabase (síncrono, como o cliente real)
# ---------------------------------------------------------------------------
class MockSupabaseTable:
    def __init__(self, table_name, data_store):
        self.table_name = table_name
        self.data_store = data_store
        self._filters = []
        self._limit_count = None
        self._pending_insert = None
        self._pending_update = None
        self._pending_eq_filters = []

    def select(self, cols="*"):
        self._pending_insert = None
        self._pending_update = None
        return self

    def eq(self, col, val):
        self._filters.append((col, val))
        return self

    def is_(self, col, val):
        self._filters.append((col, val))
        return self

    def single(self):
        return self

    def insert(self, data):
        self._pending_insert = dict(data)
        self._pending_update = None
        self._filters = []
        return self

    def update(self, data):
        self._pending_update = dict(data)
        self._pending_insert = None
        self._pending_eq_filters = list(self._filters)
        self._filters = []
        return self

    def execute(self):
        store = self.data_store.setdefault(self.table_name, [])

        if self._pending_insert is not None:
            # Simula restrição de unicidade de code em work_orders
            if self.table_name == "work_orders" and "code" in self._pending_insert:
                for row in store:
                    if row.get("tenant_id") == self._pending_insert.get("tenant_id") and row.get("code") == self._pending_insert["code"]:
                        raise Exception("duplicate key value violates unique constraint")
            store.append(self._pending_insert)
            result = [dict(self._pending_insert)]
            self._pending_insert = None
            return MagicMock(data=result)

        if self._pending_update is not None:
            updated = []
            for row in store:
                if all(row.get(col) == val for col, val in self._pending_eq_filters):
                    row.update(self._pending_update)
                    updated.append(dict(row))
            self._pending_update = None
            self._pending_eq_filters = []
            return MagicMock(data=updated)

        # Select
        results = []
        for row in store:
            if all(row.get(col) == val for col, val in self._filters):
                results.append(row)
        if self._limit_count:
            results = results[: self._limit_count]
        return MagicMock(data=results)


class MockSupabaseClient:
    def __init__(self, data_store):
        self.data_store = data_store

    def table(self, name):
        return MockSupabaseTable(name, self.data_store)

    def storage(self):
        return MockStorage()


class MockStorage:
    def from_(self, bucket):
        return self

    async def download(self, path):
        return None

    def upload(self, path, data, file_options=None):
        return MagicMock()


def make_mock_supabase():
    store = {
        "tenants": [
            {
                "id": "tenant-uuid-5678",
                "legal_name": "Tenant Teste",
                "trade_name": "Tenant Teste",
                "cnpj": "11.222.333/0001-44",
                "report_prefix": "END",
                "allow_field_creation": True,
            }
        ],
        "profiles": [INSPECTOR_PROFILE, SUPERVISOR_PROFILE],
        "clients": [],
        "sites": [],
        "work_orders": [],
        "reports": [],
        "report_templates": [
            {
                "id": "template-uuid-lp",
                "tenant_id": "tenant-uuid-5678",
                "method": "LP",
                "name": "Líquido Penetrante",
                "version": 1,
                "published": True,
            },
        ],
        "report_number_counters": [],
        "report_pdfs": [],
    }
    return MockSupabaseClient(store)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def mock_supabase():
    return make_mock_supabase()


@pytest.fixture
def client(mock_supabase):
    """Expõe o data_store para os testes manipularem."""
    return mock_supabase.data_store


@pytest.fixture
def http_client(mock_supabase, inspector_token):
    """Cliente HTTP com o Supabase mockado e o perfil do inspector."""
    from app.routers import sync as sync_mod
    sync_mod._supabase_user_client = lambda token: mock_supabase

    async def mock_fetch_profile(user_id: str):
        if user_id == "user-uuid-inspector":
            return INSPECTOR_PROFILE
        if user_id == "user-uuid-supervisor":
            return SUPERVISOR_PROFILE
        return None

    with patch("app.core.security.fetch_user_profile", new=mock_fetch_profile):
        yield AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ---------------------------------------------------------------------------
# (g) JWT com audiência errada é recusado
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_wrong_audience_rejected(wrong_audience_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/sync/reports",
            headers={"Authorization": f"Bearer {wrong_audience_token}"},
            json={"items": []},
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# (b) Payload não consegue definir tenant, inspetor, status ou número
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_payload_cannot_set_server_fields(http_client, client, inspector_token):
    """O servidor ignora/sobrescreve tenant_id, inspector_id, status e número vindos do cliente."""
    client["work_orders"].append({
        "id": "work-order-uuid-001",
        "tenant_id": "tenant-uuid-5678",
        "client_id": "client-uuid-001",
        "code": "OS-001",
    })

    items = [{
        "client_id": "client-uuid-001",
        "client_revision": 1,
        "method": "LP",
        "work_order_id": "work-order-uuid-001",
        "equipment_tag": "TAG-001",
        "inspection_date": "2026-10-21",
        "technical_data": {},
        "administrative_data": {},
        "submit": False,
        "tenant_id": "tenant-uuid-falso",
        "inspector_id": "user-uuid-falso",
        "status": "issued",
        "report_number": "END-LP-2026-999",
    }]

    response = await http_client.post(
        "/api/sync/reports",
        headers={"Authorization": f"Bearer {inspector_token}"},
        json={"items": items},
    )

    print(f"\nDEBUG payload_cannot_set_server_fields: status={response.status_code}, body={response.text}")
    assert response.status_code == 200
    data = response.json()
    print(f"DEBUG items: {data['items']}")
    assert len(data["items"]) == 1
    assert data["items"][0]["ok"] is True, f"Expected ok=True, got: {data['items'][0]}"
    assert data["items"][0]["server_id"] == "client-uuid-001"

    report_row = [r for r in client["reports"] if r["id"] == "client-uuid-001"][0]
    assert report_row["inspector_id"] == "user-uuid-inspector"
    assert report_row["tenant_id"] == "tenant-uuid-5678"
    assert report_row["status"] == "draft"


# ---------------------------------------------------------------------------
# (c) Reenvio idempotente
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_idempotent_resend(http_client, client, inspector_token):
    client["work_orders"].append({
        "id": "work-order-uuid-002",
        "tenant_id": "tenant-uuid-5678",
        "client_id": "client-uuid-002",
        "code": "OS-002",
    })

    items = [{
        "client_id": "client-uuid-002",
        "client_revision": 1,
        "method": "LP",
        "work_order_id": "work-order-uuid-002",
        "equipment_tag": "TAG-002",
        "inspection_date": "2026-10-21",
        "technical_data": {},
        "administrative_data": {},
        "submit": False,
    }]

    async with http_client as c:
        r1 = await c.post("/api/sync/reports", headers={"Authorization": f"Bearer {inspector_token}"}, json={"items": items})
        assert r1.status_code == 200
        assert r1.json()["items"][0]["ok"] is True

        r2 = await c.post("/api/sync/reports", headers={"Authorization": f"Bearer {inspector_token}"}, json={"items": items})
        assert r2.status_code == 200
        assert r2.json()["items"][0]["ok"] is True
        # Segunda chamada deve ser idempotente (não cria duplicata)
        msg = r2.json()["items"][0].get("message", "")
        assert "idempotente" in msg or msg == "", f"Esperado mensagem de idempotência, obteve: {msg}"

    reports = [r for r in client["reports"] if r["id"] == "client-uuid-002"]
    assert len(reports) == 1


# ---------------------------------------------------------------------------
# (d) Laudo em submitted retorna LOCKED
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_locked_when_not_draft(http_client, client, inspector_token):
    client["work_orders"].append({
        "id": "work-order-uuid-003",
        "tenant_id": "tenant-uuid-5678",
        "client_id": "client-uuid-003",
        "code": "OS-003",
    })
    client["reports"].append({
        "id": "client-uuid-003",
        "tenant_id": "tenant-uuid-5678",
        "work_order_id": "work-order-uuid-003",
        "template_id": "template-uuid-lp",
        "inspector_id": "user-uuid-inspector",
        "status": "submitted",
        "equipment_tag": "TAG-003",
        "inspection_date": "2026-10-21",
        "technical_data": {},
        "administrative_data": {},
        "revision": 5,
    })

    items = [{
        "client_id": "client-uuid-003",
        "client_revision": 6,
        "method": "LP",
        "work_order_id": "work-order-uuid-003",
        "equipment_tag": "TAG-003-ALTERADO",
        "inspection_date": "2026-10-22",
        "technical_data": {},
        "administrative_data": {},
        "submit": False,
    }]

    response = await http_client.post(
        "/api/sync/reports",
        headers={"Authorization": f"Bearer {inspector_token}"},
        json={"items": items},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["items"][0]["ok"] is False
    assert data["items"][0]["error_code"] == "LOCKED"


# ---------------------------------------------------------------------------
# (e) Submit bloqueado por qualificação vencida
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_submit_blocked_by_qualification(http_client, mock_supabase, inspector_token):
    client = mock_supabase.data_store
    client["work_orders"].append({
        "id": "work-order-uuid-004",
        "tenant_id": "tenant-uuid-5678",
        "client_id": "client-uuid-004",
        "code": "OS-004",
    })

    # Monkey-patch o mock para lançar exceção de qualificação vencida ao inserir
    original_table = mock_supabase.table

    def failing_table(name):
        if name == "reports":
            t = MockSupabaseTable(name, mock_supabase.data_store)
            orig_insert = t.insert

            def failing_insert(data):
                raise Exception("QUALIFICATION_INVALID: qualificação vencida")
            t.insert = failing_insert
            return t
        return original_table(name)

    mock_supabase.table = failing_table

    items = [{
        "client_id": "client-uuid-004",
        "client_revision": 1,
        "method": "LP",
        "work_order_id": "work-order-uuid-004",
        "equipment_tag": "TAG-004",
        "inspection_date": "2026-10-21",
        "technical_data": {},
        "administrative_data": {},
        "submit": True,
    }]

    response = await http_client.post(
        "/api/sync/reports",
        headers={"Authorization": f"Bearer {inspector_token}"},
        json={"items": items},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["items"][0]["ok"] is False
    assert data["items"][0]["error_code"] == "QUALIFICATION_EXPIRED"


# ---------------------------------------------------------------------------
# (f) Lote com sucesso parcial
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_partial_success_batch(http_client, client, inspector_token):
    client["work_orders"].append({
        "id": "work-order-uuid-005",
        "tenant_id": "tenant-uuid-5678",
        "client_id": "client-uuid-005",
        "code": "OS-005",
    })

    items = [
        {
            "client_id": "client-uuid-005",
            "client_revision": 1,
            "method": "LP",
            "work_order_id": "work-order-uuid-005",
            "equipment_tag": "TAG-005",
            "inspection_date": "2026-10-21",
            "technical_data": {},
            "administrative_data": {},
            "submit": False,
        },
        {
            "client_id": "client-uuid-006",
            "client_revision": 1,
            "method": "LP",
            "work_order_id": "work-order-inexistente",
            "equipment_tag": "TAG-006",
            "inspection_date": "2026-10-21",
            "technical_data": {},
            "administrative_data": {},
            "submit": False,
        },
    ]

    response = await http_client.post(
        "/api/sync/reports",
        headers={"Authorization": f"Bearer {inspector_token}"},
        json={"items": items},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    assert data["items"][0]["ok"] is True
    assert data["items"][1]["ok"] is False
    assert data["items"][1]["error_code"] == "WORK_ORDER_NOT_FOUND"


# ---------------------------------------------------------------------------
# (i) Número de OS duplicado
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_duplicate_os_number(http_client, client, inspector_token):
    # Primeiro cria um cliente, uma obra e uma OS com código OS-010
    client["clients"].append({
        "id": "client-uuid-010",
        "tenant_id": "tenant-uuid-5678",
        "legal_name": "Cliente Teste",
        "cnpj": "11.222.333/0001-10",
    })
    client["sites"].append({
        "id": "site-uuid-001",
        "tenant_id": "tenant-uuid-5678",
        "client_id": "client-uuid-010",
        "name": "Obra Teste",
    })
    client["work_orders"].append({
        "id": "work-order-uuid-010",
        "tenant_id": "tenant-uuid-5678",
        "client_id": "client-uuid-010",
        "code": "OS-010",
    })

    # Tenta criar outra OS com o mesmo código (deve falhar com DUPLICATE_NUMBER)
    items = [{
        "client_id": "client-uuid-011",
        "client_revision": 1,
        "code": "OS-010",  # Código duplicado!
        "client_id": "client-uuid-010",
        "site_id": "site-uuid-001",
    }]

    response = await http_client.post(
        "/api/sync/reports",
        headers={"Authorization": f"Bearer {inspector_token}"},
        json={"items": items},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["items"][0]["ok"] is False
    assert data["items"][0]["error_code"] == "DUPLICATE_NUMBER"


# ---------------------------------------------------------------------------
# (j) Criação em campo desligada
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_field_creation_disabled(http_client, client, inspector_token):
    for t in client["tenants"]:
        if t["id"] == "tenant-uuid-5678":
            t["allow_field_creation"] = False

    items = [{
        "client_id": "client-uuid-012",
        "client_revision": 1,
        "legal_name": "Novo Contratante",
        "cnpj": "12.345.678/0001-87",  # CNPJ válido
    }]

    response = await http_client.post(
        "/api/sync/reports",
        headers={"Authorization": f"Bearer {inspector_token}"},
        json={"items": items},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["items"][0]["ok"] is False
    assert data["items"][0]["error_code"] == "FORBIDDEN"


# ---------------------------------------------------------------------------
# (h) DEPENDENCY_FAILED quando contratante não existe
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_dependency_failed_when_client_missing(http_client, client, inspector_token):
    items = [{
        "client_id": "client-uuid-site-001",
        "client_revision": 1,
        "client_id": "client-uuid-inexistente",
        "name": "Obra Fantasma",
        "situation": "active",
    }]

    response = await http_client.post(
        "/api/sync/reports",
        headers={"Authorization": f"Bearer {inspector_token}"},
        json={"items": items},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["items"][0]["ok"] is False
    assert data["items"][0]["error_code"] == "CLIENT_NOT_FOUND"
