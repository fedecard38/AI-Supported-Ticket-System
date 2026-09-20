import logging
import os
import re
from typing import List, Optional
import httpx

from app.core.setup import get_gemini_api_key
from app.schemas.ai import TicketClassification

logger = logging.getLogger("triage_service")

# Default model configuration
DEFAULT_MODEL = "gemini-2.5-flash"
# google-genai treats http_options.timeout as milliseconds: 30000ms = 30 seconds
DEFAULT_TIMEOUT_MS = 30000


def _get_models_to_try() -> List[str]:
    """
    Get ordered list of candidate models with automatic failover.
    Uses official active Google Gemini models.
    """
    configured = os.getenv("GEMINI_MODEL", DEFAULT_MODEL)
    candidates = [
        configured,
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-flash-latest",
    ]
    # Remove duplicates preserving order
    return list(dict.fromkeys(c for c in candidates if c))


def fallback_classify_ticket(
    consumer_name: str,
    request_text: Optional[str] = None,
    attachment_url: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
    reason: str = "network_timeout",
) -> TicketClassification:
    """
    Intelligent multilingual heuristic fallback classification used when Google Gemini API
    experiences a network timeout, connection error, or unconfigured API key.
    Ensures zero downtime and continuous operation.
    """
    logger.warning(
        f"Invoking fallback triage logic for '{consumer_name}' (reason: {reason})."
    )

    full_text = request_text or ""
    if title and description:
        full_text = f"Title: {title.strip()}\n\nDetailed Description:\n{description.strip()}"
        effective_title = title.strip()
        effective_desc = description.strip()
    else:
        title_match = re.search(r"(?:Subject|Title):\s*(.+?)(?:\n\n|\n|$)", full_text, re.IGNORECASE)
        effective_title = title_match.group(1).strip() if title_match else ""
        cleaned = re.sub(r"(?i)^(?:Subject|Title):[^\n]*\n*", "", full_text)
        cleaned = re.sub(r"(?i)^(?:Issue Details|Detailed Description|Problem Description|Description):[^\n]*\n*", "", cleaned).strip()
        effective_desc = cleaned if len(cleaned) > 5 else full_text

    text_lower = full_text.lower()

    # 1. Category heuristics based on bilingual (EN/ES) domain keywords
    category_scores = {
        "Finance": [
            "invoice", "billing", "payment", "refund", "receipt", "charge",
            "accounting", "tax", "wire", "bank", "credit card", "pricing",
            "fee", "cost", "budget", "ledger", "factura", "facturas", "cobro",
            "cobros", "pago", "pagos", "reembolso", "tarjeta", "credito",
            "crédito", "cuenta", "dinero", "precio", "duplicado", "recibo",
            "devolucion", "devolución",
        ],
        "Legal": [
            "contract", "nda", "terms of service", "compliance", "gdpr",
            "privacy", "license", "lawyer", "liability", "breach of contract",
            "copyright", "trademark", "patent", "policy violation", "contrato",
            "contratos", "legal", "abogado", "ley", "demanda", "politica",
            "política", "privacidad", "cumplimiento", "terminos", "términos",
        ],
        "Operations": [
            "facility", "logistics", "datacenter", "cooling", "maintenance",
            "warehouse", "shipping", "courier", "hardware order", "office supply",
            "chiller", "generator", "hvac", "power supply", "instalaciones",
            "oficina", "mantenimiento", "limpieza", "logistica", "logística",
            "almacen", "almacén", "envio", "envío", "generador", "suministros",
        ],
        "IT Support": [
            "password", "login", "sso", "vpn", "wifi", "network", "server",
            "database", "error", "bug", "crash", "outage", "laptop", "monitor",
            "install", "software", "windows", "linux", "access denied", "portal",
            "contraseña", "clave", "autenticacion", "autenticación", "acceso",
            "servidor", "reiniciar", "reinicio", "pantalla", "computadora",
            "sistema", "conexion", "conexión", "autenticar",
        ],
        "Human Resources": [
            "vacation", "pto", "leave", "benefits", "health insurance",
            "salary", "bonus", "hire", "onboarding", "recruitment", "interview",
            "resignation", "maternity", "paternity", "hr", "performance review",
            "vacaciones", "dias", "días", "sueldo", "salario", "licencia",
            "paternidad", "maternidad", "empleado", "empleada", "contratacion",
            "contratación", "despido", "personal", "rrhh",
        ],
        "Customer Success": [
            "churn", "renew", "renewal", "client", "customer", "satisfaction",
            "feedback", "nps", "account manager", "upgrade plan", "downgrade",
            "demo", "feature request", "cancellation inquiry", "cliente",
            "clientes", "renovacion", "renovación", "cancelacion", "cancelación",
            "satisfaccion", "satisfacción", "queja", "reclamo", "reunion", "reunión",
        ],
    }

    best_category = "IT Support"
    max_matches = 0

    for cat, keywords in category_scores.items():
        matches = sum(1 for kw in keywords if re.search(r"\b" + re.escape(kw) + r"\b", text_lower))
        if matches > max_matches:
            max_matches = matches
            best_category = cat

    # 2. Priority heuristics (bilingual)
    high_priority_keywords = [
        "emergency", "urgent", "critical", "down", "outage", "blocked",
        "cannot work", "blocker", "security breach", "data loss", "failure",
        "production down", "immediate", "asap", "urgente", "emergencia",
        "critico", "crítico", "caido", "caído", "bloqueado", "falla", "grave",
        "inmediato", "no funciona", "parado", "duplicado", "cobro duplicado",
    ]
    low_priority_keywords = [
        "minor", "cosmetic", "question", "feedback", "suggestion", "typo",
        "inquiry", "low priority", "no rush", "when possible", "duda",
        "consulta", "menor", "cuando se pueda", "sugerencia", "pregunta",
        "estetico", "estético",
    ]

    has_high = any(re.search(r"\b" + re.escape(kw) + r"\b", text_lower) for kw in high_priority_keywords)
    has_low = any(re.search(r"\b" + re.escape(kw) + r"\b", text_lower) for kw in low_priority_keywords)

    if has_high:
        priority = "High"
    elif has_low:
        priority = "Low"
    else:
        priority = "Medium"

    # 3. Intelligent fallback summary synthesis focusing on the detailed problem
    target_body = effective_desc
    raw_sentences = [
        s.strip()
        for s in re.split(r"(?<=[.!?])\s+|\n+", target_body)
        if len(s.strip()) > 8 and not re.match(r"^(?:Subject|Title|Issue Details|Description):", s.strip(), re.IGNORECASE)
    ]
    if raw_sentences:
        core_issue = raw_sentences[0].rstrip(".!?")
        if len(core_issue) < 50 and len(raw_sentences) > 1:
            core_issue = f"{core_issue}. {raw_sentences[1].rstrip('.!?')}"
        if len(core_issue) > 180:
            core_issue = core_issue[:177].rsplit(" ", 1)[0] + "..."
        candidate_summary = f"{consumer_name} reporta ({best_category}): {core_issue}."
    elif effective_title:
        candidate_summary = f"{consumer_name} reporta ({best_category}): {effective_title}."
    else:
        candidate_summary = f"Solicitud de asistencia de {consumer_name} ({best_category})."

    return TicketClassification(
        category=best_category,
        priority=priority,
        summary=candidate_summary,
    )


