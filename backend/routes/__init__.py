"""Routes module for Gracefy backend."""
from .music import router as music_router
from .home import router as home_router
from .payment import router as payment_router

__all__ = [
    'music_router',
    'home_router', 
    'payment_router',
]
