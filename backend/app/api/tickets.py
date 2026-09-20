from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.models.comment import Comment
from app.models.enums import TicketCategory, TicketPriority, TicketStatus
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.ai import TicketClassification, TicketTriageRequest
from app.schemas.comment import CommentCreate, CommentRead
from app.schemas.ticket import TicketCreate, TicketDetailRead, TicketRead, TicketUpdate
from app.services.notification import send_comment_notification, send_ticket_creation_notification
from app.services.triage import aclassify_ticket, classify_ticket

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])


@router.post("/triage", response_model=TicketClassification, summary="AI Triage Ticket")
async def triage_ticket_endpoint(request_in: TicketTriageRequest) -> TicketClassification:
    """
    Classify a support ticket using Gemini AI into database-compatible category and priority,
    returning structured JSON with category, priority, and summary.
    Includes network timeout fallback logic.
    """
    return await aclassify_ticket(
        consumer_name=request_in.consumer_name,
        request_text=request_in.request_text,
        attachment_url=request_in.attachment_url,
        title=request_in.title,
        description=request_in.description,
    )


@router.post("/classify", response_model=TicketClassification, summary="AI Classify Ticket (Alias)")
async def classify_ticket_endpoint(request_in: TicketTriageRequest) -> TicketClassification:
    """Alias for /triage endpoint."""
    return await aclassify_ticket(
        consumer_name=request_in.consumer_name,
        request_text=request_in.request_text,
        attachment_url=request_in.attachment_url,
        title=request_in.title,
        description=request_in.description,
    )


@router.post("", response_model=TicketRead, status_code=status.HTTP_201_CREATED, summary="Create a Ticket")
def create_ticket(
    ticket_in: TicketCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> TicketRead:
    # Validate assignee exists if provided
    if ticket_in.assignee_id is not None:
        assignee = db.get(User, ticket_in.assignee_id)
        if not assignee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assignee user with ID {ticket_in.assignee_id} not found.",
            )

    category = ticket_in.category
    priority = ticket_in.priority
    ai_summary = ticket_in.ai_summary

    # If category or ai_summary is omitted, automatically run AI triage
    if category is None or ai_summary is None:
        try:
            req_text = f"Title: {ticket_in.title}\n\nDetailed Description:\n{ticket_in.description}"
            c_name = ticket_in.consumer_name or "Anonymous Consumer"
            ai_res = classify_ticket(
                consumer_name=c_name,
                request_text=req_text,
                title=ticket_in.title,
                description=ticket_in.description,
            )
            if category is None:
                category = TicketCategory(ai_res.category)
            if ai_summary is None:
                ai_summary = ai_res.summary
            if ticket_in.priority == TicketPriority.MEDIUM and ai_res.priority:
                priority = TicketPriority(ai_res.priority)
        except Exception as exc:
            if category is None:
                category = TicketCategory.IT_SUPPORT
            if ai_summary is None:
                ai_summary = ticket_in.description[:200]

    db_ticket = Ticket(
        title=ticket_in.title,
        description=ticket_in.description,
        category=category,
        priority=priority,
        status=ticket_in.status,
        assignee_id=ticket_in.assignee_id,
        consumer_name=ticket_in.consumer_name,
        consumer_email=ticket_in.consumer_email,
        ai_summary=ai_summary,
    )
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)

    # Dispatch asynchronous non-blocking notification via FastAPI BackgroundTasks
    category_val = (
        db_ticket.category.value
        if hasattr(db_ticket.category, "value")
        else str(db_ticket.category)
    )
    priority_val = (
        db_ticket.priority.value
        if hasattr(db_ticket.priority, "value")
        else str(db_ticket.priority)
    )
    background_tasks.add_task(
        send_ticket_creation_notification,
        ticket_id=db_ticket.id,
        category=category_val,
        consumer_name=db_ticket.consumer_name or "Anonymous Consumer",
        priority=priority_val,
        ai_summary=db_ticket.ai_summary or db_ticket.description,
        ticket_title=db_ticket.title,
    )

    return db_ticket