def _build_prompt(
    consumer_name: str,
    request_text: Optional[str] = None,
    attachment_url: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
) -> str:
    prompt = f"Consumer / Submitter: {consumer_name}\n"
    if title:
        prompt += f"Ticket Subject / Title: {title}\n"
    if description:
        prompt += f"Detailed Problem Description:\n{description}\n"
    elif request_text:
        prompt += f"Ticket Content:\n{request_text}\n"

    if attachment_url and attachment_url.strip():
        prompt += f"Attachment URL: {attachment_url.strip()}\n"
    return prompt


def _get_system_instruction() -> str:
    return (
        "You are an enterprise AI ticket triaging assistant. "
        "Your task is to analyze support ticket requests (both title and detailed description) and:\n"
        "1. Categorize it into EXACTLY ONE department: 'Finance', 'Legal', 'Operations', 'IT Support', 'Human Resources', or 'Customer Success'.\n"
        "2. Assign a priority: 'High', 'Medium', or 'Low' based on business urgency and impact:\n"
        "   - 'High': Outages, production down, VPN/login blockers, duplicate billing/charges, security breaches, legal issues, urgent deadlines.\n"
        "   - 'Medium': Standard operational requests, functional bugs, inquiries requiring staff attention, day-to-day tickets.\n"
        "   - 'Low': Minor questions, general feedback, non-blocking inquiries, informational requests.\n"
        "3. Generate a concise, intelligent 1-2 sentence summary of the core issue and what action is required. "
        "CRITICAL INSTRUCTION FOR SUMMARY: "
        "Your summary MUST focus on the user's detailed description of what is failing or requested. "
        "Do NOT simply repeat or copy the ticket title or subject line. Synthesize the core problem described in the description and state what is needed, written in the SAME language as the request (e.g., if the user wrote in Spanish, answer in Spanish; if in English, answer in English).\n"
        "Always respond with valid structured JSON conforming to the schema."
    )


