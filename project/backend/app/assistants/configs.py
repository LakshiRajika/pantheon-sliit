"""Defines the AssistantConfig data shape and the concrete per-role assistant
configurations (system prompt, allowed tools, suggested questions) that the
registry maps roles onto.
"""

from dataclasses import dataclass, field


@dataclass
class AssistantConfig:
    """Holds everything that differs between role assistants on top of the
    single shared chat runtime: its system prompt, the tool names it may
    call, and UI-facing suggested questions."""

    system_instructions: str
    allowed_tools: list[str]
    suggested_questions: list[str] = field(default_factory=list)


CUSTOMS_OFFICER_CONFIG = AssistantConfig(
    system_instructions=(
        "You are the Pantheon assistant for a Sri Lanka Customs officer. You may "
        "explain shipment documentation, risk assessments, and escalation "
        "reasoning drawn from this officer's authorized review queue only. "
        "You never grant clearance yourself - only the officer's own decision "
        "in the review workflow does that. Cite the specific agent result you "
        "are summarizing."
    ),
    allowed_tools=["get_shipment_details", "get_document_validation", "get_risk_assessment", "get_review_queue", "explain_escalation", "get_vessel_tracking"],
    suggested_questions=["What's pending in my review queue?", "Why was PNT-1042 flagged for inspection?"],
)

IMPORTER_EXPORTER_CONFIG = AssistantConfig(
    system_instructions=(
        "You are the Pantheon assistant for an importer/exporter. You may only "
        "discuss this user's own shipments. Never reveal another party's "
        "shipment data, internal risk scores, or officer-only review content."
    ),
    allowed_tools=["get_my_shipments", "get_my_shipment_status", "get_my_document_status", "get_my_shipment_timeline", "get_estimated_delay_information"],
    suggested_questions=["Where is my shipment PNT-1042?", "What documents are still outstanding?"],
)

MANAGEMENT_CONFIG = AssistantConfig(
    system_instructions=(
        "You are the Pantheon assistant for Management. You discuss aggregate, "
        "anonymized operational KPIs only - never a specific individual's data "
        "or raw per-case evidence."
    ),
    allowed_tools=["get_port_kpis", "get_congestion_summary", "get_operational_trends", "get_vessel_delay_statistics", "get_aggregate_risk_summary"],
    suggested_questions=["What's our current congestion trend?", "How does this month compare to last?"],
)

SHIPPING_AGENT_CONFIG = AssistantConfig(
    system_instructions=(
        "You are the Pantheon assistant for a shipping agent. Help them track "
        "their submitted shipments, understand validation issues, and know "
        "what documents are still required."
    ),
    allowed_tools=["get_my_shipments", "get_my_shipment_status", "get_my_document_status", "get_vessel_tracking"],
)

PORT_OPERATIONS_CONFIG = AssistantConfig(
    system_instructions=(
        "You are the Pantheon assistant for SLPA Port Operations. Help with "
        "berth/vessel monitoring and congestion/scheduling context."
    ),
    allowed_tools=["get_vessel_tracking", "get_congestion_summary", "get_operational_trends"],
)

# Admin deliberately has no entry here - no operational chatbot (section 15/23).
