"""
╔════════════════════════════════════════════════════════════════╗
║       ROTA /api/sync/reports – Axos Relatórios                ║
╠════════════════════════════════════════════════════════════════╣
║  Sincronização síncrona de clientes, obras, OS e laudos.      ║
║  Cada item roda em sua própria transação (um erro não         ║
║  bloqueia os outros).                                         ║
║                                                                 ║
║  POST /api/sync/reports  → sincroniza lote (até 20 itens)     ║
║  GET  /api/sync/status/{job_id} → consulta status de job      ║
║  GET  /api/sync/dlq            → lista erros da DLQ           ║
╚════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import logging
from typing import Annotated, Any

from arq import ArqRedis, create_pool
from arq.jobs import Job
from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from supabase import create_client

from app.core.config import settings
from app.core.security import CurrentUserDep
from app.queues.enqueue import get_arq_redis_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sync", tags=["Sincronização de Campo"])

bearer = HTTPBearer(auto_error=True)


# ─────────────────────────────────────────────────────────
# Dependency: token bruto do usuário (para repassar ao Supabase)
# ─────────────────────────────────────────────────────────

async def get_user_token(
    creds: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
) -> str:
    return creds.credentials


# ─────────────────────────────────────────────────────────
# Dependency: pool ARQ (reutilizável, para jobs de PDF/email)
# ─────────────────────────────────────────────────────────

async def get_arq():
    pool = await create_pool(get_arq_redis_settings())
    try:
        yield pool
    finally:
        await pool.aclose()


ArqDep = Annotated[Any, Depends(get_arq)]


# ─────────────────────────────────────────────────────────
# Schemas de entrada (contrato da Tarefa F)
# ─────────────────────────────────────────────────────────

class SyncItemBase(BaseModel):
    client_id: str = Field(..., description="UUID gerado pelo cliente (identidade offline)")
    client_revision: int = Field(..., description="Revisão crescente do cliente (idempotência)")


class SyncClientItem(SyncItemBase):
    legal_name: str
    cnpj: str | None = None
    address: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    active: bool = True


class SyncSiteItem(SyncItemBase):
    client_id: str  # referência ao contratante (mesmo UUID do cliente que o criou)
    name: str
    address: str | None = None
    city: str | None = None
    uf: str | None = None
    contract_ref: str | None = None
    situation: str = "active"


class SyncWorkOrderItem(SyncItemBase):
    client_id: str
    code: str
    site_id: str | None = None
    scheduled_for: str | None = None
    assigned_to: str | None = None
    method: str | None = None
    notes: str | None = None


class SyncReportItem(SyncItemBase):
    method: str
    work_order_id: str
    equipment_tag: str
    inspection_date: str
    technical_data: dict[str, Any] = Field(default_factory=dict)
    administrative_data: dict[str, Any] = Field(default_factory=dict)
    submit: bool = False


class SyncItemResponse(BaseModel):
    client_id: str
    ok: bool
    server_id: str | None = None
    server_revision: int | None = None
    error_code: str | None = None
    message: str | None = None


class SyncBatchRequest(BaseModel):
    items: list[dict[str, Any]] = Field(..., max_length=20, description="Lote de até 20 itens")


class SyncBatchResponse(BaseModel):
    items: list[SyncItemResponse]


# ─────────────────────────────────────────────────────────
# Cliente Supabase com o JWT do usuário (RLS enxerga o usuário real)
# ─────────────────────────────────────────────────────────

def _supabase_user_client(token: str) -> Any:
    """Cria um cliente Supabase autenticado com o JWT do usuário."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY, headers={
        "Authorization": f"Bearer {token}",
    })


# ─────────────────────────────────────────────────────────
# Rota principal: sincronização síncrona de lote
# ─────────────────────────────────────────────────────────

