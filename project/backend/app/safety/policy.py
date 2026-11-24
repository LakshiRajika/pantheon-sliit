"""Declarative safety policy: blocked topics, actions requiring human approval, and the possible safety decisions."""

from enum import StrEnum


class SafetyAction(StrEnum):
    ALLOW = "ALLOW"
    REDACT_AND_ALLOW = "REDACT_AND_ALLOW"
    BLOCK = "BLOCK"
    ESCALATE = "ESCALATE"


# Central allow/block policy. Keep business rules declarative here instead of
# scattering ad hoc `if` checks through agents and chat handlers.
BLOCKED_TOPICS = [
    "generate fake customs certificate",
    "bypass inspection",
    "falsify bill of lading",
]

CONSEQUENTIAL_ACTIONS = {
    # Actions an assistant/agent may recommend but never finalize unsupervised.
    "approve_clearance",
    "override_risk_flag",
    "release_shipment",
}


def is_blocked_topic(text: str) -> bool:
    """Check whether the text mentions any topic on the blocked-topics list, case-insensitively."""
    lowered = text.lower()
    return any(topic in lowered for topic in BLOCKED_TOPICS)


def is_consequential_action(action_name: str) -> bool:
    """Check whether an action name is one that requires human approval rather than autonomous execution."""
    return action_name in CONSEQUENTIAL_ACTIONS
