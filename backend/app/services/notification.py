import html
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional, Union

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.enums import TicketCategory, TicketPriority, UserRole
from app.models.user import User

logger = logging.getLogger("notification_service")

# SMTP Configuration defaults matching Docker Compose and local test environments
DEFAULT_SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
DEFAULT_SMTP_PORT = int(os.getenv("SMTP_PORT", 1025))
DEFAULT_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "noreply@ticketworkspace.com")


def get_responsible_users_for_category(
    category: Union[str, TicketCategory],
    db: Session,
) -> List[User]:
    """
    Lookup all active Users where role='responsible' and assigned_category=category.
    Supports case-insensitive matching for both role and category.
    """
    category_str = category.value if hasattr(category, "value") else str(category)

    stmt = select(User).where(
        or_(
            User.role == UserRole.RESPONSIBLE,
            func.lower(cast(User.role, String)) == "responsible",
        ),
        or_(
            User.assigned_category == category_str,
            func.lower(User.assigned_category) == category_str.lower(),
        ),
        User.is_active.is_(True),
    )
    return list(db.scalars(stmt).all())


def build_ticket_notification_html(
    ticket_id: int,
    consumer_name: str,
    priority: str,
    ai_summary: str,
    ticket_title: Optional[str] = None,
    category: Optional[str] = None,
) -> str:
    """
    Generate an HTML notification email containing Ticket ID, Consumer Name, Priority, and AI Summary.
    """
    safe_ticket_id = html.escape(str(ticket_id))
    safe_consumer_name = html.escape(consumer_name or "Anonymous Consumer")
    safe_priority = html.escape(priority or "Medium")
    safe_ai_summary = html.escape(ai_summary or "No summary available.")
    safe_title = html.escape(ticket_title or f"Ticket #{ticket_id}")
    safe_category = html.escape(category or "General")

    # Determine badge color based on priority
    p_lower = safe_priority.lower()
    if "high" in p_lower:
        badge_bg = "#fee2e2"
        badge_color = "#b91c1c"
        badge_border = "#fca5a5"
    elif "low" in p_lower:
        badge_bg = "#dcfce7"
        badge_color = "#15803d"
        badge_border = "#86efac"
    else:
        badge_bg = "#fef3c7"
        badge_color = "#b45309"
        badge_border = "#fcd34d"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Ticket Notification #{safe_ticket_id}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 32px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-bottom: 1px solid #334155;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: inline-block; font-size: 12px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px;">AI-Supported Ticket System</span>
                    <h1 style="margin: 6px 0 0 0; font-size: 20px; font-weight: 700; color: #f8fafc;">New Assigned Ticket #{safe_ticket_id}</h1>
                  </td>
                  <td align="right" valign="top">
                    <span style="display: inline-block; padding: 4px 10px; font-size: 12px; font-weight: 600; border-radius: 6px; background-color: {badge_bg}; color: {badge_color}; border: 1px solid {badge_border};">
                      {safe_priority} Priority
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Core Details Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #94a3b8; line-height: 1.5;">
                A new ticket requiring your attention has been registered in category <strong>{safe_category}</strong>.
              </p>

              <!-- Metadata Table -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; background-color: #0f172a; border-radius: 8px; border: 1px solid #334155; padding: 16px;">
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #94a3b8; width: 140px;"><strong>Ticket ID:</strong></td>
                  <td style="padding: 8px 12px; font-size: 14px; color: #f8fafc; font-weight: 600;">#{safe_ticket_id}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #94a3b8;"><strong>Consumer Name:</strong></td>
                  <td style="padding: 8px 12px; font-size: 14px; color: #f8fafc; font-weight: 600;">{safe_consumer_name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #94a3b8;"><strong>Priority:</strong></td>
                  <td style="padding: 8px 12px; font-size: 14px; color: #f8fafc; font-weight: 600;">{safe_priority}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #94a3b8;"><strong>Category:</strong></td>
                  <td style="padding: 8px 12px; font-size: 14px; color: #38bdf8;">{safe_category}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #94a3b8;"><strong>Title:</strong></td>
                  <td style="padding: 8px 12px; font-size: 14px; color: #f8fafc;">{safe_title}</td>
                </tr>
              </table>

              <!-- AI Summary Card -->
              <div style="margin-bottom: 24px; background-color: #1e1b4b; border-left: 4px solid #818cf8; border-radius: 6px; padding: 16px 20px;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #a5b4fc; letter-spacing: 0.5px; margin-bottom: 8px;">
                  🤖 AI Summary
                </div>
                <div style="font-size: 14px; line-height: 1.6; color: #e0e7ff;">
                  {safe_ai_summary}
                </div>
              </div>

              <!-- Call to Action Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-top: 8px;">
                    <a href="http://localhost:3000" target="_blank" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 6px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);">
                      View Ticket in Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 32px; background-color: #0f172a; border-top: 1px solid #334155; text-align: center; font-size: 12px; color: #64748b;">
              AI Ticket Workspace • Automated Non-Blocking Notification Service
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def build_ticket_notification_text(
    ticket_id: int,
    consumer_name: str,
    priority: str,
    ai_summary: str,
    ticket_title: Optional[str] = None,
    category: Optional[str] = None,
) -> str:
    """Generate a clean plain text fallback for the notification email."""
    title_str = f" - {ticket_title}" if ticket_title else ""
    return (
        f"AI-Supported Ticket System Notification\n"
        f"=========================================\n"
        f"New Assigned Ticket #{ticket_id}{title_str}\n\n"
        f"Ticket ID:     #{ticket_id}\n"
        f"Consumer Name: {consumer_name or 'Anonymous Consumer'}\n"
        f"Priority:      {priority or 'Medium'}\n"
        f"Category:      {category or 'General'}\n"
        f"Title:         {ticket_title or 'Untitled Ticket'}\n\n"
        f"AI Summary:\n"
        f"-----------\n"
        f"{ai_summary or 'No summary available.'}\n\n"
        f"Access your dashboard at http://localhost:3000\n"
    )


