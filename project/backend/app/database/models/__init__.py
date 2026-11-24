"""Re-exports all ORM model classes so they register on Base.metadata and can be imported from a single module."""

from app.database.models.audit import AuditLog, Notification, SecurityEvent, SystemEvent
from app.database.models.chat import ChatConversation, ChatMessage, ChatToolExecution
from app.database.models.identity import LoginEvent, Permission, Role, RolePermission, User, UserSession
from app.database.models.logistics import (
    DocumentExtraction,
    DocumentValidation,
    Shipment,
    ShipmentDocument,
    ShipmentEvent,
    Vessel,
    VesselPosition,
)
from app.database.models.review import ReviewDecision, ReviewEvidence, ReviewRequest
from app.database.models.workflow import (
    AgentResult,
    AgentRun,
    CongestionForecast,
    RiskAssessment,
    SchedulingRecommendation,
    Workflow,
)

__all__ = [
    "AuditLog", "Notification", "SecurityEvent", "SystemEvent",
    "ChatConversation", "ChatMessage", "ChatToolExecution",
    "LoginEvent", "Permission", "Role", "RolePermission", "User", "UserSession",
    "DocumentExtraction", "DocumentValidation", "Shipment", "ShipmentDocument",
    "ShipmentEvent", "Vessel", "VesselPosition",
    "ReviewDecision", "ReviewEvidence", "ReviewRequest",
    "AgentResult", "AgentRun", "CongestionForecast", "RiskAssessment",
    "SchedulingRecommendation", "Workflow",
]
