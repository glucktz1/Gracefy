"""
Pydantic models for Gracefy application.
All data models used across the application.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid


# ============== USER MODELS ==============

class UserBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str = Field(default_factory=lambda: f"user_{uuid.uuid4().hex[:12]}")
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "customer"  # customer, admin, moderator, content_manager
    status: str = "active"  # active, suspended, pending
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserSession(BaseModel):
    session_id: str = Field(default_factory=lambda: f"sess_{uuid.uuid4().hex}")
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============== CONTENT MODELS ==============

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    category_id: str = Field(default_factory=lambda: f"cat_{uuid.uuid4().hex[:12]}")
    name: str
    description: Optional[str] = None
    type: str = "content"  # content, music, sermon, podcast
    icon: Optional[str] = None
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Album(BaseModel):
    model_config = ConfigDict(extra="ignore")
    album_id: str = Field(default_factory=lambda: f"alb_{uuid.uuid4().hex[:12]}")
    title: str
    description: Optional[str] = None
    artist_id: Optional[str] = None
    artist_name: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    thumbnail: Optional[str] = None
    release_date: Optional[str] = None
    monetization_type: str = "free"  # free, standard, premium
    status: str = "active"  # active, inactive
    songs_count: int = 0
    total_plays: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Song(BaseModel):
    model_config = ConfigDict(extra="ignore")
    song_id: str = Field(default_factory=lambda: f"song_{uuid.uuid4().hex[:12]}")
    title: str
    album_id: str
    duration: Optional[int] = None  # in seconds
    duration_formatted: Optional[str] = None  # "3:45" format
    audio_url: Optional[str] = None
    lyrics: Optional[str] = None
    track_number: Optional[int] = None
    plays: int = 0
    likes: int = 0
    status: str = "active"  # active, inactive
    song_categories: List[str] = []  # List of song_category_id values
    song_category_names: List[str] = []  # List of category names for display
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SongCategory(BaseModel):
    """Categories for songs - Christmas, Easter, Lent, etc."""
    model_config = ConfigDict(extra="ignore")
    song_category_id: str = Field(default_factory=lambda: f"songcat_{uuid.uuid4().hex[:12]}")
    name: str
    name_sw: Optional[str] = None  # Swahili name
    description: Optional[str] = None
    color: str = "#6366f1"  # Default indigo color for UI display
    icon: Optional[str] = None  # Icon name for UI
    sort_order: int = 0
    is_system: bool = False  # System categories cannot be deleted
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============== CHURCH & CHOIR MODELS ==============

class Church(BaseModel):
    model_config = ConfigDict(extra="ignore")
    church_id: str = Field(default_factory=lambda: f"church_{uuid.uuid4().hex[:12]}")
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    address: Optional[str] = None
    thumbnail: Optional[str] = None
    cover_image: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    social_links: dict = {}
    schedule: dict = {}
    leaders: List[str] = []
    choirs: List[str] = []
    members_count: int = 0
    followers_count: int = 0
    status: str = "pending"  # pending, approved, rejected
    submitted_by: Optional[str] = None
    approved_by: Optional[str] = None
    approval_date: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Singer(BaseModel):
    """Choir/Artist model"""
    model_config = ConfigDict(extra="ignore")
    singer_id: str = Field(default_factory=lambda: f"singer_{uuid.uuid4().hex[:12]}")
    name: str
    email: Optional[str] = None
    bio: Optional[str] = None
    thumbnail: Optional[str] = None
    cover_image: Optional[str] = None
    social_links: dict = {}
    followers_count: int = 0
    is_verified: bool = False
    church_id: Optional[str] = None
    church_name: Optional[str] = None
    genres: List[str] = []
    albums_count: int = 0
    total_plays: int = 0
    status: str = "pending"  # pending, approved, rejected
    registration_date: Optional[str] = None
    approval_date: Optional[str] = None
    approval_status: str = "pending"
    password_hash: Optional[str] = None
    login_enabled: bool = False
    payment_details: dict = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============== PAYMENT MODELS ==============

class PaymentGateway(BaseModel):
    gateway_id: str = Field(default_factory=lambda: f"gw_{uuid.uuid4().hex[:12]}")
    name: str
    gateway_type: str  # mobile_money, card, bank
    provider: str  # mpesa, tigopesa, airtel, stripe
    is_active: bool = True
    credentials: dict = {}
    config: dict = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Transaction(BaseModel):
    transaction_id: str = Field(default_factory=lambda: f"txn_{uuid.uuid4().hex[:12]}")
    user_id: str
    user_email: Optional[str] = None
    user_phone: Optional[str] = None
    gateway_id: str
    gateway_name: str
    gateway_type: str = "mobile_money"
    payment_method: str = "mobile_money"
    amount: float
    currency: str = "TZS"
    amount_usd: Optional[float] = None
    plan_id: str
    plan_name: str
    plan_duration_days: int = 30
    status: str = "pending"  # pending, completed, failed, cancelled
    phone_number: Optional[str] = None
    external_ref: Optional[str] = None
    initiated_at: Optional[str] = None
    completed_at: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SubscriptionPlan(BaseModel):
    plan_id: str = Field(default_factory=lambda: f"plan_{uuid.uuid4().hex[:12]}")
    name: str
    display_name: Optional[str] = None
    description: Optional[str] = None
    price: float
    currency: str = "TZS"
    duration_days: int = 30
    features: List[str] = []
    is_active: bool = True
    sort_order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============== LAYOUT MODELS ==============

class LayoutSection(BaseModel):
    model_config = ConfigDict(extra="ignore")
    section_id: str = Field(default_factory=lambda: f"sec_{uuid.uuid4().hex[:12]}")
    title: str
    display_name: Optional[str] = None
    display_name_en: Optional[str] = None
    description: Optional[str] = None
    section_type: str  # hero, featured_albums, trending, quick_access, etc.
    content_type: str = "albums"  # albums, categories, special_mixes, choirs, churches
    content_ids: List[str] = []
    content_count: int = 10
    platforms: List[str] = ["app", "web"]
    sort_order: int = 0
    is_active: bool = True
    background_gradient: Optional[str] = None
    background_color: Optional[str] = None
    filter_category: Optional[str] = None
    custom_filter: Optional[dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============== ANALYTICS MODELS ==============

class PageView(BaseModel):
    model_config = ConfigDict(extra="ignore")
    view_id: str = Field(default_factory=lambda: f"pv_{uuid.uuid4().hex[:12]}")
    session_id: str
    user_id: Optional[str] = None
    page_type: str  # home, album, song, church, search, etc.
    page_id: Optional[str] = None  # ID of album/song/etc if applicable
    page_path: Optional[str] = None  # e.g., "/album/123", "/checkout"
    referrer: Optional[str] = None
    device_type: Optional[str] = None  # mobile, tablet, desktop
    platform: Optional[str] = None  # ios, android, web
    time_on_page: int = 0  # in seconds
    scroll_depth: int = 0  # percentage
    interactions: dict = {}  # clicks, plays, etc.
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ListeningSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str = Field(default_factory=lambda: f"ls_{uuid.uuid4().hex[:12]}")
    user_id: Optional[str] = None
    song_id: str
    album_id: Optional[str] = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: Optional[datetime] = None
    duration_played: int = 0  # in seconds
    completed: bool = False
    skip_count: int = 0
    platform: Optional[str] = None


# ============== LEADER CONTENT MODELS ==============

class ContentContainer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    container_id: str = Field(default_factory=lambda: f"cont_{uuid.uuid4().hex[:12]}")
    name: str
    description: Optional[str] = None
    thumbnail: Optional[str] = None
    cover_image: Optional[str] = None
    category: str = "mafundisho"  # mafundisho, mahubiri, etc.
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    author_type: str = "leader"  # leader, church, organization
    church_id: Optional[str] = None
    church_name: Optional[str] = None
    series_count: int = 0
    episodes_count: int = 0
    total_plays: int = 0
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ContentSeries(BaseModel):
    model_config = ConfigDict(extra="ignore")
    series_id: str = Field(default_factory=lambda: f"ser_{uuid.uuid4().hex[:12]}")
    container_id: str
    title: str
    description: Optional[str] = None
    thumbnail: Optional[str] = None
    sort_order: int = 0
    episodes_count: int = 0
    total_plays: int = 0
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ContentEpisode(BaseModel):
    model_config = ConfigDict(extra="ignore")
    episode_id: str = Field(default_factory=lambda: f"ep_{uuid.uuid4().hex[:12]}")
    series_id: str
    container_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    audio_url: Optional[str] = None
    duration: Optional[int] = None  # in seconds
    duration_formatted: Optional[str] = None
    sort_order: int = 0
    plays: int = 0
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
