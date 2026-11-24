"""Aggregates all v1 feature routers into a single APIRouter mounted by the main app."""

from fastapi import APIRouter

from app.api.v1 import admin, analytics, auth, chat, documents, reviews, shipments, tracking, users, workflows, ws

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(ws.router)
api_router.include_router(users.router)
api_router.include_router(shipments.router)
api_router.include_router(documents.router)
api_router.include_router(workflows.router)
api_router.include_router(reviews.router)
api_router.include_router(tracking.router)
api_router.include_router(analytics.router)
api_router.include_router(chat.router)
api_router.include_router(admin.router)
