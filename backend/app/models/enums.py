from enum import Enum


class TicketCategory(str, Enum):
    """Ticket category options as required by business domain."""
    FINANCE = "Finance"
    LEGAL = "Legal"
    OPERATIONS = "Operations"
    IT_SUPPORT = "IT Support"
    HUMAN_RESOURCES = "Human Resources"
    CUSTOMER_SUCCESS = "Customer Success"


class TicketPriority(str, Enum):
    """Ticket priority levels."""
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class TicketStatus(str, Enum):
    """Ticket workflow states."""
    OPEN = "Open"
    IN_PROGRESS = "In Progress"
    RESOLVED = "Resolved"
    CLOSED = "Closed"


class UserRole(str, Enum):
    """System user authorization roles."""
    OWNER = "Owner"
    RESPONSIBLE = "Responsible"


class CommentAuthorRole(str, Enum):
    """Role/Identity of the comment author."""
    OWNER = "Owner"
    RESPONSIBLE = "Responsible"
    CUSTOMER = "Customer"
    AI_ASSISTANT = "AI Assistant"