@router.post(
    "/reports",
    response_model=SyncBatchResponse,
    status_code=status.HTTP_200_OK,
    summary="Sincroniza lote de clientes, obras, OS e laudos",
    description=(
        "Processa até 20 itens por requisição, cada um em sua própria transação. "
        "Os itens devem vir ordenados: clients, sites, work_orders, reports. "
        "Gravação síncrona com o JWT do usuário (sem service role)."
    ),
)
async def sync_reports(
    body: SyncBatchRequest,
    current_user: CurrentUserDep,
    token: Annotated[str, Depends(get_user_token)],
) -> SyncBatchResponse:
    sb = _supabase_user_client(token)
    tenant_id = current_user.tenant_id  # isolamento por tenant do usuário logado
    user_id = current_user.user_id
    role = current_user.role

    results: list[SyncItemResponse] = []

    for item in body.items:
        item_type = _detect_item_type(item)
        try:
            res = await _process_item(
                sb=sb,
                item_type=item_type,
                item=item,
                tenant_id=tenant_id,
                user_id=user_id,
                role=role,
            )
            results.append(res)
        except HTTPException as exc:
            results.append(SyncItemResponse(
                client_id=item.get("client_id", "unknown"),
                ok=False,
                error_code=exc.detail if isinstance(exc.detail, str) else "UNKNOWN",
                message=str(exc.detail),
            ))
        except Exception as exc:
            logger.exception("Erro ao processar item %s", item.get("client_id"))
            results.append(SyncItemResponse(
                client_id=item.get("client_id", "unknown"),
                ok=False,
                error_code="UNKNOWN",
                message=str(exc),
            ))

    return SyncBatchResponse(items=results)


def _detect_item_type(item: dict[str, Any]) -> str:
    """Detecta o tipo do item pelos campos presentes."""
    if "method" in item and "work_order_id" in item and "equipment_tag" in item:
        return "report"
    if "code" in item and ("site_id" in item or "site" in item):
        return "work_order"
    if "name" in item and "client_id" in item and "situation" in item:
        return "site"
    if "legal_name" in item or "cnpj" in item:
        return "client"
    return "unknown"


# ─────────────────────────────────────────────────────────
# Processadores por tipo de item
# ─────────────────────────────────────────────────────────

async def _process_item(
    sb: Any,
    item_type: str,
    item: dict[str, Any],
    tenant_id: str,
    user_id: str,
    role: str,
) -> SyncItemResponse:
    client_id = item.get("client_id", "unknown")
    client_revision = item.get("client_revision", 0)

    if item_type == "client":
        return await _process_client(sb, item, tenant_id, user_id, role, client_id, client_revision)
    if item_type == "site":
        return await _process_site(sb, item, tenant_id, user_id, role, client_id, client_revision)
    if item_type == "work_order":
        return await _process_work_order(sb, item, tenant_id, user_id, role, client_id, client_revision)
    if item_type == "report":
        return await _process_report(sb, item, tenant_id, user_id, role, client_id, client_revision)
    return SyncItemResponse(
        client_id=client_id,
        ok=False,
        error_code="VALIDATION_ERROR",
        message="Tipo de item não reconhecido",
    )


async def _process_client(
    sb: Any,
    item: SyncClientItem,
    tenant_id: str,
    user_id: str,
    role: str,
    client_id: str,
    client_revision: int,
) -> SyncItemResponse:
    # Apenas revisor/admin ou inspetor (se allow_field_creation estiver ligado)
    if role not in ("admin", "supervisor"):
        if role == "inspector":
            tenant_res = sb.table("tenants").select("allow_field_creation").eq("id", tenant_id).execute()
            if tenant_res.data and not tenant_res.data[0].get("allow_field_creation", True):
                return SyncItemResponse(
                    client_id=client_id, ok=False, error_code="FORBIDDEN",
                    message="Criação em campo desabilitada para este tenant",
                )
        else:
            return SyncItemResponse(
                client_id=client_id, ok=False, error_code="FORBIDDEN",
                message="Apenas admin/supervisor podem criar contratantes",
            )

    # Verifica idempotência: já existe com client_revision <= atual?
    existing = sb.table("clients").select("id, updated_at").eq("id", client_id).execute()
    if existing.data and len(existing.data) > 0:
        return SyncItemResponse(
            client_id=client_id, ok=True, server_id=existing.data[0]["id"],
            server_revision=client_revision,
        )

    # CNPJ válido quando informado
    cnpj = item.get("cnpj")
    if cnpj and not _valid_cnpj(cnpj):
        return SyncItemResponse(
            client_id=client_id, ok=False, error_code="VALIDATION_ERROR",
            message="CNPJ inválido",
        )

    try:
        res = sb.table("clients").insert({
            "id": client_id,
            "tenant_id": tenant_id,
            "legal_name": item["legal_name"],
            "cnpj": cnpj,
            "address": item.get("address"),
            "contact_name": item.get("contact_name"),
            "contact_email": item.get("contact_email"),
            "contact_phone": item.get("contact_phone"),
            "active": item.get("active", True),
            "created_by": user_id,
            "created_in_field": role == "inspector",
            "needs_review": True,
        }).execute()

        if not res.data:
            return SyncItemResponse(
                client_id=client_id, ok=False, error_code="UNKNOWN",
                message="Falha ao inserir contratante",
            )

        return SyncItemResponse(
            client_id=client_id, ok=True, server_id=res.data[0]["id"],
            server_revision=client_revision,
        )
    except Exception as exc:
        msg = str(exc)
        if "DUPLICATE_NUMBER" in msg or "unique" in msg.lower():
            return SyncItemResponse(
                client_id=client_id, ok=False, error_code="DUPLICATE_NUMBER",
                message="CNPJ já cadastrado neste tenant",
            )
        return SyncItemResponse(
            client_id=client_id, ok=False, error_code="UNKNOWN", message=msg,
        )


