"""Enumeration of the user role names recognized by the system's RBAC model."""

from enum import StrEnum


class RoleName(StrEnum):
    SHIPPING_AGENT = "shipping_agent"
    CUSTOMS_OFFICER = "customs_officer"
    PORT_OPERATIONS = "port_operations"
    IMPORTER_EXPORTER = "importer_exporter"
    MANAGEMENT = "management"
    ADMIN = "admin"
