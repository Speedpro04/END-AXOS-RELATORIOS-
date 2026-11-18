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
def _casa(row, col, val):
    if isinstance(val, tuple) and len(val) == 2 and val[0] == "__in__":
        return row.get(col) in val[1]
    return row.get(col) == val


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

    def in_(self, col, vals):
        self._filters.append((col, ("__in__", tuple(vals))))
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
                if all(_casa(row, col, val) for col, val in self._pending_eq_filters):
                    row.update(self._pending_update)
                    updated.append(dict(row))
            self._pending_update = None
            self._pending_eq_filters = []
            return MagicMock(data=updated)

        # Select
        results = []
        for row in store:
            if all(_casa(row, col, val) for col, val in self._filters):
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
                "method": "PT",
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
        "method": "PT",
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
        "method": "PT",
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
        "client_revision": 5,
    })

    items = [{
        "client_id": "client-uuid-003",
        "client_revision": 6,
        "method": "PT",
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
        "method": "PT",
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
            "method": "PT",
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
            "method": "PT",
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
        "contratante_id": "client-uuid-010",
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
        "contratante_id": "client-uuid-inexistente",
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


# ---------------------------------------------------------------------------
# Obra guarda o contratante separado da própria identidade; reenvio atualiza
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_site_keeps_contractor_and_updates_situation(http_client, client, inspector_token):
    client["clients"].append({"id": "contratante-1", "tenant_id": "tenant-uuid-5678", "legal_name": "C"})
    item = {
        "client_id": "obra-1", "client_revision": 1, "contratante_id": "contratante-1",
        "name": "Obra", "situation": "active",
    }
    headers = {"Authorization": f"Bearer {inspector_token}"}

    r1 = await http_client.post("/api/sync/reports", headers=headers, json={"items": [item]})
    assert r1.json()["items"][0]["ok"] is True
    assert client["sites"][0]["client_id"] == "contratante-1"
    assert client["sites"][0]["id"] == "obra-1"

    r2 = await http_client.post("/api/sync/reports", headers=headers, json={"items": [{**item, "situation": "concluded"}]})
    assert r2.json()["items"][0]["ok"] is True
    assert len(client["sites"]) == 1
    assert client["sites"][0]["situation"] == "concluded"


# ---------------------------------------------------------------------------
# Laudo: edição sobe, reenvio não duplica, medição de escopo é gravada
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_report_revision_and_scope_link(http_client, client, inspector_token):
    client["work_orders"].append({"id": "os-1", "tenant_id": "tenant-uuid-5678", "client_id": "c", "code": "OS"})
    item = {
        "client_id": "laudo-1", "client_revision": 1, "method": "PT", "work_order_id": "os-1",
        "equipment_tag": "TAG", "inspection_date": "2026-11-05", "technical_data": {}, "administrative_data": {},
        "vinculo": {"linha_id": "linha-1", "quantidade_inspecionada": 10, "quantidade_aprovada": 9, "quantidade_reprovada": 1},
    }
    headers = {"Authorization": f"Bearer {inspector_token}"}

    r1 = await http_client.post("/api/sync/reports", headers=headers, json={"items": [item]})
    assert r1.json()["items"][0]["workflow_status"] == "draft"
    assert "revision" not in client["reports"][0]  # revisão do documento é do banco, não do aparelho

    await http_client.post("/api/sync/reports", headers=headers, json={"items": [{**item, "equipment_tag": "ANTIGA"}]})
    assert client["reports"][0]["equipment_tag"] == "TAG"

    await http_client.post("/api/sync/reports", headers=headers, json={"items": [{**item, "client_revision": 2, "equipment_tag": "NOVA"}]})
    assert client["reports"][0]["equipment_tag"] == "NOVA"
    assert len(client["laudo_escopo_vinculo"]) == 1


# ---------------------------------------------------------------------------
# Métodos fora dos 16 e escopo por inspetor são recusados
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_invalid_method_and_scope_permission(http_client, inspector_token):
    headers = {"Authorization": f"Bearer {inspector_token}"}
    items = [
        {"client_id": "l", "client_revision": 1, "method": "XX", "work_order_id": "o", "equipment_tag": "T", "inspection_date": "2026-11-05"},
        {"client_id": "e", "client_revision": 1, "site_id": "s", "method": "UT", "unidade": "junta", "quantidade_prevista": 5},
    ]
    data = (await http_client.post("/api/sync/reports", headers=headers, json={"items": items})).json()
    assert data["items"][0]["error_code"] == "VALIDATION_ERROR"
    assert data["items"][1]["error_code"] == "FORBIDDEN"


# ---------------------------------------------------------------------------
# Cliente real do Supabase carrega o JWT do usuário
# ---------------------------------------------------------------------------
def test_user_client_uses_user_token():
    import importlib
    from app.routers import sync as sync_mod
    real = importlib.reload(sync_mod)._supabase_user_client
    sb = real("token-do-usuario")
    assert sb.options.headers["Authorization"] == "Bearer token-do-usuario"


# ---------------------------------------------------------------------------
# Qualificação SNQC do laudo: só a do próprio inspetor, do mesmo método
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_report_keeps_only_own_qualification(http_client, client, inspector_token):
    client["work_orders"].append({
        "id": "work-order-uuid-q", "tenant_id": "tenant-uuid-5678", "client_id": "client-uuid-q", "code": "OS-Q",
    })
    client["qualifications"] = [
        {"id": "q-propria-pt", "tenant_id": "tenant-uuid-5678", "user_id": "user-uuid-inspector", "method": "PT"},
        {"id": "q-propria-mt", "tenant_id": "tenant-uuid-5678", "user_id": "user-uuid-inspector", "method": "MT"},
        {"id": "q-de-outro", "tenant_id": "tenant-uuid-5678", "user_id": "user-uuid-supervisor", "method": "PT"},
    ]

    def laudo(client_id, qualificacao):
        return {
            "client_id": client_id, "client_revision": 1, "method": "PT",
            "work_order_id": "work-order-uuid-q", "equipment_tag": "TAG-Q",
            "inspection_date": "2026-11-18", "technical_data": {}, "administrative_data": {},
            "qualification_id": qualificacao,
        }

    items = [laudo("laudo-q-ok", "q-propria-pt"), laudo("laudo-q-outro", "q-de-outro"), laudo("laudo-q-metodo", "q-propria-mt")]
    async with http_client as c:
        r = await c.post("/api/sync/reports", headers={"Authorization": f"Bearer {inspector_token}"}, json={"items": items})
    assert r.status_code == 200
    assert all(i["ok"] for i in r.json()["items"])

    gravados = {row["id"]: row.get("qualification_id") for row in client["reports"]}
    assert gravados["laudo-q-ok"] == "q-propria-pt"
    assert gravados["laudo-q-outro"] is None
    assert gravados["laudo-q-metodo"] is None


# ---------------------------------------------------------------------------
# Laudo devolvido pelo revisor pode ser reenviado para revisão
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_returned_report_can_be_resubmitted(http_client, client, inspector_token):
    client["work_orders"].append({
        "id": "work-order-uuid-dev", "tenant_id": "tenant-uuid-5678", "client_id": "client-uuid-dev", "code": "OS-DEV",
    })
    client["reports"].append({
        "id": "laudo-devolvido", "tenant_id": "tenant-uuid-5678", "work_order_id": "work-order-uuid-dev",
        "inspector_id": "user-uuid-inspector", "status": "returned", "client_revision": 1,
    })
    items = [{
        "client_id": "laudo-devolvido", "client_revision": 2, "method": "PT",
        "work_order_id": "work-order-uuid-dev", "equipment_tag": "TAG-DEV",
        "inspection_date": "2026-11-18", "technical_data": {}, "administrative_data": {}, "submit": True,
    }]
    async with http_client as c:
        r = await c.post("/api/sync/reports", headers={"Authorization": f"Bearer {inspector_token}"}, json={"items": items})
    assert r.status_code == 200
    item = r.json()["items"][0]
    assert item["ok"] is True, item
    assert [x for x in client["reports"] if x["id"] == "laudo-devolvido"][0]["status"] == "submitted"