async def _process_site(
    sb: Any,
    item: SyncSiteItem,
    tenant_id: str,
    user_id: str,
    role: str,
    client_id: str,
    client_revision: int,
) -> SyncItemResponse:
    # Verifica se o contratante existe neste tenant
    client_check = sb.table("clients").select("id").eq("id", item["client_id"]).eq("tenant_id", tenant_id).execute()
    if not client_check.data or len(client_check.data) == 0:
        return SyncItemResponse(
            client_id=client_id, ok=False, error_code="CLIENT_NOT_FOUND",
            message="Contratante não encontrado neste tenant",
        )

    existing = sb.table("sites").select("id").eq("id", client_id).execute()
    if existing.data and len(existing.data) > 0:
        return SyncItemResponse(
            client_id=client_id, ok=True, server_id=existing.data[0]["id"],
            server_revision=client_revision,
        )

    try:
        res = sb.table("sites").insert({
            "id": client_id,
            "tenant_id": tenant_id,
            "client_id": item["client_id"],
            "name": item["name"],
            "address": item.get("address"),
            "city": item.get("city"),
            "uf": item.get("uf"),
            "contract_ref": item.get("contract_ref"),
            "situation": item.get("situation", "active"),
            "created_by": user_id,
            "created_in_field": role == "inspector",
            "needs_review": True,
        }).execute()

        if not res.data:
            return SyncItemResponse(
                client_id=client_id, ok=False, error_code="UNKNOWN",
                message="Falha ao inserir obra",
            )

        return SyncItemResponse(
            client_id=client_id, ok=True, server_id=res.data[0]["id"],
            server_revision=client_revision,
        )
    except Exception as exc:
        return SyncItemResponse(
            client_id=client_id, ok=False, error_code="UNKNOWN", message=str(exc),
        )


async def _process_work_order(
    sb: Any,
    item: SyncWorkOrderItem,
    tenant_id: str,
    user_id: str,
    role: str,
    client_id: str,
    client_revision: int,
) -> SyncItemResponse:
    # Verifica se o contratante existe
    client_check = sb.table("clients").select("id").eq("id", item["client_id"]).eq("tenant_id", tenant_id).execute()
    if not client_check.data or len(client_check.data) == 0:
        return SyncItemResponse(
            client_id=client_id, ok=False, error_code="CLIENT_NOT_FOUND",
            message="Contratante não encontrado neste tenant",
        )

    # Verifica se a obra existe (se informada)
    if item.get("site_id"):
        site_check = sb.table("sites").select("id").eq("id", item["site_id"]).eq("tenant_id", tenant_id).execute()
        if not site_check.data or len(site_check.data) == 0:
            return SyncItemResponse(
                client_id=client_id, ok=False, error_code="SITE_NOT_FOUND",
                message="Obra não encontrada neste tenant",
            )

    existing = sb.table("work_orders").select("id").eq("id", client_id).execute()
    if existing.data and len(existing.data) > 0:
        return SyncItemResponse(
            client_id=client_id, ok=True, server_id=existing.data[0]["id"],
            server_revision=client_revision,
        )

    try:
        res = sb.table("work_orders").insert({
            "id": client_id,
            "tenant_id": tenant_id,
            "client_id": item["client_id"],
            "code": item["code"],
            "site_id": item.get("site_id"),
            "scheduled_for": item.get("scheduled_for"),
            "assigned_to": item.get("assigned_to"),
            "method": item.get("method"),
            "notes": item.get("notes"),
            "created_by": user_id,
            "created_in_field": role == "inspector",
            "needs_review": True,
        }).execute()

        if not res.data:
            return SyncItemResponse(
                client_id=client_id, ok=False, error_code="UNKNOWN",
                message="Falha ao inserir OS",
            )

        return SyncItemResponse(
            client_id=client_id, ok=True, server_id=res.data[0]["id"],
            server_revision=client_revision,
        )
    except Exception as exc:
        msg = str(exc)
        if "unique" in msg.lower() or "duplicate" in msg.lower():
            return SyncItemResponse(
                client_id=client_id, ok=False, error_code="DUPLICATE_NUMBER",
                message="Número de OS duplicado neste tenant",
            )
        return SyncItemResponse(
            client_id=client_id, ok=False, error_code="UNKNOWN", message=msg,
        )