def _parse_classification(text: str) -> TicketClassification:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return TicketClassification.model_validate_json(cleaned)


def classify_ticket(
    consumer_name: str,
    request_text: Optional[str] = None,
    attachment_url: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
) -> TicketClassification:
    """
    Classify a support ticket using Google GenAI SDK.
    Outputs structured JSON adhering to TicketClassification Pydantic schema.
    Includes model failover cascade and robust fallback logic in case of network timeouts.
    """
    api_key = get_gemini_api_key()
    if not api_key:
        logger.warning("Gemini API key is not configured. Falling back to rule-based classification.")
        return fallback_classify_ticket(
            consumer_name=consumer_name,
            request_text=request_text,
            attachment_url=attachment_url,
            title=title,
            description=description,
            reason="missing_api_key",
        )

    prompt = _build_prompt(
        consumer_name=consumer_name,
        request_text=request_text,
        attachment_url=attachment_url,
        title=title,
        description=description,
    )
    models_to_try = _get_models_to_try()

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        config = types.GenerateContentConfig(
            system_instruction=_get_system_instruction(),
            response_mime_type="application/json",
            response_schema=TicketClassification,
            temperature=0.1,
            http_options=types.HttpOptions(timeout=DEFAULT_TIMEOUT_MS),
        )

        last_error = None
        for model_name in models_to_try:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=config,
                )

                if getattr(response, "parsed", None) and isinstance(response.parsed, TicketClassification):
                    return response.parsed
                if response.text:
                    return _parse_classification(response.text)

            except Exception as model_err:
                logger.warning(f"Model '{model_name}' encountered error: {model_err}. Checking next candidate.")
                last_error = model_err
                # Continue loop to try next model in cascade

        # If all candidate models in the loop failed:
        if last_error:
            logger.error(f"All candidate models failed. Last error: {last_error}")
            return fallback_classify_ticket(
                consumer_name=consumer_name,
                request_text=request_text,
                attachment_url=attachment_url,
                title=title,
                description=description,
                reason=f"error_{type(last_error).__name__}",
            )

        return fallback_classify_ticket(
            consumer_name=consumer_name,
            request_text=request_text,
            attachment_url=attachment_url,
            title=title,
            description=description,
            reason="empty_response",
        )

    except (httpx.TimeoutException, TimeoutError) as timeout_exc:
        logger.warning(f"Network timeout contacting Gemini API ({timeout_exc}). Triggering fallback logic.")
        return fallback_classify_ticket(
            consumer_name=consumer_name,
            request_text=request_text,
            attachment_url=attachment_url,
            title=title,
            description=description,
            reason="network_timeout",
        )
    except Exception as exc:
        err_msg = str(exc).lower()
        if "timeout" in err_msg or "timed out" in err_msg or "connection" in err_msg:
            logger.warning(f"Connection/timeout issue with Gemini API: {exc}. Triggering fallback logic.")
            return fallback_classify_ticket(
                consumer_name=consumer_name,
                request_text=request_text,
                attachment_url=attachment_url,
                title=title,
                description=description,
                reason="network_timeout",
            )
        logger.error(f"Error occurred during Gemini classification: {exc}", exc_info=True)
        return fallback_classify_ticket(
            consumer_name=consumer_name,
            request_text=request_text,
            attachment_url=attachment_url,
            title=title,
            description=description,
            reason=f"error_{type(exc).__name__}",
        )