@router.patch("/{ticket_id}", response_model=TicketRead, summary="Update a Ticket")
def update_ticket(
    ticket_id: int,
    ticket_in: TicketUpdate,
    db: Session = Depends(get_db),
) -> TicketRead:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket with ID {ticket_id} not found.",
        )

    update_data = ticket_in.model_dump(exclude_unset=True)
    if "assignee_id" in update_data and update_data["assignee_id"] is not None:
        assignee = db.get(User, update_data["assignee_id"])
        if not assignee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assignee user with ID {update_data['assignee_id']} not found.",
            )

    for field, value in update_data.items():
        setattr(ticket, field, value)

    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("", response_model=List[TicketRead], summary="List and Filter Tickets")
def list_tickets(
    category: Optional[TicketCategory] = Query(default=None, description="Filter by category"),
    status_filter: Optional[TicketStatus] = Query(default=None, alias="status", description="Filter by status"),
    priority: Optional[TicketPriority] = Query(default=None, description="Filter by priority"),
    db: Session = Depends(get_db),
) -> List[TicketRead]:
    stmt = select(Ticket)
    if category:
        stmt = stmt.where(Ticket.category == category)
    if status_filter:
        stmt = stmt.where(Ticket.status == status_filter)
    if priority:
        stmt = stmt.where(Ticket.priority == priority)

    stmt = stmt.order_by(Ticket.created_at.desc())
    tickets = db.scalars(stmt).all()
    return tickets


@router.get("/{ticket_id}", response_model=TicketDetailRead, summary="Get Ticket Details with Comments")
def get_ticket(ticket_id: int, db: Session = Depends(get_db)) -> TicketDetailRead:
    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(
            selectinload(Ticket.comments),
            selectinload(Ticket.assignee),
            selectinload(Ticket.creator),
        )
    )
    ticket = db.scalars(stmt).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket with ID {ticket_id} not found.",
        )
    return ticket


@router.delete("/{ticket_id}", status_code=status.HTTP_200_OK, summary="Delete a Ticket")
def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket with ID {ticket_id} not found.",
        )
    db.delete(ticket)
    db.commit()
    return {"message": f"Ticket #{ticket_id} successfully deleted."}


@router.post("/{ticket_id}/comments", response_model=CommentRead, status_code=status.HTTP_201_CREATED, summary="Add Comment to Ticket")
def add_comment(
    ticket_id: int,
    comment_in: CommentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> CommentRead:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket with ID {ticket_id} not found.",
        )

    # Optional author validation
    if comment_in.author_id is not None:
        author = db.get(User, comment_in.author_id)
        if not author:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Author user with ID {comment_in.author_id} not found.",
            )

    author_role_str = (
        comment_in.author_role.value
        if hasattr(comment_in.author_role, "value")
        else str(comment_in.author_role)
    )

    db_comment = Comment(
        ticket_id=ticket_id,
        author_id=comment_in.author_id,
        author_role=author_role_str,
        content=comment_in.content,
        is_internal=comment_in.is_internal,
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)

    # Dispatch asynchronous non-blocking notification to consumer if consumer email is present
    target_consumer_email = ticket.consumer_email
    if not target_consumer_email and ticket.creator_id and ticket.creator:
        target_consumer_email = ticket.creator.email

    if target_consumer_email:
        status_val = (
            ticket.status.value
            if hasattr(ticket.status, "value")
            else str(ticket.status)
        )
        background_tasks.add_task(
            send_comment_notification,
            ticket_id=ticket.id,
            consumer_email=target_consumer_email,
            ticket_title=ticket.title,
            ticket_status=status_val,
            comment_content=db_comment.content,
            author_role=author_role_str,
            is_internal=db_comment.is_internal,
        )

    return db_comment


@router.get("/{ticket_id}/comments", response_model=List[CommentRead], summary="List Comments on Ticket")
def list_comments(ticket_id: int, db: Session = Depends(get_db)) -> List[CommentRead]:
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket with ID {ticket_id} not found.",
        )
    stmt = select(Comment).where(Comment.ticket_id == ticket_id).order_by(Comment.created_at.asc())
    comments = db.scalars(stmt).all()
    return comments