async def _process_report(
    sb: Any,
    item: SyncReportItem,
    tenant_id: str,
    user_id: str,
    role: str,
    client_id: str,
    client_revision: int,
) -> SyncItemResponse:
    # Verifica se a OS existe neste tenant
    wo_check = sb.table("work_orders").select("id, tenant_id").eq("id", item["work_order_id"]).eq("tenant_id", tenant_id).execute()
    if not wo_check.data or len(wo_check.data) == 0:
        return SyncItemResponse(
            client_id=client_id, ok=False, error_code="WORK_ORDER_NOT_FOUND",
            message="Ordem de serviço não encontrada neste tenant",
        )

    # Verifica idempotência: laudo já existe com esse client_id?
    existing = sb.table("reports").select("id, status, revision").eq("id", client_id).execute()
    if existing.data and len(existing.data) > 0:
        row = existing.data[0]
        if client_revision <= row.get("revision", 0):
            # Reenvio seguro: não altera nada
            return SyncItemResponse(
                client_id=client_id, ok=True,
                server_id=row["id"], server_revision=row["revision"],
                message="Já sincronizado (idempotente)",
            )
        # Se client_revision > revision, permite atualizar (apenas se draft/returned)
        if row["status"] not in ("draft", "returned"):
            return SyncItemResponse(
                client_id=client_id, ok=False, error_code="LOCKED",
                message="Laudo já foi submetido e não pode ser alterado",
            )

    # Resolve o template ativo do tenant para o método
    template_res = sb.table("report_templates").select("id").eq("method", item["method"]).eq("published", True).eq("tenant_id", tenant_id).execute()
    if not template_res.data or len(template_res.data) == 0:
        # Tenta template global (tenant_id null)
        template_res = sb.table("report_templates").select("id").eq("method", item["method"]).eq("published", True).is_("tenant_id", "null").execute()
    if not template_res.data or len(template_res.data) == 0:
        return SyncItemResponse(
            client_id=client_id, ok=False, error_code="TEMPLATE_NOT_FOUND",
            message=f"Nenhum template publicado para o método {item['method']} neste tenant",
        )
    template_id = template_res.data[0]["id"]

    # Cria ou atualiza o laudo
    try:
        if existing.data and len(existing.data) > 0:
            # Atualização (apenas draft/returned)
            res = sb.table("reports").update({
                "equipment_tag": item["equipment_tag"],
                "inspection_date": item["inspection_date"],
                "technical_data": item["technical_data"],
                "administrative_data": item["administrative_data"],
            }).eq("id", client_id).execute()
        else:
            # Criação: status draft, tenant_id e inspector_id do token
            res = sb.table("reports").insert({
                "id": client_id,
                "tenant_id": tenant_id,
                "work_order_id": item["work_order_id"],
                "template_id": template_id,
                "inspector_id": user_id,
                "status": "draft",
                "revision": client_revision,
                "equipment_tag": item["equipment_tag"],
                "inspection_date": item["inspection_date"],
                "technical_data": item["technical_data"],
                "administrative_data": item["administrative_data"],
            }).execute()

        if not res.data:
            return SyncItemResponse(
                client_id=client_id, ok=False, error_code="UNKNOWN",
                message="Falha ao gravar laudo",
            )

        server_id = res.data[0]["id"]

        # Se submit=true, transição draft → submitted (gatilhos rodam)
        if item.get("submit"):
            submit_res = sb.table("reports").update({
                "status": "submitted",
            }).eq("id", server_id).eq("status", "draft").execute()

            if not submit_res.data:
                # Pode ser LOCKED (não é draft) ou outra exceção do trigger
                return SyncItemResponse(
                    client_id=client_id, ok=False, error_code="LOCKED",
                    message="Não foi possível submeter o laudo (não está em rascunho)",
                )

            # Após submeter, buscar número do laudo se já foi emitido (improvável no mesmo request)
            report_res = sb.table("reports").select("report_number, status").eq("id", server_id).execute()
            report_rows = report_res.data or []
            report_number = report_rows[0].get("report_number") if report_rows else None
            workflow_status = report_rows[0].get("status") if report_rows else "submitted"

            return SyncItemResponse(
                client_id=client_id, ok=True,
                server_id=server_id, server_revision=client_revision,
                workflow_status=workflow_status,
                report_number=report_number,
            )

        # Sem submit: retorna status draft
        report_res = sb.table("reports").select("report_number, status").eq("id", server_id).execute()
        report_rows = report_res.data or []
        report_number = report_rows[0].get("report_number") if report_rows else None
        workflow_status = report_rows[0].get("status") if report_rows else "draft"

        return SyncItemResponse(
            client_id=client_id, ok=True,
            server_id=server_id, server_revision=client_revision,
            workflow_status=workflow_status,
            report_number=report_number,
        )

    except HTTPException:
        raise
    except Exception as exc:
        msg = str(exc)
        if "QUALIFICATION_INVALID" in msg:
            return SyncItemResponse(
                client_id=client_id, ok=False, error_code="QUALIFICATION_EXPIRED",
                message="Qualificação ausente, de outro método ou vencida",
            )
        if "INSTRUMENT_CALIBRATION_EXPIRED" in msg:
            return SyncItemResponse(
                client_id=client_id, ok=False, error_code="INSTRUMENT_EXPIRED",
                message="Instrumento com calibração vencida",
            )
        if "REPORT_IMMUTABLE" in msg or "LOCKED" in msg:
            return SyncItemResponse(
                client_id=client_id, ok=False, error_code="LOCKED",
                message="Laudo não pode ser alterado neste estado",
            )
        if "TEMPLATE_NOT_FOUND" in msg:
            return SyncItemResponse(
                client_id=client_id, ok=False, error_code="TEMPLATE_NOT_FOUND",
                message="Template não encontrado",
            )
        return SyncItemResponse(
            client_id=client_id, ok=False, error_code="VALIDATION_ERROR", message=msg,
        )


