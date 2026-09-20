# Database Architecture & Data Flow

The **AI-Supported Ticket System** utilizes **PostgreSQL 16 Alpine** as its primary relational database engine. Object Relational Mapping (ORM) and schema modeling are managed through **SQLAlchemy 2.0**, leveraging modern typed Declarative Mappings (`Mapped`, `mapped_column`) and relationships.

---

## 🗄️ Relational Architecture & ER Diagram

```mermaid
erDiagram
    USERS ||--o{ TICKETS : "assigned_tickets (assignee_id)"
    USERS ||--o{ TICKETS : "created_tickets (creator_id)"
    USERS ||--o{ COMMENTS : "comments (author_id)"
    TICKETS ||--o{ COMMENTS : "comments (ticket_id)"

    USERS {
        int id PK "autoincrement"
        string email UK "indexed, not null"
        string full_name "nullable"
        string password_hash "PBKDF2-HMAC-SHA256, not null"
        enum role "Owner | Responsible"
        string assigned_category "nullable"
        boolean is_active "default true, not null"
        datetime created_at "UTC timestamp"
        datetime updated_at "UTC timestamp"
    }

    TICKETS {
        int id PK "autoincrement"
        string title "max 255, not null"
        text description "not null"
        enum category "indexed, not null"
        enum priority "Low | Medium | High, not null"
        enum status "indexed, Open | In Progress | Resolved | Closed"
        int creator_id FK "nullable, ondelete SET NULL"
        int assignee_id FK "nullable, ondelete SET NULL"
        string consumer_name "nullable"
        string consumer_email "nullable"
        string ai_classification "nullable"
        float ai_confidence "nullable"
        text ai_summary "nullable"
        datetime created_at "UTC timestamp"
        datetime updated_at "UTC timestamp"
    }

    COMMENTS {
        int id PK "autoincrement"
        int ticket_id FK "indexed, not null, ondelete CASCADE"
        int author_id FK "indexed, nullable, ondelete SET NULL"
        string author_role "not null"
        text content "not null"
        boolean is_internal "default false, not null"
        datetime created_at "UTC timestamp"
        datetime updated_at "UTC timestamp"
    }
```

---

## 📋 Entity Specifications & Schema Details

### 1. `users` Table
Stores registered operators and administrators.
- **`id`**: Integer Primary Key, Auto-increment.
- **`email`**: String(255), Unique, Indexed. Normalized to lowercase during lookup.
- **`full_name`**: String(255), Optional human-readable display name.
- **`password_hash`**: String(255), PBKDF2-HMAC-SHA256 hashed password with 16-byte random salt.
- **`role`**: Enum (`Owner`, `Responsible`).
- **`assigned_category`**: String(100), Optional department routing assignment (`Finance`, `Legal`, `Operations`, `IT Support`, `Human Resources`, `Customer Success`).
- **`is_active`**: Boolean, Default `True`. Inactive operators cannot authenticate.
- **`created_at` / `updated_at`**: Automatic UTC timestamps managed via `TimestampMixin`.

### 2. `tickets` Table
Represents customer support inquiries or internal incident tickets.
- **`id`**: Integer Primary Key, Auto-increment.
- **`title`**: String(255), Issue summary or subject line.
- **`description`**: Text, Detailed problem report.
- **`category`**: Enum (`Finance`, `Legal`, `Operations`, `IT Support`, `Human Resources`, `Customer Success`). Indexed for fast category filtering.
- **`priority`**: Enum (`High`, `Medium`, `Low`). Default `Medium`.
- **`status`**: Enum (`Open`, `In Progress`, `Resolved`, `Closed`). Default `Open`. Indexed for active ticket retrieval.
- **`creator_id`**: Integer ForeignKey (`users.id`, `ondelete="SET NULL"`). Optional operator who initiated the ticket.
- **`assignee_id`**: Integer ForeignKey (`users.id`, `ondelete="SET NULL"`). Optional operator assigned to work on the issue.
- **`consumer_name`**: String(255), Full name of the requester.
- **`consumer_email`**: String(255), Email address for automated updates.
- **`ai_classification`**: String(255), Department category identified by Google Gemini.
- **`ai_confidence`**: Float, Model confidence score (0.0 - 1.0).
- **`ai_summary`**: Text, Executive 1-2 sentence issue summary synthesized by AI.

