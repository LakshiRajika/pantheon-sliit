"""Analytics endpoints: aggregate dashboard metrics across shipments and workflows."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.database.models import User
from app.database.session import get_db
from app.permissions.permission_catalog import Permission
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
async def dashboard(user: User = Depends(require_permission(Permission.ANALYTICS_READ_AGGREGATE)), db: AsyncSession = Depends(get_db)):
    """Return aggregate dashboard metrics. Requires the ANALYTICS_READ_AGGREGATE permission."""
    service = AnalyticsService(db)
    return await service.dashboard()