# ─────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────

def current_user_can_inspect(role: str) -> bool:
    return role in ("inspector", "admin", "supervisor")


def _valid_cnpj(cnpj: str) -> bool:
    digits = "".join(ch for ch in cnpj if ch.isdigit())
    if len(digits) != 14 or len(set(digits)) == 1:
        return False
    try:
        nums = [int(d) for d in digits]
    except ValueError:
        return False
    # Primeiro dígito verificador
    weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    total1 = sum(n * w for n, w in zip(nums[:12], weights1))
    d1 = 0 if total1 % 11 < 2 else 11 - (total1 % 11)
    # Segundo dígito verificador
    weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    total2 = sum(n * w for n, w in zip(nums[:13], weights2))
    d2 = 0 if total2 % 11 < 2 else 11 - (total2 % 11)
    return nums[12] == d1 and nums[13] == d2


# ─────────────────────────────────────────────────────────
# Rotas de status e DLQ (para jobs de PDF/email via ARQ)
# ─────────────────────────────────────────────────────────

@router.get(
    "/status/{job_id}",
    summary="Consulta o status de um job de processamento (PDF/email)",
)
async def get_sync_status(
    job_id: str,
    arq: ArqDep,
    current_user: CurrentUserDep,
) -> dict[str, Any]:
    """Retorna o status de um job ARQ (PDF ou e-mail)."""
    try:
        job = Job(job_id=job_id, redis=arq)
        info = await job.info()
        if info is None:
            raise HTTPException(status_code=404, detail="Job não encontrado.")
        return {
            "job_id": job_id,
            "status": info.status,
            "result": info.result,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Erro interno ao consultar status do job")


@router.get(
    "/dlq",
    summary="Lista erros da Dead Letter Queue (PDF/email)",
)
async def list_dlq(
    arq: ArqDep,
    current_user: CurrentUserDep,
) -> dict[str, Any]:
    """Retorna os itens com falha da DLQ. Somente supervisor ou admin."""
    if not current_user.is_reviewer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a supervisores e administradores",
        )

    import json

    try:
        keys = await arq.keys("dlq:sync:laudos:*")
        items = []
        for key in keys:
            raw = await arq.get(key)
            if raw:
                try:
                    parsed = json.loads(raw)
                    if parsed.get("tenant_id") == current_user.tenant_id:
                        items.append(parsed)
                except Exception:
                    continue
        return {"total": len(items), "tenant_id": current_user.tenant_id, "items": items}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Erro interno ao consultar DLQ")


# ─────────────────────────────────────────────────────────
# Health-check da rota de sync
# ─────────────────────────────────────────────────────────

@router.get("/healthz", summary="Health-check da rota de sincronização")
async def sync_healthz() -> dict[str, str]:
    return {"status": "ok", "service": "sync"}