def send_email(
    to_email: Union[str, List[str]],
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    host: Optional[str] = None,
    port: Optional[int] = None,
    from_email: Optional[str] = None,
    timeout: float = 10.0,
) -> bool:
    """
    Send an HTML/Multipart email via SMTP to the target host and port.
    Catches errors cleanly and returns success status.
    """
    smtp_host = host or os.getenv("SMTP_HOST", DEFAULT_SMTP_HOST)
    smtp_port = port or int(os.getenv("SMTP_PORT", DEFAULT_SMTP_PORT))
    sender = from_email or os.getenv("SMTP_FROM_EMAIL", DEFAULT_FROM_EMAIL)

    recipients = [to_email] if isinstance(to_email, str) else to_email
    if not recipients:
        logger.warning("send_email called with empty recipients list.")
        return False

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = ", ".join(recipients)

    # Attach plain text fallback first
    plain_text = text_content or f"{subject}\n\nView this notification in an HTML-compatible email client."
    message.attach(MIMEText(plain_text, "plain", "utf-8"))

    # Attach HTML payload
    message.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        with smtplib.SMTP(host=smtp_host, port=smtp_port, timeout=timeout) as server:
            server.sendmail(sender, recipients, message.as_string())
        logger.info(f"Notification email dispatched via SMTP {smtp_host}:{smtp_port} to {recipients}.")
        return True
    except (smtplib.SMTPException, OSError, ConnectionError) as exc:
        logger.error(f"Failed to send email via SMTP {smtp_host}:{smtp_port} to {recipients}: {exc}")
        return False


def send_ticket_creation_notification(
    ticket_id: int,
    category: Union[str, TicketCategory],
    consumer_name: str,
    priority: Union[str, TicketPriority],
    ai_summary: str,
    ticket_title: Optional[str] = None,
    db_session: Optional[Session] = None,
    host: Optional[str] = None,
    port: Optional[int] = None,
) -> int:
    """
    Background task worker invoked when a ticket is created.
    1. Looks up all Users where role='responsible' and assigned_category=category.
    2. Constructs and dispatches an HTML email via SMTP to localhost:1025 (or configured host:port)
       containing Ticket ID, Consumer Name, Priority, and AI Summary.
    3. Handles errors gracefully so the consumer experience remains fast and uninterrupted.
    """
    category_str = category.value if hasattr(category, "value") else str(category)
    priority_str = priority.value if hasattr(priority, "value") else str(priority)

    # Manage dedicated database session for background task
    session = db_session
    should_close_session = False
    if session is None:
        session = SessionLocal()
        should_close_session = True

    try:
        # Requirement 1: Lookup all Users where role='responsible' and assigned_category=C
        responsible_users = get_responsible_users_for_category(category_str, session)

        if not responsible_users:
            logger.info(
                f"[BackgroundTask] No responsible users found for category '{category_str}' "
                f"(Ticket #{ticket_id}). Notification skipped."
            )
            return 0

        # Requirement 2: Prepare email containing Ticket ID, Consumer Name, Priority, and AI Summary
        subject = f"New Ticket #{ticket_id}: [{priority_str}] {ticket_title or 'Notification'}"
        html_body = build_ticket_notification_html(
            ticket_id=ticket_id,
            consumer_name=consumer_name,
            priority=priority_str,
            ai_summary=ai_summary,
            ticket_title=ticket_title,
            category=category_str,
        )
        text_body = build_ticket_notification_text(
            ticket_id=ticket_id,
            consumer_name=consumer_name,
            priority=priority_str,
            ai_summary=ai_summary,
            ticket_title=ticket_title,
            category=category_str,
        )

        sent_count = 0
        for user in responsible_users:
            if not user.email:
                continue
            success = send_email(
                to_email=user.email,
                subject=subject,
                html_content=html_body,
                text_content=text_body,
                host=host,
                port=port,
            )
            if success:
                sent_count += 1

        logger.info(
            f"[BackgroundTask] Successfully sent {sent_count}/{len(responsible_users)} "
            f"notification email(s) for Ticket #{ticket_id} (Category: '{category_str}')."
        )
        return sent_count

    except Exception as exc:
        logger.error(
            f"[BackgroundTask] Unexpected error in send_ticket_creation_notification for Ticket #{ticket_id}: {exc}",
            exc_info=True,
        )
        return 0
    finally:
        if should_close_session and session is not None:
            session.close()