### 3. `comments` Table
Maintains the audit trail and communication thread for each ticket.
- **`id`**: Integer Primary Key, Auto-increment.
- **`ticket_id`**: Integer ForeignKey (`tickets.id`, `ondelete="CASCADE"`). Deleting a ticket removes its associated comments automatically.
- **`author_id`**: Integer ForeignKey (`users.id`, `ondelete="SET NULL"`).
- **`author_role`**: String(50), Indicates origin (`Owner`, `Responsible`, `Customer`, `AI Assistant`).
- **`content`**: Text, Message or internal note.
- **`is_internal`**: Boolean, Default `False`. If `True`, hidden from external consumer view.

---

## ⚡ Indexing & Performance Strategy

To ensure sub-millisecond query performance as ticket volume scales, several strategic indexes are enforced:

| Index Name | Table | Columns | Purpose |
| :--- | :--- | :--- | :--- |
| `ix_tickets_category_status` | `tickets` | `(category, status)` | Explicit composite index optimized for department dashboards filtering active tickets by category. |
| `ix_tickets_category` | `tickets` | `category` | High-speed single-column filtering across department queues. |
| `ix_tickets_status` | `tickets` | `status` | Rapid separation of open vs. resolved/closed tickets. |
| `ix_users_email` | `users` | `email` | Instant operator authentication lookups. |
| `ix_comments_ticket_id` | `comments` | `ticket_id` | Fast chronological conversation retrieval with order by `created_at`. |
| `ix_tickets_assignee_id` | `tickets` | `assignee_id` | Fast lookup of tickets assigned to a specific operator. |

---

## 🔄 End-to-End Data Flow

### 1. Ticket Submission Data Flow
```mermaid
sequenceDiagram
    autonumber
    actor Consumer as Consumer / Frontend
    participant API as FastAPI /api/tickets
    participant AI as Gemini AI Service
    participant DB as PostgreSQL Database
    participant BG as BackgroundTasks Worker
    participant SMTP as MailDev SMTP

    Consumer->>API: POST /api/tickets (title, desc, consumer_name, consumer_email)
    API->>AI: classify_ticket(consumer_name, text)
    AI-->>API: TicketClassification(category, priority, summary)
    API->>DB: INSERT INTO tickets (category, priority, ai_summary, ...)
    DB-->>API: Ticket Record (id=42, status='Open')
    API->>BG: enqueue send_ticket_creation_notification(id=42, ...)
    API-->>Consumer: HTTP 201 Created (Ticket #42)
    Note over API,Consumer: Consumer gets response immediately without waiting for SMTP

    BG->>DB: SELECT * FROM users WHERE role='Responsible' AND assigned_category='IT Support'
    DB-->>BG: List of responsible operators
    BG->>SMTP: SMTP sendmail() to operators with HTML payload
```

### 2. Comment Posting & Consumer Notification Flow
```mermaid
sequenceDiagram
    autonumber
    actor Lead as Operator (Responsible Lead)
    participant API as FastAPI /api/tickets/{id}/comments
    participant DB as PostgreSQL Database
    participant BG as BackgroundTasks Worker
    participant SMTP as MailDev SMTP
    actor Consumer as Consumer Inbox

    Lead->>API: POST /api/tickets/42/comments (content="Fix deployed", author_role="Responsible")
    API->>DB: INSERT INTO comments (ticket_id=42, content, ...)
    DB-->>API: Comment Record (id=101)
    API->>BG: enqueue send_comment_notification(ticket_id=42, consumer_email, ...)
    API-->>Lead: HTTP 201 Created (Comment #101)

    BG->>SMTP: Dispatch HTML email update
    SMTP-->>Consumer: "Update on Ticket #42: [In Progress]"
```

---

## 🔌 Connection & Session Management

Database sessions are managed via standard FastAPI dependency injection:
- **Connection URL**: Configured via `DATABASE_URL` environment variable:
  `postgresql://postgres:postgres@postgres:5432/ticket_system`
- **Engine Configuration**:
  ```python
  engine = create_engine(
      DATABASE_URL,
      pool_pre_ping=True,  # Automatically verifies connection liveness before checkout
  )
  ```
- **Session Lifecycle**: Each HTTP request borrows a `SessionLocal()` via the `get_db` generator, committing or rolling back as needed, and unconditionally closing the session in a `finally` block to prevent connection leaks.
- **Background Tasks**: Workers spawned by `BackgroundTasks` instantiate their own dedicated database session rather than sharing the request session, avoiding concurrency errors or premature connection closing.