async def aclassify_ticket(
    consumer_name: str,
    request_text: Optional[str] = None,
    attachment_url: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
) -> TicketClassification:
    """
    Asynchronous version of classify_ticket using Google GenAI async client.
    Includes model failover cascade and network timeout fallback logic.
    """
    api_key = get_gemini_api_key()
    if not api_key:
        logger.warning("Gemini API key is not configured. Falling back to rule-based classification.")
        return fallback_classify_ticket(
            consumer_name=consumer_name,
            request_text=request_text,
            attachment_url=attachment_url,
            title=title,
            description=description,
            reason="missing_api_key",
        )

    prompt = _build_prompt(
        consumer_name=consumer_name,
        request_text=request_text,
        attachment_url=attachment_url,
        title=title,
        description=description,
    )
    models_to_try = _get_models_to_try()

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        config = types.GenerateContentConfig(
            system_instruction=_get_system_instruction(),
            response_mime_type="application/json",
            response_schema=TicketClassification,
            temperature=0.1,
            http_options=types.HttpOptions(timeout=DEFAULT_TIMEOUT_MS),
        )

        last_error = None
        for model_name in models_to_try:
            try:
                response = await client.aio.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=config,
                )

                if getattr(response, "parsed", None) and isinstance(response.parsed, TicketClassification):
                    return response.parsed
                if response.text:
                    return _parse_classification(response.text)

            except Exception as model_err:
                logger.warning(f"Async model '{model_name}' encountered error: {model_err}. Checking next candidate.")
                last_error = model_err
                # Continue loop to try next model in cascade

        # If all candidate models in the loop failed:
        if last_error:
            logger.error(f"All candidate async models failed. Last error: {last_error}")
            return fallback_classify_ticket(
                consumer_name=consumer_name,
                request_text=request_text,
                attachment_url=attachment_url,
                title=title,
                description=description,
                reason=f"error_{type(last_error).__name__}",
            )

        return fallback_classify_ticket(
            consumer_name=consumer_name,
            request_text=request_text,
            attachment_url=attachment_url,
            title=title,
            description=description,
            reason="empty_response",
        )

    except (httpx.TimeoutException, TimeoutError) as timeout_exc:
        logger.warning(f"Async network timeout contacting Gemini API ({timeout_exc}). Triggering fallback logic.")
        return fallback_classify_ticket(
            consumer_name=consumer_name,
            request_text=request_text,
            attachment_url=attachment_url,
            title=title,
            description=description,
            reason="network_timeout",
        )
    except Exception as exc:
        err_msg = str(exc).lower()
        if "timeout" in err_msg or "timed out" in err_msg or "connection" in err_msg:
            logger.warning(f"Async connection/timeout issue with Gemini API: {exc}. Triggering fallback logic.")
            return fallback_classify_ticket(
                consumer_name=consumer_name,
                request_text=request_text,
                attachment_url=attachment_url,
                title=title,
                description=description,
                reason="network_timeout",
            )
        logger.error(f"Async error during Gemini classification: {exc}", exc_info=True)
        return fallback_classify_ticket(
            consumer_name=consumer_name,
            request_text=request_text,
            attachment_url=attachment_url,
            title=title,
            description=description,
            reason=f"error_{type(exc).__name__}",
        )
