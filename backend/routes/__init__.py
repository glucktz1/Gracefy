"""
Routes module for Gracefy backend.
All modular routers are exported here for inclusion in the main app.
"""

from .auth import router as auth_router
from .music import router as music_router
from .home import router as home_router
from .payment import router as payment_router
from .layout import router as layout_router
from .churches import router as churches_router
from .choirs import router as choirs_router
from .bible import router as bible_router
from .analytics import router as analytics_router
from .admin import router as admin_router
from .uploads import router as uploads_router
from .user_library import router as user_library_router
from .content import router as content_router
from .monetization import router as monetization_router

__all__ = [
    'auth_router',
    'music_router',
    'home_router', 
    'payment_router',
    'layout_router',
    'churches_router',
    'choirs_router',
    'bible_router',
    'analytics_router',
    'admin_router',
    'uploads_router',
    'user_library_router',
    'content_router',
    'monetization_router',
]
