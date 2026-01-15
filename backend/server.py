from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Request, Response
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="Spirit Songs Admin API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============== MODELS ==============

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Church(BaseModel):
    model_config = ConfigDict(extra="ignore")
    church_id: str = Field(default_factory=lambda: f"ch_{uuid.uuid4().hex[:12]}")
    name: str
    denomination: Optional[str] = None  # roman_catholic, lutheran, anglican, pentecostal, etc.
    location: str
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    direction: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_maps_url: Optional[str] = None
    bio: Optional[str] = None
    # Leader/Parish Priest info
    leader_name: Optional[str] = None
    leader_title: Optional[str] = None  # Parish Priest, Pastor, Reverend, etc.
    leader_phone: Optional[str] = None
    leader_email: Optional[str] = None
    leader_photo: Optional[str] = None
    # Images
    thumbnail: Optional[str] = None
    cover_image: Optional[str] = None
    gallery_images: Optional[List[str]] = None
    # Prayer schedule (structured)
    prayer_schedule: Optional[List[dict]] = None  # [{day, time, service_type, description}]
    # Contact info
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    # Social
    followers_count: int = 0
    # Admin
    submitted_by: Optional[str] = None
    submitted_by_email: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected, suspended
    admin_notes: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class ChurchAnnouncement(BaseModel):
    """Church announcements that auto-delete after 2 weeks"""
    model_config = ConfigDict(extra="ignore")
    announcement_id: str = Field(default_factory=lambda: f"ann_{uuid.uuid4().hex[:12]}")
    church_id: str
    church_name: Optional[str] = None
    date: str  # YYYY-MM-DD format
    title: str
    announcement_type: str = "general"  # general, offering, baptism, adoration, wedding, funeral, meeting, event, other
    description: Optional[str] = None
    time: Optional[str] = None  # If event has specific time
    location: Optional[str] = None  # If different from church
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None  # weekly, monthly
    status: str = "active"  # active, archived
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None  # Auto-set to 2 weeks from date

class UserFollow(BaseModel):
    """Track user follows for churches and choirs/artists"""
    model_config = ConfigDict(extra="ignore")
    follow_id: str = Field(default_factory=lambda: f"fol_{uuid.uuid4().hex[:12]}")
    user_id: str
    user_name: Optional[str] = None
    entity_type: str  # church, choir, artist, religious_leader
    entity_id: str
    entity_name: Optional[str] = None
    notifications_enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReligiousLeader(BaseModel):
    model_config = ConfigDict(extra="ignore")
    leader_id: str = Field(default_factory=lambda: f"lead_{uuid.uuid4().hex[:12]}")
    name: str
    title: str  # pastor, priest, catechist, bishop
    church_id: Optional[str] = None
    church_name: Optional[str] = None
    bio: Optional[str] = None
    photo: Optional[str] = None
    followers: int = 0
    is_verified: bool = False
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Singer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    singer_id: str = Field(default_factory=lambda: f"sing_{uuid.uuid4().hex[:12]}")
    name: str
    type: str = "choir"  # solo, choir, band, artist
    # Images
    photo: Optional[str] = None
    cover_image: Optional[str] = None
    thumbnail: Optional[str] = None  # For grid display
    # Choir-specific fields
    denomination: Optional[str] = None  # roman_catholic, lutheran, anglican, etc.
    church_id: Optional[str] = None
    church_name: Optional[str] = None
    # Treasurer details
    treasurer_name: Optional[str] = None
    treasurer_phone: Optional[str] = None
    # Chairman details
    chairman_name: Optional[str] = None
    chairman_phone: Optional[str] = None
    # Parish Priest/Leader details
    parish_priest_name: Optional[str] = None
    parish_priest_phone: Optional[str] = None
    # Contact info
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    social_links: Optional[dict] = None  # {facebook, instagram, youtube, etc.}
    # General info
    bio: Optional[str] = None
    location: Optional[str] = None
    country: Optional[str] = None
    founded_year: Optional[int] = None
    members_count: Optional[int] = None
    # Stats
    followers_count: int = 0
    total_plays: int = 0
    albums_count: int = 0
    songs_count: int = 0
    # Admin
    status: str = "active"  # active, inactive, suspended, pending_approval
    approval_status: str = "pending"  # pending, approved, rejected
    admin_notes: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class LiveSeminar(BaseModel):
    model_config = ConfigDict(extra="ignore")
    seminar_id: str = Field(default_factory=lambda: f"sem_{uuid.uuid4().hex[:12]}")
    title: str
    description: Optional[str] = None
    topic: str
    organizer_id: Optional[str] = None
    organizer_name: Optional[str] = None
    date: str
    time: str
    duration: Optional[int] = None  # minutes
    meeting_link: Optional[str] = None
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None  # weekly, custom
    recurrence_days: Optional[List[str]] = None
    is_paid: bool = False
    price: Optional[float] = None
    max_participants: Optional[int] = None
    registered_count: int = 0
    status: str = "scheduled"  # scheduled, ongoing, completed, cancelled
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AudioRoom(BaseModel):
    model_config = ConfigDict(extra="ignore")
    room_id: str = Field(default_factory=lambda: f"room_{uuid.uuid4().hex[:12]}")
    title: str
    description: Optional[str] = None
    host_id: Optional[str] = None
    host_name: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    participants_count: int = 0
    status: str = "scheduled"  # scheduled, live, ended
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DonationCampaign(BaseModel):
    model_config = ConfigDict(extra="ignore")
    campaign_id: str = Field(default_factory=lambda: f"camp_{uuid.uuid4().hex[:12]}")
    title: str
    description: str
    goal_amount: float
    raised_amount: float = 0
    thumbnail: Optional[str] = None
    end_date: Optional[str] = None
    recent_donations: Optional[List[dict]] = None  # [{amount, time, anonymous}]
    status: str = "active"  # active, completed, paused
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommunityPost(BaseModel):
    model_config = ConfigDict(extra="ignore")
    post_id: str = Field(default_factory=lambda: f"post_{uuid.uuid4().hex[:12]}")
    user_id: str
    user_name: str
    user_photo: Optional[str] = None
    content: str
    media_urls: Optional[List[str]] = None
    likes: int = 0
    comments_count: int = 0
    status: str = "pending"  # pending, approved, rejected, flagged
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PriestBooking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    booking_id: str = Field(default_factory=lambda: f"book_{uuid.uuid4().hex[:12]}")
    priest_id: str
    priest_name: str
    user_id: str
    user_name: str
    date: str
    time: str
    purpose: str
    notes: Optional[str] = None
    status: str = "pending"  # pending, confirmed, completed, cancelled
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== REVENUE & ANALYTICS MODELS ==============

class MonetizationSettings(BaseModel):
    """Comprehensive platform monetization settings"""
    model_config = ConfigDict(extra="ignore")
    settings_id: str = Field(default_factory=lambda: f"monet_{uuid.uuid4().hex[:12]}")
    
    # 1. Subscription Settings
    subscription_enabled: bool = True
    subscription_price_monthly: float = 5000.0  # TZS per month
    subscription_price_yearly: float = 50000.0  # TZS per year
    free_trial_enabled: bool = True
    free_trial_days: int = 7
    auto_renew_enabled: bool = True
    grace_period_days: int = 3
    
    # 2. Platform Revenue Settings
    platform_fee_percentage: float = 30.0
    platform_fee_effective_date: Optional[str] = None
    apply_fee_to_subscriptions: bool = True
    apply_fee_to_donations: bool = True
    
    # 3. Content Revenue Rates
    premium_rate_per_hour: float = 10.0  # TZS per hour
    standard_rate_per_hour: float = 5.0  # TZS per hour
    rate_effective_date: Optional[str] = None
    
    # 4. Premium Content Rules
    premium_duration_days: int = 90
    auto_downgrade_to_standard: bool = True
    premium_approval_required: bool = True
    
    # 5. Listening Time Rules
    min_qualifying_play_seconds: int = 45
    max_payable_hours_per_user_per_hour: float = 1.0
    max_payable_hours_per_user_per_day: float = 24.0
    ignore_muted_playback: bool = True
    
    # 6. Payout Settings
    minimum_payout_threshold: float = 10000.0  # TZS
    payout_frequency: str = "monthly"  # monthly, bi_weekly
    payout_cutoff_day: int = 25  # Day of month
    payout_fee_handling: str = "platform_pays"  # platform_pays, choir_pays
    
    # 7. Payout Methods
    payout_mobile_money_enabled: bool = True
    payout_bank_transfer_enabled: bool = True
    payout_paypal_enabled: bool = False
    
    # 8. Tips & Donations
    tips_enabled: bool = True
    suggested_tip_amounts: List[float] = [500, 1000, 2000, 5000]
    platform_fee_on_tips_percentage: float = 10.0
    
    # 9. Album Monetization Controls
    subscription_only_albums_enabled: bool = True
    free_promotional_albums_enabled: bool = True
    geo_restricted_monetization: bool = False
    
    # 10. Tax & Compliance
    vat_percentage: float = 18.0
    withholding_tax_percentage: float = 5.0
    tax_invoice_generation_enabled: bool = True
    
    # 11. Currency & Rounding
    base_currency: str = "TZS"
    rounding_precision: int = 0  # Round to nearest whole number
    
    # 12. Analytics & Reporting
    revenue_aggregation_interval: str = "daily"  # hourly, daily
    data_retention_days: int = 365
    
    # 13. Alerts & Monitoring
    revenue_drop_alert_threshold: float = 20.0  # Alert if revenue drops by 20%
    unusual_spike_alert_enabled: bool = True
    failed_payout_alert_enabled: bool = True
    
    # 14. Permissions & Safety
    choir_monetization_frozen: bool = False
    all_payouts_paused: bool = False
    emergency_rate_rollback_enabled: bool = False
    
    # Metadata
    last_updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[str] = None

class SubscriptionPlan(BaseModel):
    """User subscription plans"""
    model_config = ConfigDict(extra="ignore")
    plan_id: str = Field(default_factory=lambda: f"plan_{uuid.uuid4().hex[:12]}")
    name: str  # daily, weekly, monthly, yearly
    display_name: str
    price: float
    duration_days: int
    features: List[str] = []
    is_active: bool = True
    sort_order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RateChangeHistory(BaseModel):
    """History of rate changes for audit"""
    model_config = ConfigDict(extra="ignore")
    change_id: str = Field(default_factory=lambda: f"rate_{uuid.uuid4().hex[:12]}")
    change_type: str  # premium_rate, standard_rate, platform_fee
    old_value: float
    new_value: float
    effective_date: str
    changed_by: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RevenueSettings(BaseModel):
    """Platform revenue settings - hourly rates for content types (legacy support)"""
    model_config = ConfigDict(extra="ignore")
    settings_id: str = Field(default_factory=lambda: f"rev_{uuid.uuid4().hex[:12]}")
    premium_rate_per_hour: float = 10.0  # TZS per hour for premium content
    standard_rate_per_hour: float = 5.0  # TZS per hour for standard content
    platform_share_percentage: float = 30.0  # Platform takes 30%, choir gets 70%
    minimum_withdrawal: float = 10000.0  # Minimum amount for withdrawal
    effective_from: str = ""  # Date from which these rates apply
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== LAYOUT MANAGEMENT MODELS ==============

class LayoutSection(BaseModel):
    """A section in the app/web layout"""
    model_config = ConfigDict(extra="ignore")
    section_id: str = Field(default_factory=lambda: f"section_{uuid.uuid4().hex[:12]}")
    name: str  # Internal name
    display_name: str  # Shown to users
    section_type: str  # hero, quick_access, featured_albums, seasonal, trending, cta, custom, choirs, churches, special_mixes
    description: Optional[str] = None
    
    # Platform targeting
    platforms: List[str] = ["app", "web"]  # app, web, or both
    
    # Visibility and ordering
    is_active: bool = True
    sort_order: int = 0
    
    # Content assignment
    content_type: Optional[str] = None  # categories, albums, songs, playlists, custom, choirs, churches, special_mixes
    content_ids: List[str] = []  # List of category_ids, album_ids, song_ids, choir_ids, church_ids, etc.
    content_count: int = 10  # Max items to show
    content_source: str = "manual"  # manual, auto_trending, auto_recent, auto_popular
    
    # Hero/Background settings
    background_image: Optional[str] = None
    background_color: Optional[str] = None
    background_gradient: Optional[str] = None
    
    # Link to specific content
    link_type: Optional[str] = None  # album, category, playlist, external, page, choir, church
    link_target: Optional[str] = None  # album_id, category_id, URL, page_name
    
    # Schedule
    schedule_start: Optional[str] = None  # ISO date for scheduled activation
    schedule_end: Optional[str] = None  # ISO date for scheduled deactivation
    
    # Metadata
    last_edited_by: Optional[str] = None
    clicks_count: int = 0
    views_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[str] = None

class LayoutBurner(BaseModel):
    """Promotional banner/CTA (like the Premium upgrade card)"""
    model_config = ConfigDict(extra="ignore")
    burner_id: str = Field(default_factory=lambda: f"burner_{uuid.uuid4().hex[:12]}")
    name: str  # Internal name
    
    # Display content
    icon: Optional[str] = None  # Icon name (e.g., "crown", "gift", "music")
    icon_color: str = "#a855f7"  # Default purple
    headline: str
    subtitle: Optional[str] = None
    cta_text: str  # Button text
    cta_link: str  # Link target (URL, page, album_id, etc.)
    cta_link_type: str = "page"  # page, album, category, playlist, external, payment
    
    # Styling
    background_type: str = "gradient"  # solid, gradient, image
    background_color: str = "#1e1b4b"  # Dark purple default
    background_gradient: Optional[str] = "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)"
    background_image: Optional[str] = None
    text_color: str = "#ffffff"
    button_style: str = "solid"  # solid, outline
    button_color: str = "#ffffff"
    button_text_color: str = "#000000"
    border_radius: str = "16px"
    
    # Platform targeting
    platforms: List[str] = ["app", "web"]
    
    # Visibility
    is_active: bool = True
    sort_order: int = 0
    
    # Assignment to section (optional)
    section_id: Optional[str] = None
    
    # Schedule
    schedule_start: Optional[str] = None
    schedule_end: Optional[str] = None
    
    # Analytics
    clicks_count: int = 0
    impressions_count: int = 0
    
    # Metadata
    last_edited_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[str] = None

class LayoutConfig(BaseModel):
    """Global layout configuration"""
    model_config = ConfigDict(extra="ignore")
    config_id: str = Field(default_factory=lambda: f"layout_{uuid.uuid4().hex[:12]}")
    platform: str  # app or web
    
    # Section order (list of section_ids in display order)
    section_order: List[str] = []
    
    # Global settings
    show_search_bar: bool = True
    show_categories_nav: bool = True
    default_theme: str = "dark"
    
    # Metadata
    last_edited_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[str] = None

class ListeningSession(BaseModel):
    """Track user listening sessions for revenue calculation"""
    model_config = ConfigDict(extra="ignore")
    session_id: str = Field(default_factory=lambda: f"listen_{uuid.uuid4().hex[:12]}")
    user_id: str
    song_id: str
    album_id: str
    choir_id: str  # Singer/choir who owns the album
    content_type: str = "standard"  # premium or standard
    start_time: str = ""
    end_time: Optional[str] = None
    duration_seconds: int = 0
    duration_hours: float = 0.0
    date: str = ""  # YYYY-MM-DD for daily aggregation
    month: str = ""  # YYYY-MM for monthly aggregation
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChoirRevenue(BaseModel):
    """Aggregated revenue data for each choir"""
    model_config = ConfigDict(extra="ignore")
    revenue_id: str = Field(default_factory=lambda: f"chorrev_{uuid.uuid4().hex[:12]}")
    choir_id: str
    choir_name: str
    period: str  # YYYY-MM for monthly
    premium_hours: float = 0.0
    standard_hours: float = 0.0
    total_hours: float = 0.0
    premium_revenue: float = 0.0
    standard_revenue: float = 0.0
    gross_revenue: float = 0.0
    platform_share: float = 0.0
    net_revenue: float = 0.0  # What choir earns
    total_plays: int = 0
    status: str = "pending"  # pending, calculated, paid
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AlbumPerformance(BaseModel):
    """Album-level performance metrics"""
    model_config = ConfigDict(extra="ignore")
    performance_id: str = Field(default_factory=lambda: f"albperf_{uuid.uuid4().hex[:12]}")
    album_id: str
    album_title: str
    choir_id: str
    choir_name: str
    period: str  # YYYY-MM
    premium_hours: float = 0.0
    standard_hours: float = 0.0
    total_hours: float = 0.0
    revenue_generated: float = 0.0
    total_plays: int = 0
    unique_listeners: int = 0
    avg_listen_duration: float = 0.0  # Average session duration in minutes
    revenue_percentage: float = 0.0  # % of choir's total revenue
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WithdrawalRequest(BaseModel):
    """Choir withdrawal requests"""
    model_config = ConfigDict(extra="ignore")
    request_id: str = Field(default_factory=lambda: f"wd_{uuid.uuid4().hex[:12]}")
    choir_id: str
    choir_name: str
    amount: float
    payment_method: str = "mobile_money"  # mobile_money, bank_transfer
    payment_details: Optional[dict] = None  # {phone, bank_name, account_number, etc.}
    status: str = "pending"  # pending, approved, rejected, completed
    admin_notes: Optional[str] = None
    processed_by: Optional[str] = None
    processed_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChoirAccount(BaseModel):
    """Choir account for login and balance tracking"""
    model_config = ConfigDict(extra="ignore")
    account_id: str = Field(default_factory=lambda: f"acc_{uuid.uuid4().hex[:12]}")
    choir_id: str  # Links to singers collection
    choir_name: str
    email: str
    password_hash: str  # Will use simple hash for demo
    # Denomination and contacts (synced from Singer)
    denomination: Optional[str] = None
    treasurer_name: Optional[str] = None
    treasurer_phone: Optional[str] = None
    chairman_name: Optional[str] = None
    chairman_phone: Optional[str] = None
    parish_priest_name: Optional[str] = None
    parish_priest_phone: Optional[str] = None
    # Balance info
    current_balance: float = 0.0
    total_earned: float = 0.0
    total_withdrawn: float = 0.0
    status: str = "pending"  # pending, approved, suspended
    # Payment details
    payment_method: Optional[str] = None  # mobile_money, bank_transfer
    payment_details: Optional[dict] = None  # {phone, otp_verified} or {bank_name, account_number, account_name}
    payment_details_status: str = "not_set"  # not_set, pending_approval, approved, rejected
    payment_details_updated_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChoirContentRequest(BaseModel):
    """Choir content upload requests (albums/songs) requiring admin approval"""
    model_config = ConfigDict(extra="ignore")
    request_id: str = Field(default_factory=lambda: f"content_{uuid.uuid4().hex[:12]}")
    choir_id: str
    choir_name: str
    request_type: str  # album_create, song_upload
    content_data: dict  # Album or song data
    status: str = "pending"  # pending, approved, rejected
    admin_notes: Optional[str] = None
    processed_by: Optional[str] = None
    processed_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentDetailChangeRequest(BaseModel):
    """Request to change payment details - requires admin approval"""
    model_config = ConfigDict(extra="ignore")
    request_id: str = Field(default_factory=lambda: f"pdc_{uuid.uuid4().hex[:12]}")
    choir_id: str
    choir_name: str
    payment_method: str  # mobile_money, bank_transfer
    payment_details: dict  # New payment details
    otp_verified: bool = False  # For mobile money
    status: str = "pending"  # pending, approved, rejected
    admin_notes: Optional[str] = None
    processed_by: Optional[str] = None
    processed_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OTPVerification(BaseModel):
    """OTP verification for mobile money"""
    model_config = ConfigDict(extra="ignore")
    otp_id: str = Field(default_factory=lambda: f"otp_{uuid.uuid4().hex[:12]}")
    choir_id: str
    phone_number: str
    otp_code: str
    verified: bool = False
    expires_at: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PriestNotification(BaseModel):
    """Notifications to priests about choir activities"""
    model_config = ConfigDict(extra="ignore")
    notification_id: str = Field(default_factory=lambda: f"notif_{uuid.uuid4().hex[:12]}")
    recipient_type: str = "priest"  # priest, admin
    notification_type: str  # withdrawal_request, content_request, payment_change
    choir_id: str
    choir_name: str
    message: str
    details: Optional[dict] = None
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChurchLeaderAccount(BaseModel):
    """Church leader account for login and church management"""
    model_config = ConfigDict(extra="ignore")
    account_id: str = Field(default_factory=lambda: f"church_acc_{uuid.uuid4().hex[:12]}")
    church_id: str  # Links to churches collection
    church_name: str
    name: str  # Leader's name
    email: str
    password_hash: str
    phone: Optional[str] = None
    role: str = "leader"  # leader, admin_created
    status: str = "pending"  # pending, approved, suspended
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ContentEditRequest(BaseModel):
    """Request to edit existing content (albums/songs) - requires admin approval"""
    model_config = ConfigDict(extra="ignore")
    request_id: str = Field(default_factory=lambda: f"edit_{uuid.uuid4().hex[:12]}")
    choir_id: str
    choir_name: str
    content_type: str  # album, song
    content_id: str  # album_id or song_id
    original_data: dict  # Snapshot of current data
    updated_data: dict  # Proposed changes
    status: str = "pending"  # pending, approved, rejected
    admin_notes: Optional[str] = None
    processed_by: Optional[str] = None
    processed_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SMSNotification(BaseModel):
    """SMS notification log for external integration"""
    model_config = ConfigDict(extra="ignore")
    sms_id: str = Field(default_factory=lambda: f"sms_{uuid.uuid4().hex[:12]}")
    recipient_type: str  # treasurer, chairman, parish_priest, choir_owner
    recipient_name: str
    recipient_phone: str
    message: str
    notification_type: str  # withdrawal_request, withdrawal_approved, withdrawal_rejected, content_approved
    related_id: Optional[str] = None  # withdrawal_id, content_request_id, etc.
    choir_id: Optional[str] = None
    choir_name: Optional[str] = None
    status: str = "pending"  # pending, sent, failed, mock_sent
    provider: Optional[str] = None  # twilio, africas_talking, beem, mock
    provider_response: Optional[dict] = None
    sent_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AlbumApproval(BaseModel):
    """Album approval request with songs preview"""
    model_config = ConfigDict(extra="ignore")
    approval_id: str = Field(default_factory=lambda: f"alb_appr_{uuid.uuid4().hex[:12]}")
    album_id: str
    album_title: str
    choir_id: str
    choir_name: str
    songs: List[dict] = []  # List of song details with audio_url for preview
    thumbnail: Optional[str] = None
    monetization_type: str = "standard"
    status: str = "pending"  # pending, approved, rejected
    admin_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== ROLE-BASED ACCESS CONTROL (RBAC) ==============

# Define all system permissions
SYSTEM_PERMISSIONS = {
    # Platform Administration
    "platform_settings": "Manage platform settings and configuration",
    "role_assignment": "Assign and modify user roles",
    "user_management": "Manage users (view, edit, suspend, delete)",
    "choir_onboarding_approval": "Approve new choir/artist registrations",
    
    # Content Creation
    "create_albums": "Create new albums",
    "upload_songs": "Upload songs to albums",
    "create_teachings": "Create teachings and podcasts",
    "edit_own_content": "Edit own uploaded content",
    "submit_content_approval": "Submit content for approval",
    
    # Content Moderation
    "content_moderation": "Review and moderate content",
    "content_approval": "Approve or takedown content",
    "set_content_monetization": "Set content as premium or standard",
    
    # Analytics & Reports
    "view_platform_analytics": "View platform-wide analytics",
    "view_own_analytics": "View own performance analytics",
    
    # Revenue & Finance
    "revenue_configuration": "Configure revenue settings and rates",
    "view_all_revenue_reports": "View all revenue reports",
    "view_own_revenue_reports": "View own revenue reports",
    "request_withdrawal": "Request revenue withdrawal",
    "approve_payouts": "Approve and process payouts",
    
    # Layout & Promotion
    "layout_promotion_control": "Control layout and promotional content",
    
    # Content Access
    "access_free_content": "Access free content",
    "access_premium_content": "Access premium content",
}

# Define role permissions mapping based on the user's table
ROLE_PERMISSIONS = {
    "super_admin": [
        "platform_settings", "role_assignment", "user_management", "choir_onboarding_approval",
        "create_albums", "upload_songs", "create_teachings", "edit_own_content", "submit_content_approval",
        "content_moderation", "content_approval", "set_content_monetization",
        "view_platform_analytics", "view_own_analytics",
        "revenue_configuration", "view_all_revenue_reports", "view_own_revenue_reports",
        "request_withdrawal", "approve_payouts",
        "layout_promotion_control",
        "access_free_content", "access_premium_content"
    ],
    "admin": [
        "platform_settings", "role_assignment", "user_management", "choir_onboarding_approval",
        "content_moderation", "content_approval", "set_content_monetization",
        "view_platform_analytics",
        "revenue_configuration", "view_all_revenue_reports",
        "layout_promotion_control",
        "access_free_content", "access_premium_content"
    ],
    "sub_admin": [
        "user_management", "choir_onboarding_approval",
        "access_free_content", "access_premium_content"
    ],
    "finance_admin": [
        "view_platform_analytics",
        "revenue_configuration", "view_all_revenue_reports",
        "approve_payouts",
        "access_free_content", "access_premium_content"
    ],
    "moderator": [
        "content_moderation",
        "layout_promotion_control",
        "access_free_content", "access_premium_content"
    ],
    "choir_artist": [
        "create_albums", "upload_songs",
        "edit_own_content", "submit_content_approval",
        "view_own_analytics", "view_own_revenue_reports",
        "request_withdrawal",
        "access_free_content", "access_premium_content"
    ],
    "religious_leader": [
        "create_teachings", "upload_songs",
        "edit_own_content", "submit_content_approval",
        "content_moderation",
        "view_own_analytics", "view_own_revenue_reports",
        "access_free_content", "access_premium_content"
    ],
    "listener_free": [
        "access_free_content"
    ],
    "listener_paid": [
        "access_free_content", "access_premium_content"
    ]
}

# Role hierarchy for display
ROLE_HIERARCHY = [
    {"id": "super_admin", "name": "Super Admin", "level": 1, "description": "Full platform control with all permissions", "color": "#9c27b0"},
    {"id": "admin", "name": "Admin", "level": 2, "description": "Platform administration and content management", "color": "#e91e63"},
    {"id": "sub_admin", "name": "Sub-Admin", "level": 3, "description": "Limited administrative access", "color": "#f44336"},
    {"id": "finance_admin", "name": "Finance Admin", "level": 4, "description": "Revenue and payout management", "color": "#4caf50"},
    {"id": "moderator", "name": "Moderator", "level": 5, "description": "Content moderation and layout control", "color": "#2196f3"},
    {"id": "choir_artist", "name": "Choir / Artist", "level": 6, "description": "Content creation and management", "color": "#ff9800"},
    {"id": "religious_leader", "name": "Religious Leader", "level": 7, "description": "Teachings, podcasts and moderation", "color": "#795548"},
    {"id": "listener_free", "name": "Listener (Free)", "level": 8, "description": "Free content access only", "color": "#9e9e9e"},
    {"id": "listener_paid", "name": "Listener (Paid)", "level": 9, "description": "Full content access with subscription", "color": "#ffc107"},
]

class SystemRole(BaseModel):
    """System-defined roles"""
    model_config = ConfigDict(extra="ignore")
    role_id: str
    name: str
    description: Optional[str] = None
    permissions: List[str] = []
    level: int = 10  # Lower number = higher authority
    color: str = "#666666"
    is_system_role: bool = True  # Cannot be deleted
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class CustomRole(BaseModel):
    """Custom roles created by admins"""
    model_config = ConfigDict(extra="ignore")
    role_id: str = Field(default_factory=lambda: f"role_{uuid.uuid4().hex[:12]}")
    name: str
    description: Optional[str] = None
    permissions: List[str] = []
    based_on: Optional[str] = None  # System role it was based on
    level: int = 10
    color: str = "#666666"
    is_system_role: bool = False
    is_active: bool = True
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class UserRoleAssignment(BaseModel):
    """User to role assignments"""
    model_config = ConfigDict(extra="ignore")
    assignment_id: str = Field(default_factory=lambda: f"assign_{uuid.uuid4().hex[:12]}")
    user_id: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    role_id: str
    role_name: Optional[str] = None
    assigned_by: str
    assigned_by_name: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class RoleChangeLog(BaseModel):
    """Audit log for role changes"""
    model_config = ConfigDict(extra="ignore")
    log_id: str = Field(default_factory=lambda: f"rlog_{uuid.uuid4().hex[:12]}")
    action: str  # assign, revoke, modify, create_role, delete_role
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    role_id: str
    role_name: str
    previous_role_id: Optional[str] = None
    previous_role_name: Optional[str] = None
    performed_by: str
    performed_by_name: Optional[str] = None
    reason: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== SMS SERVICE (MOCK) ==============

async def send_sms_notification(
    recipient_type: str,
    recipient_name: str, 
    recipient_phone: str,
    message: str,
    notification_type: str,
    related_id: str = None,
    choir_id: str = None,
    choir_name: str = None
):
    """
    Send SMS notification (MOCK implementation)
    Future integration: Replace with actual SMS provider (Twilio, Africa's Talking, Beem)
    """
    sms_doc = {
        "sms_id": f"sms_{uuid.uuid4().hex[:12]}",
        "recipient_type": recipient_type,
        "recipient_name": recipient_name,
        "recipient_phone": recipient_phone,
        "message": message,
        "notification_type": notification_type,
        "related_id": related_id,
        "choir_id": choir_id,
        "choir_name": choir_name,
        "status": "mock_sent",  # Will be "sent" when real provider is integrated
        "provider": "mock",
        "provider_response": {"mock": True, "message": "SMS logged for future delivery"},
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.sms_notifications.insert_one(sms_doc)
    
    # Log to console for debugging
    print(f"[MOCK SMS] To: {recipient_phone} ({recipient_name}) - {message[:50]}...")
    
    return sms_doc

async def notify_choir_contacts_withdrawal(choir_id: str, withdrawal_request: dict, notification_type: str = "withdrawal_request"):
    """Send SMS to treasurer, chairman, and parish priest about withdrawal"""
    # Get choir details
    choir = await db.singers.find_one({"singer_id": choir_id}, {"_id": 0})
    if not choir:
        return
    
    choir_name = choir.get("name", "Unknown Choir")
    amount = withdrawal_request.get("amount", 0)
    
    # Prepare message based on type
    if notification_type == "withdrawal_request":
        message = f"Withdrawal request of TZS {amount:,.0f} submitted by {choir_name}. Please review."
    elif notification_type == "withdrawal_approved":
        message = f"Withdrawal of TZS {amount:,.0f} for {choir_name} has been approved."
    elif notification_type == "withdrawal_rejected":
        message = f"Withdrawal of TZS {amount:,.0f} for {choir_name} has been rejected."
    else:
        message = f"Notification regarding {choir_name} withdrawal."
    
    contacts = [
        ("treasurer", choir.get("treasurer_name"), choir.get("treasurer_phone")),
        ("chairman", choir.get("chairman_name"), choir.get("chairman_phone")),
        ("parish_priest", choir.get("parish_priest_name"), choir.get("parish_priest_phone"))
    ]
    
    for recipient_type, name, phone in contacts:
        if name and phone:
            await send_sms_notification(
                recipient_type=recipient_type,
                recipient_name=name,
                recipient_phone=phone,
                message=message,
                notification_type=notification_type,
                related_id=withdrawal_request.get("request_id"),
                choir_id=choir_id,
                choir_name=choir_name
            )

# Minimum stream duration for counting revenue (45 seconds)
MIN_STREAM_DURATION_SECONDS = 45

# ============== AUTH ENDPOINTS ==============

@api_router.post("/auth/session")
async def process_session(request: Request, response: Response):
    """Process session_id from Emergent OAuth and create user session"""
    data = await request.json()
    session_id = data.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    # Get user data from Emergent auth
    async with httpx.AsyncClient() as client_http:
        auth_response = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        user_data = auth_response.json()
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user data
        await db.users.update_one(
            {"email": user_data["email"]},
            {"$set": {
                "name": user_data["name"],
                "picture": user_data.get("picture")
            }}
        )
    else:
        # Create new user (default role is customer, admin needs to be set manually)
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "role": "admin",  # First user is admin for testing
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
    
    # Create session
    session_token = user_data.get("session_token", f"token_{uuid.uuid4().hex}")
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_id": f"sess_{uuid.uuid4().hex}",
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user, "session_token": session_token}

@api_router.get("/auth/me")
async def get_current_user(request: Request):
    """Get current authenticated user"""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ============== DASHBOARD ANALYTICS ==============

@api_router.get("/analytics/overview")
async def get_analytics_overview():
    """Get dashboard analytics overview"""
    total_users = await db.users.count_documents({})
    total_customers = await db.users.count_documents({"role": "customer"})
    total_system_users = await db.users.count_documents({"role": {"$ne": "customer"}})
    total_songs = await db.songs.count_documents({})
    total_albums = await db.albums.count_documents({})
    total_churches = await db.churches.count_documents({})
    total_leaders = await db.religious_leaders.count_documents({})
    total_donations = await db.donation_campaigns.count_documents({})
    pending_approvals = await db.churches.count_documents({"status": "pending"})
    pending_approvals += await db.religious_leaders.count_documents({"status": "pending"})
    pending_approvals += await db.community_posts.count_documents({"status": "pending"})
    
    # Get total raised amount
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$raised_amount"}}}]
    donation_result = await db.donation_campaigns.aggregate(pipeline).to_list(1)
    total_raised = donation_result[0]["total"] if donation_result else 0
    
    return {
        "total_users": total_users,
        "total_customers": total_customers,
        "total_system_users": total_system_users,
        "total_songs": total_songs,
        "total_albums": total_albums,
        "total_churches": total_churches,
        "total_leaders": total_leaders,
        "total_donations": total_donations,
        "pending_approvals": pending_approvals,
        "total_raised": total_raised
    }

@api_router.get("/analytics/trends")
async def get_trends():
    """Get user and content trends for charts"""
    # Mock data for charts - in production, aggregate from actual data
    return {
        "user_growth": [
            {"month": "Jan", "users": 120},
            {"month": "Feb", "users": 180},
            {"month": "Mar", "users": 250},
            {"month": "Apr", "users": 320},
            {"month": "May", "users": 400},
            {"month": "Jun", "users": 480}
        ],
        "content_performance": [
            {"category": "Praise", "plays": 4500},
            {"category": "Sermons", "plays": 3200},
            {"category": "Christmas", "plays": 2800},
            {"category": "Lent", "plays": 1500},
            {"category": "Bible Study", "plays": 2100}
        ],
        "donations_trend": [
            {"month": "Jan", "amount": 5000},
            {"month": "Feb", "amount": 7500},
            {"month": "Mar", "amount": 6200},
            {"month": "Apr", "amount": 8800},
            {"month": "May", "amount": 9500},
            {"month": "Jun", "amount": 11000}
        ]
    }

@api_router.get("/analytics/user-demographics")
async def get_user_demographics():
    """Get user demographics statistics - location, age, gender, device type"""
    
    # Get app users for demographics
    app_users = await db.app_users.find({}, {"_id": 0}).to_list(10000)
    
    # Process demographics
    location_stats = {}
    age_stats = {"0-17": 0, "18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55+": 0, "unknown": 0}
    gender_stats = {"male": 0, "female": 0, "other": 0, "unknown": 0}
    device_stats = {"android": 0, "ios": 0, "web": 0, "unknown": 0}
    
    from datetime import datetime
    current_year = datetime.now().year
    
    for user in app_users:
        # Location
        location = user.get("location") or user.get("country") or "Unknown"
        location_stats[location] = location_stats.get(location, 0) + 1
        
        # Age calculation
        birth_year = user.get("birth_year")
        if birth_year:
            age = current_year - int(birth_year)
            if age < 18:
                age_stats["0-17"] += 1
            elif age < 25:
                age_stats["18-24"] += 1
            elif age < 35:
                age_stats["25-34"] += 1
            elif age < 45:
                age_stats["35-44"] += 1
            elif age < 55:
                age_stats["45-54"] += 1
            else:
                age_stats["55+"] += 1
        else:
            age_stats["unknown"] += 1
        
        # Gender
        gender = (user.get("gender") or "unknown").lower()
        if gender in gender_stats:
            gender_stats[gender] += 1
        else:
            gender_stats["unknown"] += 1
        
        # Device type
        device = (user.get("device_type") or user.get("last_device") or "unknown").lower()
        if "android" in device:
            device_stats["android"] += 1
        elif "ios" in device or "iphone" in device or "ipad" in device:
            device_stats["ios"] += 1
        elif "web" in device or "browser" in device:
            device_stats["web"] += 1
        else:
            device_stats["unknown"] += 1
    
    # Sort locations by count and get top 10
    top_locations = sorted(location_stats.items(), key=lambda x: x[1], reverse=True)[:10]
    
    # Format for charts
    location_chart = [{"name": loc, "value": count} for loc, count in top_locations]
    age_chart = [{"name": age_range, "value": count} for age_range, count in age_stats.items() if count > 0]
    gender_chart = [{"name": gender.capitalize(), "value": count} for gender, count in gender_stats.items() if count > 0]
    device_chart = [{"name": device.upper() if device != "unknown" else "Unknown", "value": count} for device, count in device_stats.items() if count > 0]
    
    total_users = len(app_users)
    
    return {
        "total_users": total_users,
        "location": {
            "data": location_chart,
            "total_locations": len(location_stats)
        },
        "age": {
            "data": age_chart,
            "breakdown": age_stats
        },
        "gender": {
            "data": gender_chart,
            "breakdown": gender_stats
        },
        "device": {
            "data": device_chart,
            "breakdown": device_stats
        }
    }

# ============== SPECIAL MIX ALBUMS ==============

@api_router.get("/special-mixes")
async def get_special_mixes():
    """Get all special mix albums"""
    mixes = await db.special_mixes.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"mixes": mixes, "total": len(mixes)}

@api_router.get("/special-mixes/{mix_id}")
async def get_special_mix(mix_id: str):
    """Get a specific special mix with its songs"""
    mix = await db.special_mixes.find_one({"mix_id": mix_id}, {"_id": 0})
    if not mix:
        raise HTTPException(status_code=404, detail="Special mix not found")
    
    # Get full song details
    song_ids = [s.get("song_id") for s in mix.get("songs", [])]
    songs = await db.songs.find({"song_id": {"$in": song_ids}}, {"_id": 0}).to_list(100)
    song_map = {s["song_id"]: s for s in songs}
    
    # Enrich mix songs with full details
    enriched_songs = []
    for s in mix.get("songs", []):
        song_data = song_map.get(s.get("song_id"), {})
        enriched_songs.append({**s, **song_data})
    
    mix["songs"] = enriched_songs
    return mix

@api_router.post("/special-mixes")
async def create_special_mix(data: dict):
    """Create a new special mix album from songs across different albums"""
    title = data.get("title")
    description = data.get("description", "")
    songs = data.get("songs", [])  # List of {song_id, album_id, order}
    thumbnail = data.get("thumbnail")
    category_id = data.get("category_id")
    category_name = data.get("category_name")
    monetization_type = data.get("monetization_type", "standard")
    is_featured = data.get("is_featured", False)
    created_by = data.get("created_by", "admin")
    
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    if not songs or len(songs) == 0:
        raise HTTPException(status_code=400, detail="At least one song is required")
    
    # Validate songs exist and get their details
    song_ids = [s.get("song_id") for s in songs]
    existing_songs = await db.songs.find({"song_id": {"$in": song_ids}}, {"_id": 0}).to_list(100)
    existing_ids = {s["song_id"] for s in existing_songs}
    
    invalid_songs = [sid for sid in song_ids if sid not in existing_ids]
    if invalid_songs:
        raise HTTPException(status_code=400, detail=f"Invalid song IDs: {invalid_songs}")
    
    # Build song list with details
    song_map = {s["song_id"]: s for s in existing_songs}
    mix_songs = []
    for i, s in enumerate(songs):
        song_data = song_map.get(s.get("song_id"), {})
        mix_songs.append({
            "song_id": s.get("song_id"),
            "album_id": s.get("album_id") or song_data.get("album_id"),
            "title": song_data.get("title"),
            "artist_name": song_data.get("artist_name"),
            "duration": song_data.get("duration"),
            "duration_formatted": song_data.get("duration_formatted"),
            "audio_url": song_data.get("audio_url"),
            "order": s.get("order", i + 1)
        })
    
    # Calculate total duration
    total_duration = sum(s.get("duration", 0) for s in mix_songs if s.get("duration"))
    
    mix_id = f"mix_{uuid.uuid4().hex[:12]}"
    mix = {
        "mix_id": mix_id,
        "title": title,
        "description": description,
        "thumbnail": thumbnail,
        "category_id": category_id,
        "category_name": category_name,
        "monetization_type": monetization_type,
        "is_featured": is_featured,
        "songs": mix_songs,
        "songs_count": len(mix_songs),
        "total_duration": total_duration,
        "total_plays": 0,
        "status": "active",
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None
    }
    
    await db.special_mixes.insert_one(mix)
    
    return {"message": "Special mix created successfully", "mix_id": mix_id, "mix": {k: v for k, v in mix.items() if k != "_id"}}

@api_router.put("/special-mixes/{mix_id}")
async def update_special_mix(mix_id: str, data: dict):
    """Update a special mix album"""
    update_fields = {}
    
    if "title" in data:
        update_fields["title"] = data["title"]
    if "description" in data:
        update_fields["description"] = data["description"]
    if "thumbnail" in data:
        update_fields["thumbnail"] = data["thumbnail"]
    if "category_id" in data:
        update_fields["category_id"] = data["category_id"]
    if "category_name" in data:
        update_fields["category_name"] = data["category_name"]
    if "monetization_type" in data:
        update_fields["monetization_type"] = data["monetization_type"]
    if "is_featured" in data:
        update_fields["is_featured"] = data["is_featured"]
    if "status" in data:
        update_fields["status"] = data["status"]
    
    # Handle song updates
    if "songs" in data:
        songs = data["songs"]
        song_ids = [s.get("song_id") for s in songs]
        existing_songs = await db.songs.find({"song_id": {"$in": song_ids}}, {"_id": 0}).to_list(100)
        song_map = {s["song_id"]: s for s in existing_songs}
        
        mix_songs = []
        for i, s in enumerate(songs):
            song_data = song_map.get(s.get("song_id"), {})
            mix_songs.append({
                "song_id": s.get("song_id"),
                "album_id": s.get("album_id") or song_data.get("album_id"),
                "title": song_data.get("title"),
                "artist_name": song_data.get("artist_name"),
                "duration": song_data.get("duration"),
                "duration_formatted": song_data.get("duration_formatted"),
                "audio_url": song_data.get("audio_url"),
                "order": s.get("order", i + 1)
            })
        
        update_fields["songs"] = mix_songs
        update_fields["songs_count"] = len(mix_songs)
        update_fields["total_duration"] = sum(s.get("duration", 0) for s in mix_songs if s.get("duration"))
    
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.special_mixes.update_one({"mix_id": mix_id}, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Special mix not found")
    
    return {"message": "Special mix updated successfully"}

@api_router.delete("/special-mixes/{mix_id}")
async def delete_special_mix(mix_id: str):
    """Delete a special mix album"""
    result = await db.special_mixes.delete_one({"mix_id": mix_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Special mix not found")
    return {"message": "Special mix deleted successfully"}

@api_router.get("/special-mixes/{mix_id}/songs")
async def get_special_mix_songs(mix_id: str):
    """Get songs in a special mix for playback"""
    mix = await db.special_mixes.find_one({"mix_id": mix_id}, {"_id": 0})
    if not mix:
        raise HTTPException(status_code=404, detail="Special mix not found")
    
    return {
        "mix_id": mix_id,
        "title": mix.get("title"),
        "songs": mix.get("songs", [])
    }

@api_router.get("/albums/all-songs")
async def get_all_songs_for_mix():
    """Get all songs from all albums for creating special mixes"""
    albums = await db.albums.find({"status": "active"}, {"_id": 0}).to_list(500)
    songs = await db.songs.find({"status": "active"}, {"_id": 0}).to_list(5000)
    
    # Group songs by album
    album_map = {a["album_id"]: a for a in albums}
    songs_by_album = {}
    
    for song in songs:
        album_id = song.get("album_id")
        if album_id not in songs_by_album:
            album_info = album_map.get(album_id, {})
            songs_by_album[album_id] = {
                "album_id": album_id,
                "album_title": album_info.get("title", "Unknown Album"),
                "album_thumbnail": album_info.get("thumbnail"),
                "artist_name": album_info.get("artist_name"),
                "songs": []
            }
        songs_by_album[album_id]["songs"].append(song)
    
    return {"albums": list(songs_by_album.values()), "total_songs": len(songs)}

# ============== USERS MANAGEMENT ==============

@api_router.get("/users")
async def get_users(role: Optional[str] = None, status: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all users with optional filters"""
    query = {}
    if role:
        query["role"] = role
    if status:
        query["status"] = status
    
    users = await db.users.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    return {"users": users, "total": total}

@api_router.post("/users")
async def create_user(user: dict):
    """Create a new system user"""
    user_obj = UserBase(**user)
    doc = user_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.users.insert_one(doc)
    return {"user_id": doc["user_id"], "message": "User created successfully"}

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, updates: dict):
    """Update user details"""
    updates.pop("_id", None)
    updates.pop("user_id", None)
    result = await db.users.update_one({"user_id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User updated successfully"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    """Delete a user"""
    result = await db.users.delete_one({"user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

# ============== CATEGORIES MANAGEMENT ==============

@api_router.get("/categories")
async def get_categories(type: Optional[str] = None):
    """Get all categories"""
    query = {}
    if type:
        query["type"] = type
    categories = await db.categories.find(query, {"_id": 0}).to_list(100)
    return {"categories": categories}

@api_router.post("/categories")
async def create_category(category: dict):
    """Create a new category"""
    cat_obj = Category(**category)
    doc = cat_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.categories.insert_one(doc)
    return {"category_id": doc["category_id"], "message": "Category created successfully"}

@api_router.put("/categories/{category_id}")
async def update_category(category_id: str, updates: dict):
    """Update category"""
    updates.pop("_id", None)
    updates.pop("category_id", None)
    result = await db.categories.update_one({"category_id": category_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category updated successfully"}

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    """Delete a category"""
    result = await db.categories.delete_one({"category_id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted successfully"}

# ============== ALBUMS MANAGEMENT ==============

@api_router.get("/albums")
async def get_albums(category_id: Optional[str] = None, artist_id: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all albums"""
    query = {}
    if category_id:
        query["category_id"] = category_id
    if artist_id:
        query["artist_id"] = artist_id
    albums = await db.albums.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.albums.count_documents(query)
    return {"albums": albums, "total": total}

@api_router.get("/albums/{album_id}")
async def get_album(album_id: str):
    """Get single album with songs"""
    album = await db.albums.find_one({"album_id": album_id}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    songs = await db.songs.find({"album_id": album_id}, {"_id": 0}).to_list(100)
    return {"album": album, "songs": songs}

@api_router.post("/albums")
async def create_album(album: dict):
    """Create a new album"""
    album_obj = Album(**album)
    doc = album_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.albums.insert_one(doc)
    return {"album_id": doc["album_id"], "message": "Album created successfully"}

@api_router.put("/albums/{album_id}")
async def update_album(album_id: str, updates: dict):
    """Update album"""
    updates.pop("_id", None)
    updates.pop("album_id", None)
    result = await db.albums.update_one({"album_id": album_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Album not found")
    return {"message": "Album updated successfully"}

@api_router.delete("/albums/{album_id}")
async def delete_album(album_id: str):
    """Delete album and its songs"""
    await db.songs.delete_many({"album_id": album_id})
    result = await db.albums.delete_one({"album_id": album_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Album not found")
    return {"message": "Album and songs deleted successfully"}

@api_router.post("/albums/bulk-status")
async def bulk_update_album_status(data: dict):
    """Bulk update album status (activate/deactivate)"""
    album_ids = data.get("album_ids", [])
    status = data.get("status", "active")
    
    if not album_ids:
        raise HTTPException(status_code=400, detail="No album IDs provided")
    
    result = await db.albums.update_many(
        {"album_id": {"$in": album_ids}},
        {"$set": {"status": status}}
    )
    return {"message": f"{result.modified_count} albums updated to {status}"}

@api_router.post("/albums/bulk-delete")
async def bulk_delete_albums(data: dict):
    """Bulk delete albums and their songs"""
    album_ids = data.get("album_ids", [])
    
    if not album_ids:
        raise HTTPException(status_code=400, detail="No album IDs provided")
    
    # Delete all songs from these albums
    await db.songs.delete_many({"album_id": {"$in": album_ids}})
    # Delete the albums
    result = await db.albums.delete_many({"album_id": {"$in": album_ids}})
    return {"message": f"{result.deleted_count} albums deleted"}

# ============== SONGS MANAGEMENT ==============

@api_router.get("/songs")
async def get_songs(album_id: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all songs"""
    query = {}
    if album_id:
        query["album_id"] = album_id
    songs = await db.songs.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.songs.count_documents(query)
    return {"songs": songs, "total": total}

@api_router.post("/songs")
async def create_song(song: dict):
    """Create a new song"""
    song_obj = Song(**song)
    doc = song_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.songs.insert_one(doc)
    return {"song_id": doc["song_id"], "message": "Song created successfully"}

@api_router.post("/songs/bulk")
async def create_songs_bulk(songs: List[dict]):
    """Create multiple songs at once"""
    created_ids = []
    for song in songs:
        song_obj = Song(**song)
        doc = song_obj.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        await db.songs.insert_one(doc)
        created_ids.append(doc["song_id"])
    return {"song_ids": created_ids, "message": f"{len(created_ids)} songs created successfully"}

@api_router.put("/songs/{song_id}")
async def update_song(song_id: str, updates: dict):
    """Update song"""
    updates.pop("_id", None)
    updates.pop("song_id", None)
    result = await db.songs.update_one({"song_id": song_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Song not found")
    return {"message": "Song updated successfully"}

@api_router.delete("/songs/{song_id}")
async def delete_song(song_id: str):
    """Delete a song"""
    result = await db.songs.delete_one({"song_id": song_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Song not found")
    return {"message": "Song deleted successfully"}

@api_router.post("/songs/bulk-status")
async def bulk_update_song_status(data: dict):
    """Bulk update song status (activate/deactivate)"""
    song_ids = data.get("song_ids", [])
    status = data.get("status", "active")
    
    if not song_ids:
        raise HTTPException(status_code=400, detail="No song IDs provided")
    
    result = await db.songs.update_many(
        {"song_id": {"$in": song_ids}},
        {"$set": {"status": status}}
    )
    return {"message": f"{result.modified_count} songs updated to {status}"}

@api_router.post("/songs/bulk-delete")
async def bulk_delete_songs(data: dict):
    """Bulk delete songs"""
    song_ids = data.get("song_ids", [])
    
    if not song_ids:
        raise HTTPException(status_code=400, detail="No song IDs provided")
    
    result = await db.songs.delete_many({"song_id": {"$in": song_ids}})
    return {"message": f"{result.deleted_count} songs deleted"}

# ============== CHURCHES MANAGEMENT ==============

@api_router.get("/churches")
async def get_churches(status: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all churches"""
    query = {}
    if status:
        query["status"] = status
    churches = await db.churches.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.churches.count_documents(query)
    return {"churches": churches, "total": total}

@api_router.get("/churches/{church_id}")
async def get_church(church_id: str):
    """Get single church"""
    church = await db.churches.find_one({"church_id": church_id}, {"_id": 0})
    if not church:
        raise HTTPException(status_code=404, detail="Church not found")
    return church

@api_router.post("/churches")
async def create_church(church: dict):
    """Create a new church"""
    church_obj = Church(**church)
    doc = church_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.churches.insert_one(doc)
    return {"church_id": doc["church_id"], "message": "Church created successfully"}

@api_router.put("/churches/{church_id}")
async def update_church(church_id: str, updates: dict):
    """Update church"""
    updates.pop("_id", None)
    updates.pop("church_id", None)
    result = await db.churches.update_one({"church_id": church_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Church not found")
    return {"message": "Church updated successfully"}

@api_router.delete("/churches/{church_id}")
async def delete_church(church_id: str):
    """Delete a church"""
    result = await db.churches.delete_one({"church_id": church_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Church not found")
    return {"message": "Church deleted successfully"}

@api_router.post("/churches/{church_id}/approve")
async def approve_church(church_id: str, data: dict):
    """Admin approves a church"""
    approved_by = data.get("approved_by", "admin")
    admin_notes = data.get("admin_notes", "")
    
    result = await db.churches.update_one(
        {"church_id": church_id},
        {"$set": {
            "status": "approved",
            "admin_notes": admin_notes,
            "approved_by": approved_by,
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Church not found")
    return {"message": "Church approved successfully"}

@api_router.post("/churches/{church_id}/reject")
async def reject_church(church_id: str, data: dict):
    """Admin rejects a church"""
    rejected_by = data.get("rejected_by", "admin")
    admin_notes = data.get("admin_notes", "Rejected by admin")
    
    result = await db.churches.update_one(
        {"church_id": church_id},
        {"$set": {
            "status": "rejected",
            "admin_notes": admin_notes
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Church not found")
    return {"message": "Church rejected"}

@api_router.get("/churches/{church_id}/full")
async def get_church_full_details(church_id: str):
    """Get church with all details including announcements and prayer schedule"""
    church = await db.churches.find_one({"church_id": church_id}, {"_id": 0})
    if not church:
        raise HTTPException(status_code=404, detail="Church not found")
    
    # Get active announcements (not older than 2 weeks)
    two_weeks_ago = (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%d")
    announcements = await db.church_announcements.find(
        {"church_id": church_id, "date": {"$gte": two_weeks_ago}, "status": "active"},
        {"_id": 0}
    ).sort("date", -1).to_list(50)
    
    # Group announcements by date
    announcements_by_date = {}
    for ann in announcements:
        date = ann.get("date")
        if date not in announcements_by_date:
            announcements_by_date[date] = []
        announcements_by_date[date].append(ann)
    
    church["announcements"] = announcements_by_date
    church["announcements_list"] = announcements
    
    return church

# ============== CHURCH ANNOUNCEMENTS ==============

@api_router.get("/churches/{church_id}/announcements")
async def get_church_announcements(church_id: str, include_expired: bool = False):
    """Get announcements for a church"""
    query = {"church_id": church_id}
    if not include_expired:
        two_weeks_ago = (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%d")
        query["date"] = {"$gte": two_weeks_ago}
        query["status"] = "active"
    
    announcements = await db.church_announcements.find(query, {"_id": 0}).sort("date", -1).to_list(100)
    return {"announcements": announcements, "total": len(announcements)}

@api_router.post("/churches/{church_id}/announcements")
async def create_church_announcement(church_id: str, data: dict):
    """Create a new church announcement"""
    # Validate church exists
    church = await db.churches.find_one({"church_id": church_id})
    if not church:
        raise HTTPException(status_code=404, detail="Church not found")
    
    announcement = ChurchAnnouncement(
        church_id=church_id,
        church_name=church.get("name"),
        date=data.get("date"),
        title=data.get("title"),
        announcement_type=data.get("announcement_type", "general"),
        description=data.get("description"),
        time=data.get("time"),
        location=data.get("location"),
        contact_person=data.get("contact_person"),
        contact_phone=data.get("contact_phone"),
        is_recurring=data.get("is_recurring", False),
        recurrence_pattern=data.get("recurrence_pattern"),
        created_by=data.get("created_by")
    )
    
    # Set expiry to 2 weeks from announcement date
    try:
        ann_date = datetime.strptime(data.get("date"), "%Y-%m-%d")
        announcement.expires_at = ann_date + timedelta(days=14)
    except:
        pass
    
    doc = announcement.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    if doc.get("expires_at"):
        doc["expires_at"] = doc["expires_at"].isoformat()
    
    await db.church_announcements.insert_one(doc)
    
    # Notify followers
    await notify_followers("church", church_id, "new_announcement", {
        "church_name": church.get("name"),
        "announcement_title": data.get("title"),
        "announcement_type": data.get("announcement_type", "general")
    })
    
    return {"announcement_id": doc["announcement_id"], "message": "Announcement created"}

@api_router.put("/churches/{church_id}/announcements/{announcement_id}")
async def update_church_announcement(church_id: str, announcement_id: str, data: dict):
    """Update a church announcement"""
    data.pop("_id", None)
    data.pop("announcement_id", None)
    data.pop("church_id", None)
    
    result = await db.church_announcements.update_one(
        {"announcement_id": announcement_id, "church_id": church_id},
        {"$set": data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"message": "Announcement updated"}

@api_router.delete("/churches/{church_id}/announcements/{announcement_id}")
async def delete_church_announcement(church_id: str, announcement_id: str):
    """Delete a church announcement"""
    result = await db.church_announcements.delete_one(
        {"announcement_id": announcement_id, "church_id": church_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"message": "Announcement deleted"}

async def cleanup_old_announcements():
    """Background task to delete announcements older than 2 weeks"""
    two_weeks_ago = (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%d")
    result = await db.church_announcements.update_many(
        {"date": {"$lt": two_weeks_ago}, "status": "active"},
        {"$set": {"status": "archived"}}
    )
    return result.modified_count

# ============== FOLLOW SYSTEM ==============

@api_router.post("/user/follow")
async def follow_entity(data: dict, request: Request):
    """Follow a church, choir, or artist"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = token_doc.get("user_id")
    user = await db.app_users.find_one({"user_id": user_id})
    
    entity_type = data.get("entity_type")  # church, choir, artist
    entity_id = data.get("entity_id")
    
    if not entity_type or not entity_id:
        raise HTTPException(status_code=400, detail="entity_type and entity_id required")
    
    # Check if already following
    existing = await db.user_follows.find_one({
        "user_id": user_id,
        "entity_type": entity_type,
        "entity_id": entity_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already following")
    
    # Get entity name
    entity_name = ""
    if entity_type == "church":
        entity = await db.churches.find_one({"church_id": entity_id})
        entity_name = entity.get("name") if entity else ""
        # Increment followers count
        await db.churches.update_one({"church_id": entity_id}, {"$inc": {"followers_count": 1}})
    elif entity_type in ["choir", "artist"]:
        entity = await db.singers.find_one({"singer_id": entity_id})
        entity_name = entity.get("name") if entity else ""
        await db.singers.update_one({"singer_id": entity_id}, {"$inc": {"followers_count": 1}})
    
    follow = UserFollow(
        user_id=user_id,
        user_name=user.get("name") if user else None,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name
    )
    
    doc = follow.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.user_follows.insert_one(doc)
    
    return {"message": f"Now following {entity_name}", "follow_id": doc["follow_id"]}

@api_router.delete("/user/unfollow")
async def unfollow_entity(data: dict, request: Request):
    """Unfollow a church, choir, or artist"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = token_doc.get("user_id")
    entity_type = data.get("entity_type")
    entity_id = data.get("entity_id")
    
    result = await db.user_follows.delete_one({
        "user_id": user_id,
        "entity_type": entity_type,
        "entity_id": entity_id
    })
    
    if result.deleted_count > 0:
        # Decrement followers count
        if entity_type == "church":
            await db.churches.update_one({"church_id": entity_id}, {"$inc": {"followers_count": -1}})
        elif entity_type in ["choir", "artist"]:
            await db.singers.update_one({"singer_id": entity_id}, {"$inc": {"followers_count": -1}})
    
    return {"message": "Unfollowed successfully"}

@api_router.get("/user/following")
async def get_user_following(request: Request):
    """Get all entities the user is following"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = token_doc.get("user_id")
    follows = await db.user_follows.find({"user_id": user_id}, {"_id": 0}).to_list(500)
    
    # Group by type
    result = {
        "churches": [f for f in follows if f.get("entity_type") == "church"],
        "choirs": [f for f in follows if f.get("entity_type") in ["choir", "artist"]],
        "total": len(follows)
    }
    
    return result

@api_router.get("/user/is-following/{entity_type}/{entity_id}")
async def check_is_following(entity_type: str, entity_id: str, request: Request):
    """Check if user is following an entity"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return {"is_following": False}
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        return {"is_following": False}
    
    user_id = token_doc.get("user_id")
    follow = await db.user_follows.find_one({
        "user_id": user_id,
        "entity_type": entity_type,
        "entity_id": entity_id
    })
    
    return {"is_following": follow is not None}

async def notify_followers(entity_type: str, entity_id: str, notification_type: str, data: dict):
    """Notify all followers of an entity about new content"""
    followers = await db.user_follows.find({
        "entity_type": entity_type,
        "entity_id": entity_id,
        "notifications_enabled": True
    }).to_list(10000)
    
    notifications = []
    for follow in followers:
        notification = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": follow.get("user_id"),
            "type": notification_type,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "data": data,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        notifications.append(notification)
    
    if notifications:
        await db.user_notifications.insert_many(notifications)
    
    return len(notifications)

# ============== CHOIRS/ARTISTS FOR USER APP ==============

@api_router.get("/choirs")
async def get_choirs_list(status: Optional[str] = "approved", skip: int = 0, limit: int = 50):
    """Get all approved choirs/artists for user app"""
    query = {}
    if status:
        query["approval_status"] = status
    
    choirs = await db.singers.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with albums/songs count
    for choir in choirs:
        albums_count = await db.albums.count_documents({"artist_id": choir.get("singer_id"), "status": "active"})
        songs_count = await db.songs.count_documents({"artist_id": choir.get("singer_id"), "status": "active"})
        choir["albums_count"] = albums_count
        choir["songs_count"] = songs_count
    
    total = await db.singers.count_documents(query)
    return {"choirs": choirs, "total": total}

@api_router.get("/choirs/{choir_id}")
async def get_choir_details(choir_id: str):
    """Get choir/artist details with albums and songs"""
    choir = await db.singers.find_one({"singer_id": choir_id}, {"_id": 0})
    if not choir:
        raise HTTPException(status_code=404, detail="Choir/Artist not found")
    
    # Get albums by this choir
    albums = await db.albums.find(
        {"$or": [{"artist_id": choir_id}, {"choir_id": choir_id}], "status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Get all songs by this choir
    all_songs = await db.songs.find(
        {"$or": [{"artist_id": choir_id}, {"choir_id": choir_id}], "status": "active"},
        {"_id": 0}
    ).to_list(500)
    
    choir["albums"] = albums
    choir["all_songs"] = all_songs
    choir["albums_count"] = len(albums)
    choir["songs_count"] = len(all_songs)
    
    return choir

@api_router.get("/choirs/{choir_id}/songs")
async def get_choir_songs(choir_id: str):
    """Get all songs by a choir/artist"""
    songs = await db.songs.find(
        {"$or": [{"artist_id": choir_id}, {"choir_id": choir_id}], "status": "active"},
        {"_id": 0}
    ).to_list(500)
    
    # Get album info for each song
    album_ids = list(set([s.get("album_id") for s in songs if s.get("album_id")]))
    albums = await db.albums.find({"album_id": {"$in": album_ids}}, {"_id": 0}).to_list(100)
    album_map = {a["album_id"]: a for a in albums}
    
    for song in songs:
        album = album_map.get(song.get("album_id"), {})
        song["album_title"] = album.get("title")
        song["album_thumbnail"] = album.get("thumbnail")
    
    return {"songs": songs, "total": len(songs)}

# ============== LAYOUT MANAGER - CHOIRS & CHURCHES ==============

@api_router.get("/layout/choirs")
async def get_choirs_for_layout():
    """Get choirs/artists for layout manager selection"""
    choirs = await db.singers.find(
        {"approval_status": "approved"},
        {"_id": 0, "singer_id": 1, "name": 1, "photo": 1, "thumbnail": 1, "type": 1, "followers_count": 1}
    ).to_list(500)
    return {"choirs": choirs, "total": len(choirs)}

@api_router.get("/layout/churches")
async def get_churches_for_layout():
    """Get churches for layout manager selection"""
    churches = await db.churches.find(
        {"status": "approved"},
        {"_id": 0, "church_id": 1, "name": 1, "thumbnail": 1, "location": 1, "followers_count": 1}
    ).to_list(500)
    return {"churches": churches, "total": len(churches)}

# ============== RELIGIOUS LEADERS MANAGEMENT ==============

@api_router.get("/leaders")
async def get_leaders(status: Optional[str] = None, is_verified: Optional[bool] = None, skip: int = 0, limit: int = 50):
    """Get all religious leaders"""
    query = {}
    if status:
        query["status"] = status
    if is_verified is not None:
        query["is_verified"] = is_verified
    leaders = await db.religious_leaders.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.religious_leaders.count_documents(query)
    return {"leaders": leaders, "total": total}

@api_router.post("/leaders")
async def create_leader(leader: dict):
    """Create a new religious leader"""
    leader_obj = ReligiousLeader(**leader)
    doc = leader_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.religious_leaders.insert_one(doc)
    return {"leader_id": doc["leader_id"], "message": "Leader created successfully"}

@api_router.put("/leaders/{leader_id}")
async def update_leader(leader_id: str, updates: dict):
    """Update religious leader"""
    updates.pop("_id", None)
    updates.pop("leader_id", None)
    result = await db.religious_leaders.update_one({"leader_id": leader_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    return {"message": "Leader updated successfully"}

@api_router.delete("/leaders/{leader_id}")
async def delete_leader(leader_id: str):
    """Delete a religious leader"""
    result = await db.religious_leaders.delete_one({"leader_id": leader_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    return {"message": "Leader deleted successfully"}

# ============== SINGERS/CHOIRS MANAGEMENT ==============

@api_router.get("/singers")
async def get_singers(type: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all singers/choirs"""
    query = {}
    if type:
        query["type"] = type
    singers = await db.singers.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.singers.count_documents(query)
    return {"singers": singers, "total": total}

@api_router.post("/singers")
async def create_singer(singer: dict):
    """Create a new singer/choir"""
    singer_obj = Singer(**singer)
    doc = singer_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.singers.insert_one(doc)
    return {"singer_id": doc["singer_id"], "message": "Singer created successfully"}

@api_router.put("/singers/{singer_id}")
async def update_singer(singer_id: str, updates: dict):
    """Update singer"""
    updates.pop("_id", None)
    updates.pop("singer_id", None)
    result = await db.singers.update_one({"singer_id": singer_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Singer not found")
    return {"message": "Singer updated successfully"}

@api_router.delete("/singers/{singer_id}")
async def delete_singer(singer_id: str):
    """Delete a singer"""
    result = await db.singers.delete_one({"singer_id": singer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Singer not found")
    return {"message": "Singer deleted successfully"}

# ============== LIVE SEMINARS MANAGEMENT ==============

@api_router.get("/seminars")
async def get_seminars(status: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all live seminars"""
    query = {}
    if status:
        query["status"] = status
    seminars = await db.live_seminars.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.live_seminars.count_documents(query)
    return {"seminars": seminars, "total": total}

@api_router.post("/seminars")
async def create_seminar(seminar: dict):
    """Create a new live seminar"""
    seminar_obj = LiveSeminar(**seminar)
    doc = seminar_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.live_seminars.insert_one(doc)
    return {"seminar_id": doc["seminar_id"], "message": "Seminar created successfully"}

@api_router.put("/seminars/{seminar_id}")
async def update_seminar(seminar_id: str, updates: dict):
    """Update seminar"""
    updates.pop("_id", None)
    updates.pop("seminar_id", None)
    result = await db.live_seminars.update_one({"seminar_id": seminar_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Seminar not found")
    return {"message": "Seminar updated successfully"}

@api_router.delete("/seminars/{seminar_id}")
async def delete_seminar(seminar_id: str):
    """Delete a seminar"""
    result = await db.live_seminars.delete_one({"seminar_id": seminar_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Seminar not found")
    return {"message": "Seminar deleted successfully"}

# ============== AUDIO ROOMS MANAGEMENT ==============

@api_router.get("/audiorooms")
async def get_audio_rooms(status: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all audio rooms"""
    query = {}
    if status:
        query["status"] = status
    rooms = await db.audio_rooms.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.audio_rooms.count_documents(query)
    return {"rooms": rooms, "total": total}

@api_router.post("/audiorooms")
async def create_audio_room(room: dict):
    """Create a new audio room"""
    room_obj = AudioRoom(**room)
    doc = room_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.audio_rooms.insert_one(doc)
    return {"room_id": doc["room_id"], "message": "Audio room created successfully"}

@api_router.put("/audiorooms/{room_id}")
async def update_audio_room(room_id: str, updates: dict):
    """Update audio room"""
    updates.pop("_id", None)
    updates.pop("room_id", None)
    result = await db.audio_rooms.update_one({"room_id": room_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Audio room not found")
    return {"message": "Audio room updated successfully"}

@api_router.delete("/audiorooms/{room_id}")
async def delete_audio_room(room_id: str):
    """Delete an audio room"""
    result = await db.audio_rooms.delete_one({"room_id": room_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Audio room not found")
    return {"message": "Audio room deleted successfully"}

# ============== DONATION CAMPAIGNS MANAGEMENT ==============

@api_router.get("/donations")
async def get_donation_campaigns(status: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all donation campaigns"""
    query = {}
    if status:
        query["status"] = status
    campaigns = await db.donation_campaigns.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.donation_campaigns.count_documents(query)
    return {"campaigns": campaigns, "total": total}

@api_router.post("/donations")
async def create_donation_campaign(campaign: dict):
    """Create a new donation campaign"""
    campaign_obj = DonationCampaign(**campaign)
    doc = campaign_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.donation_campaigns.insert_one(doc)
    return {"campaign_id": doc["campaign_id"], "message": "Campaign created successfully"}

@api_router.put("/donations/{campaign_id}")
async def update_donation_campaign(campaign_id: str, updates: dict):
    """Update donation campaign"""
    updates.pop("_id", None)
    updates.pop("campaign_id", None)
    result = await db.donation_campaigns.update_one({"campaign_id": campaign_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"message": "Campaign updated successfully"}

@api_router.delete("/donations/{campaign_id}")
async def delete_donation_campaign(campaign_id: str):
    """Delete a donation campaign"""
    result = await db.donation_campaigns.delete_one({"campaign_id": campaign_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"message": "Campaign deleted successfully"}

# ============== COMMUNITY POSTS MODERATION ==============

@api_router.get("/community/posts")
async def get_community_posts(status: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all community posts"""
    query = {}
    if status:
        query["status"] = status
    posts = await db.community_posts.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.community_posts.count_documents(query)
    return {"posts": posts, "total": total}

@api_router.put("/community/posts/{post_id}")
async def update_community_post(post_id: str, updates: dict):
    """Update/moderate community post"""
    updates.pop("_id", None)
    updates.pop("post_id", None)
    result = await db.community_posts.update_one({"post_id": post_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"message": "Post updated successfully"}

@api_router.delete("/community/posts/{post_id}")
async def delete_community_post(post_id: str):
    """Delete a community post"""
    result = await db.community_posts.delete_one({"post_id": post_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"message": "Post deleted successfully"}

# ============== PRIEST BOOKINGS MANAGEMENT ==============

@api_router.get("/bookings")
async def get_priest_bookings(status: Optional[str] = None, priest_id: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all priest bookings"""
    query = {}
    if status:
        query["status"] = status
    if priest_id:
        query["priest_id"] = priest_id
    bookings = await db.priest_bookings.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.priest_bookings.count_documents(query)
    return {"bookings": bookings, "total": total}

@api_router.put("/bookings/{booking_id}")
async def update_priest_booking(booking_id: str, updates: dict):
    """Update priest booking status"""
    updates.pop("_id", None)
    updates.pop("booking_id", None)
    result = await db.priest_bookings.update_one({"booking_id": booking_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"message": "Booking updated successfully"}

# ============== APPROVALS ==============

@api_router.get("/approvals")
async def get_pending_approvals():
    """Get all pending approvals"""
    churches = await db.churches.find({"status": "pending"}, {"_id": 0}).to_list(100)
    leaders = await db.religious_leaders.find({"status": "pending"}, {"_id": 0}).to_list(100)
    posts = await db.community_posts.find({"status": "pending"}, {"_id": 0}).to_list(100)
    
    return {
        "churches": churches,
        "leaders": leaders,
        "posts": posts,
        "total": len(churches) + len(leaders) + len(posts)
    }

@api_router.post("/approvals/approve")
async def approve_item(data: dict):
    """Approve an item (church, leader, or post)"""
    item_type = data.get("type")
    item_id = data.get("id")
    
    if item_type == "church":
        await db.churches.update_one({"church_id": item_id}, {"$set": {"status": "approved"}})
    elif item_type == "leader":
        await db.religious_leaders.update_one({"leader_id": item_id}, {"$set": {"status": "approved", "is_verified": True}})
    elif item_type == "post":
        await db.community_posts.update_one({"post_id": item_id}, {"$set": {"status": "approved"}})
    else:
        raise HTTPException(status_code=400, detail="Invalid item type")
    
    return {"message": "Item approved successfully"}

@api_router.post("/approvals/reject")
async def reject_item(data: dict):
    """Reject an item"""
    item_type = data.get("type")
    item_id = data.get("id")
    
    if item_type == "church":
        await db.churches.update_one({"church_id": item_id}, {"$set": {"status": "rejected"}})
    elif item_type == "leader":
        await db.religious_leaders.update_one({"leader_id": item_id}, {"$set": {"status": "rejected"}})
    elif item_type == "post":
        await db.community_posts.update_one({"post_id": item_id}, {"$set": {"status": "rejected"}})
    else:
        raise HTTPException(status_code=400, detail="Invalid item type")
    
    return {"message": "Item rejected"}

# ============== REVENUE SETTINGS MANAGEMENT ==============

@api_router.get("/revenue/settings")
async def get_revenue_settings():
    """Get current revenue settings"""
    settings = await db.revenue_settings.find_one(
        {}, 
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    if not settings:
        # Return default settings
        return {
            "premium_rate_per_hour": 10.0,
            "standard_rate_per_hour": 5.0,
            "platform_share_percentage": 30.0,
            "minimum_withdrawal": 10000.0,
            "effective_from": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        }
    return settings

@api_router.post("/revenue/settings")
async def update_revenue_settings(settings: dict):
    """Update revenue settings (admin only)"""
    settings_obj = RevenueSettings(**settings)
    doc = settings_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["effective_from"] = settings.get("effective_from", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    await db.revenue_settings.insert_one(doc)
    return {"settings_id": doc["settings_id"], "message": "Settings updated successfully"}

@api_router.get("/revenue/settings/history")
async def get_revenue_settings_history():
    """Get history of revenue settings changes"""
    settings = await db.revenue_settings.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"settings": settings}

# ============== COMPREHENSIVE MONETIZATION SETTINGS ==============

@api_router.get("/monetization/settings")
async def get_monetization_settings():
    """Get all monetization settings"""
    settings = await db.monetization_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    
    # Always return full settings by merging with defaults
    default = MonetizationSettings()
    default_doc = default.model_dump()
    default_doc["created_at"] = default_doc["created_at"].isoformat()
    
    if not settings:
        return default_doc
    
    # Merge defaults with stored settings (stored takes precedence)
    merged = {**default_doc, **settings}
    return merged

@api_router.put("/monetization/settings")
async def update_monetization_settings(data: dict):
    """Update monetization settings (admin only)"""
    # Get current settings or defaults
    current = await db.monetization_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not current:
        # Use default settings as base
        default = MonetizationSettings()
        current = default.model_dump()
        current["created_at"] = current["created_at"].isoformat()
    
    # Check for rate changes to log history
    rate_changes = []
    if data.get("premium_rate_per_hour") and data["premium_rate_per_hour"] != current.get("premium_rate_per_hour"):
        rate_changes.append({
            "change_id": f"rate_{uuid.uuid4().hex[:12]}",
            "change_type": "premium_rate",
            "old_value": current.get("premium_rate_per_hour"),
            "new_value": data["premium_rate_per_hour"],
            "effective_date": data.get("rate_effective_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "changed_by": data.get("last_updated_by"),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    if data.get("standard_rate_per_hour") and data["standard_rate_per_hour"] != current.get("standard_rate_per_hour"):
        rate_changes.append({
            "change_id": f"rate_{uuid.uuid4().hex[:12]}",
            "change_type": "standard_rate",
            "old_value": current.get("standard_rate_per_hour"),
            "new_value": data["standard_rate_per_hour"],
            "effective_date": data.get("rate_effective_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "changed_by": data.get("last_updated_by"),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    if data.get("platform_fee_percentage") and data["platform_fee_percentage"] != current.get("platform_fee_percentage"):
        rate_changes.append({
            "change_id": f"rate_{uuid.uuid4().hex[:12]}",
            "change_type": "platform_fee",
            "old_value": current.get("platform_fee_percentage"),
            "new_value": data["platform_fee_percentage"],
            "effective_date": data.get("platform_fee_effective_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "changed_by": data.get("last_updated_by"),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Log rate changes
    if rate_changes:
        await db.rate_change_history.insert_many(rate_changes)
    
    # Merge current settings with new data (new data takes precedence)
    merged_settings = {**current, **data}
    merged_settings["updated_at"] = datetime.now(timezone.utc).isoformat()
    merged_settings["settings_id"] = f"monet_{uuid.uuid4().hex[:12]}"
    merged_settings["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.monetization_settings.insert_one(merged_settings)
    
    # Also update legacy revenue_settings for backward compatibility
    legacy_settings = {
        "settings_id": f"rev_{uuid.uuid4().hex[:12]}",
        "premium_rate_per_hour": merged_settings.get("premium_rate_per_hour", 10.0),
        "standard_rate_per_hour": merged_settings.get("standard_rate_per_hour", 5.0),
        "platform_share_percentage": merged_settings.get("platform_fee_percentage", 30.0),
        "minimum_withdrawal": merged_settings.get("minimum_payout_threshold", 10000.0),
        "effective_from": merged_settings.get("rate_effective_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.revenue_settings.insert_one(legacy_settings)
    
    return {"message": "Monetization settings updated", "settings_id": merged_settings["settings_id"]}

@api_router.get("/monetization/rate-history")
async def get_rate_change_history():
    """Get history of rate changes"""
    history = await db.rate_change_history.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"history": history}

# Subscription Plans
@api_router.get("/monetization/plans")
async def get_subscription_plans():
    """Get all subscription plans"""
    plans = await db.subscription_plans.find({}, {"_id": 0}).sort("sort_order", 1).to_list(20)
    if not plans:
        # Return default plans
        default_plans = [
            {"plan_id": "plan_daily", "name": "daily", "display_name": "Daily Pass", "price": 500, "duration_days": 1, "features": ["Unlimited streaming", "Ad-free"], "is_active": True, "sort_order": 1},
            {"plan_id": "plan_weekly", "name": "weekly", "display_name": "Weekly", "price": 2000, "duration_days": 7, "features": ["Unlimited streaming", "Ad-free", "Offline downloads"], "is_active": True, "sort_order": 2},
            {"plan_id": "plan_monthly", "name": "monthly", "display_name": "Monthly", "price": 5000, "duration_days": 30, "features": ["Unlimited streaming", "Ad-free", "Offline downloads", "High quality audio"], "is_active": True, "sort_order": 3},
            {"plan_id": "plan_yearly", "name": "yearly", "display_name": "Yearly", "price": 50000, "duration_days": 365, "features": ["Unlimited streaming", "Ad-free", "Offline downloads", "High quality audio", "2 months free"], "is_active": True, "sort_order": 4}
        ]
        return {"plans": default_plans}
    return {"plans": plans}

@api_router.post("/monetization/plans")
async def create_subscription_plan(data: dict):
    """Create a new subscription plan"""
    plan = SubscriptionPlan(
        name=data.get("name"),
        display_name=data.get("display_name"),
        price=data.get("price"),
        duration_days=data.get("duration_days"),
        features=data.get("features", []),
        is_active=data.get("is_active", True),
        sort_order=data.get("sort_order", 0)
    )
    doc = plan.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.subscription_plans.insert_one(doc)
    return {"plan_id": doc["plan_id"], "message": "Plan created"}

@api_router.put("/monetization/plans/{plan_id}")
async def update_subscription_plan(plan_id: str, data: dict):
    """Update a subscription plan"""
    update_data = {}
    allowed_fields = ["name", "display_name", "price", "duration_days", "features", "is_active", "sort_order"]
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    result = await db.subscription_plans.update_one({"plan_id": plan_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"message": "Plan updated"}

@api_router.delete("/monetization/plans/{plan_id}")
async def delete_subscription_plan(plan_id: str):
    """Delete a subscription plan"""
    result = await db.subscription_plans.delete_one({"plan_id": plan_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"message": "Plan deleted"}

# Emergency Controls
@api_router.post("/monetization/freeze-choir/{choir_id}")
async def freeze_choir_monetization(choir_id: str, data: dict):
    """Freeze monetization for a specific choir"""
    reason = data.get("reason", "")
    await db.singers.update_one(
        {"singer_id": choir_id},
        {"$set": {"monetization_frozen": True, "monetization_freeze_reason": reason}}
    )
    return {"message": "Choir monetization frozen"}

@api_router.post("/monetization/unfreeze-choir/{choir_id}")
async def unfreeze_choir_monetization(choir_id: str):
    """Unfreeze monetization for a specific choir"""
    await db.singers.update_one(
        {"singer_id": choir_id},
        {"$set": {"monetization_frozen": False, "monetization_freeze_reason": None}}
    )
    return {"message": "Choir monetization unfrozen"}

@api_router.post("/monetization/pause-all-payouts")
async def pause_all_payouts(data: dict):
    """Emergency: Pause all payouts"""
    reason = data.get("reason", "System maintenance")
    await db.monetization_settings.update_many(
        {},
        {"$set": {"all_payouts_paused": True, "payouts_paused_reason": reason, "payouts_paused_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "All payouts paused"}

@api_router.post("/monetization/resume-payouts")
async def resume_payouts():
    """Resume all payouts"""
    await db.monetization_settings.update_many(
        {},
        {"$set": {"all_payouts_paused": False, "payouts_paused_reason": None, "payouts_resumed_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Payouts resumed"}

# ============== SUBSCRIPTION FEATURE CONTROLS ==============

DEFAULT_FEATURE_CONTROLS = {
    "free": {
        "play_songs": "preview",  # preview, limited, full
        "preview_duration_seconds": 30,
        "album_playback": "shuffle_only",  # shuffle_only, sequential
        "song_selection": False,  # Can choose specific song
        "skips_per_hour": 6,
        "shuffle_control": False,  # Can toggle shuffle
        "show_ads": True,
        "premium_content_access": False,
        "downloads_allowed": False,
        "create_playlists": False,
        "add_to_favorites": True,
        "audio_quality": "standard",  # standard, high, lossless
        "background_play": "limited",  # limited, full
        "offline_mode": False,
    },
    "premium": {
        "play_songs": "full",
        "preview_duration_seconds": 0,  # No limit
        "album_playback": "all",  # Can play in order or shuffle
        "song_selection": True,
        "skips_per_hour": -1,  # Unlimited
        "shuffle_control": True,
        "show_ads": False,
        "premium_content_access": True,
        "downloads_allowed": True,
        "create_playlists": True,
        "add_to_favorites": True,
        "audio_quality": "high",
        "background_play": "full",
        "offline_mode": True,
    }
}

@api_router.get("/monetization/feature-controls")
async def get_feature_controls():
    """Get subscription feature controls for free vs paid users"""
    controls = await db.subscription_feature_controls.find_one({"_id": "feature_controls"})
    if not controls:
        # Return defaults
        return {"controls": DEFAULT_FEATURE_CONTROLS}
    del controls["_id"]
    return {"controls": controls.get("controls", DEFAULT_FEATURE_CONTROLS)}

@api_router.put("/monetization/feature-controls")
async def update_feature_controls(data: dict):
    """Update subscription feature controls"""
    controls = data.get("controls", {})
    await db.subscription_feature_controls.update_one(
        {"_id": "feature_controls"},
        {"$set": {"controls": controls, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"message": "Feature controls updated", "controls": controls}

@api_router.get("/monetization/trial-settings")
async def get_trial_settings():
    """Get free trial settings"""
    settings = await db.monetization_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not settings:
        return {
            "free_trial_enabled": True,
            "free_trial_days": 7,
            "trial_features_description": "Full premium access during trial"
        }
    return {
        "free_trial_enabled": settings.get("free_trial_enabled", True),
        "free_trial_days": settings.get("free_trial_days", 7),
        "trial_features_description": settings.get("trial_features_description", "Full premium access during trial")
    }

@api_router.put("/monetization/trial-settings")
async def update_trial_settings(data: dict):
    """Update free trial settings"""
    update_fields = {}
    if "free_trial_enabled" in data:
        update_fields["free_trial_enabled"] = data["free_trial_enabled"]
    if "free_trial_days" in data:
        update_fields["free_trial_days"] = int(data["free_trial_days"])
    if "trial_features_description" in data:
        update_fields["trial_features_description"] = data["trial_features_description"]
    
    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        # Get current settings or create new
        current = await db.monetization_settings.find_one({}, sort=[("created_at", -1)])
        if current:
            await db.monetization_settings.update_one(
                {"settings_id": current["settings_id"]},
                {"$set": update_fields}
            )
        else:
            new_settings = MonetizationSettings(**update_fields).model_dump()
            new_settings["created_at"] = new_settings["created_at"].isoformat()
            await db.monetization_settings.insert_one(new_settings)
    
    return {"message": "Trial settings updated", **update_fields}

@api_router.get("/monetization/trial-stats")
async def get_trial_stats():
    """Get trial usage statistics"""
    # Count users with active trials
    active_trials = await db.app_users.count_documents({"trial.status": "active"})
    expired_trials = await db.app_users.count_documents({"trial.status": "expired"})
    converted_trials = await db.app_users.count_documents({"trial.status": "converted"})
    total_trial_users = active_trials + expired_trials + converted_trials
    
    # Calculate conversion rate
    conversion_rate = (converted_trials / total_trial_users * 100) if total_trial_users > 0 else 0
    
    return {
        "active_trials": active_trials,
        "expired_trials": expired_trials,
        "converted_trials": converted_trials,
        "total_trial_users": total_trial_users,
        "conversion_rate": round(conversion_rate, 2)
    }

@api_router.get("/user/subscription-status")
async def get_user_subscription_status(request: Request):
    """Get user's subscription status and applicable feature controls"""
    auth_header = request.headers.get("Authorization", "")
    user_id = None
    is_premium = False
    is_trial = False
    trial_info = None
    subscription_info = None
    
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        token_doc = await db.user_tokens.find_one({"token": token})
        if token_doc:
            user_id = token_doc.get("user_id")
            # Check if user has active subscription or trial
            user = await db.app_users.find_one({"user_id": user_id})
            if user:
                # Check paid subscription first
                subscription = user.get("subscription", {})
                if subscription.get("status") == "active":
                    expires_at = subscription.get("expires_at")
                    if expires_at:
                        try:
                            exp_date = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                            if exp_date > datetime.now(timezone.utc):
                                is_premium = True
                                subscription_info = {
                                    "type": "paid",
                                    "plan": subscription.get("plan_name", "Premium"),
                                    "expires_at": expires_at,
                                    "days_remaining": (exp_date - datetime.now(timezone.utc)).days
                                }
                        except:
                            pass
                
                # If not premium, check trial status
                if not is_premium:
                    trial = user.get("trial", {})
                    if trial and trial.get("status") == "active":
                        trial_expires = trial.get("expires_at")
                        if trial_expires:
                            try:
                                exp_date = datetime.fromisoformat(trial_expires.replace("Z", "+00:00"))
                                if exp_date > datetime.now(timezone.utc):
                                    is_premium = True
                                    is_trial = True
                                    days_remaining = (exp_date - datetime.now(timezone.utc)).days
                                    trial_info = {
                                        "status": "active",
                                        "started_at": trial.get("started_at"),
                                        "expires_at": trial_expires,
                                        "days_remaining": days_remaining,
                                        "days_granted": trial.get("days_granted", 7)
                                    }
                                else:
                                    # Trial expired - update user record
                                    await db.app_users.update_one(
                                        {"user_id": user_id},
                                        {"$set": {"trial.status": "expired"}}
                                    )
                                    trial_info = {
                                        "status": "expired",
                                        "expired_at": trial_expires
                                    }
                            except:
                                pass
    
    # Get feature controls
    controls_doc = await db.subscription_feature_controls.find_one({"_id": "feature_controls"})
    all_controls = controls_doc.get("controls", DEFAULT_FEATURE_CONTROLS) if controls_doc else DEFAULT_FEATURE_CONTROLS
    
    tier = "premium" if is_premium else "free"
    user_controls = all_controls.get(tier, all_controls.get("free", DEFAULT_FEATURE_CONTROLS["free"]))
    
    # Get trial settings for display
    settings = await db.monetization_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    trial_settings = {
        "enabled": settings.get("free_trial_enabled", True) if settings else True,
        "days": settings.get("free_trial_days", 7) if settings else 7
    }
    
    return {
        "user_id": user_id,
        "is_premium": is_premium,
        "is_trial": is_trial,
        "subscription_tier": tier,
        "features": user_controls,
        "subscription": subscription_info,
        "trial": trial_info,
        "trial_settings": trial_settings
    }

# ============== LISTENING SESSIONS (for tracking) ==============

@api_router.post("/listening/start")
async def start_listening_session(data: dict):
    """Start a listening session when user plays a song"""
    song_id = data.get("song_id")
    user_id = data.get("user_id", "anonymous")
    
    # Get song and album info
    song = await db.songs.find_one({"song_id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    album = await db.albums.find_one({"album_id": song["album_id"]}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    now = datetime.now(timezone.utc)
    session = ListeningSession(
        user_id=user_id,
        song_id=song_id,
        album_id=song["album_id"],
        choir_id=album.get("artist_id", ""),
        content_type=album.get("monetization_type", "standard"),
        start_time=now.isoformat(),
        date=now.strftime("%Y-%m-%d"),
        month=now.strftime("%Y-%m")
    )
    doc = session.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.listening_sessions.insert_one(doc)
    
    # Increment play count
    await db.songs.update_one({"song_id": song_id}, {"$inc": {"plays": 1}})
    
    return {"session_id": doc["session_id"]}

@api_router.post("/listening/end")
async def end_listening_session(data: dict):
    """End a listening session and calculate duration"""
    session_id = data.get("session_id")
    
    session = await db.listening_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    now = datetime.now(timezone.utc)
    start_time = datetime.fromisoformat(session["start_time"].replace("Z", "+00:00"))
    duration_seconds = int((now - start_time).total_seconds())
    duration_hours = duration_seconds / 3600
    
    # Only count for revenue if duration >= 45 seconds
    counts_for_revenue = duration_seconds >= MIN_STREAM_DURATION_SECONDS
    
    await db.listening_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "end_time": now.isoformat(),
            "duration_seconds": duration_seconds,
            "duration_hours": duration_hours,
            "counts_for_revenue": counts_for_revenue
        }}
    )
    
    return {
        "duration_seconds": duration_seconds, 
        "duration_hours": round(duration_hours, 4),
        "counts_for_revenue": counts_for_revenue
    }

# ============== ADMIN REVENUE ANALYTICS ==============

@api_router.get("/revenue/admin/overview")
async def get_admin_revenue_overview():
    """Get platform-wide revenue overview for admin"""
    # Get current settings
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not settings:
        settings = {"premium_rate_per_hour": 10.0, "standard_rate_per_hour": 5.0, "platform_share_percentage": 30.0}
    
    # Only count streams >= 45 seconds for revenue
    revenue_filter = {"$or": [
        {"counts_for_revenue": True},
        {"duration_seconds": {"$gte": MIN_STREAM_DURATION_SECONDS}}
    ]}
    
    # Aggregate listening data (only counting revenue-eligible streams)
    pipeline = [
        {"$match": revenue_filter},
        {"$group": {
            "_id": "$content_type",
            "total_hours": {"$sum": "$duration_hours"},
            "total_sessions": {"$sum": 1}
        }}
    ]
    listening_stats = await db.listening_sessions.aggregate(pipeline).to_list(10)
    
    # Also get total streams (all) for comparison
    all_streams_count = await db.listening_sessions.count_documents({})
    revenue_streams_count = await db.listening_sessions.count_documents(revenue_filter)
    
    premium_hours = 0
    standard_hours = 0
    total_sessions = 0
    
    for stat in listening_stats:
        if stat["_id"] == "premium":
            premium_hours = stat["total_hours"]
        else:
            standard_hours = stat["total_hours"]
        total_sessions += stat["total_sessions"]
    
    total_hours = premium_hours + standard_hours
    
    # Calculate revenues
    premium_revenue = premium_hours * settings["premium_rate_per_hour"]
    standard_revenue = standard_hours * settings["standard_rate_per_hour"]
    gross_revenue = premium_revenue + standard_revenue
    platform_share = gross_revenue * (settings["platform_share_percentage"] / 100)
    choir_payouts = gross_revenue - platform_share
    
    # Get unique days with activity
    active_days_pipeline = [
        {"$group": {"_id": "$date"}},
        {"$count": "days"}
    ]
    active_days_result = await db.listening_sessions.aggregate(active_days_pipeline).to_list(1)
    active_days = active_days_result[0]["days"] if active_days_result else 1
    
    # Top performing choirs (only revenue-eligible streams)
    choir_pipeline = [
        {"$match": revenue_filter},
        {"$group": {
            "_id": "$choir_id",
            "total_hours": {"$sum": "$duration_hours"},
            "total_plays": {"$sum": 1}
        }},
        {"$sort": {"total_hours": -1}},
        {"$limit": 5}
    ]
    top_choirs_data = await db.listening_sessions.aggregate(choir_pipeline).to_list(5)
    
    # Enrich with choir names
    top_choirs = []
    for choir in top_choirs_data:
        singer = await db.singers.find_one({"singer_id": choir["_id"]}, {"_id": 0})
        if singer:
            choir_revenue = choir["total_hours"] * settings["standard_rate_per_hour"]
            top_choirs.append({
                "choir_id": choir["_id"],
                "name": singer["name"],
                "total_hours": round(choir["total_hours"], 2),
                "total_plays": choir["total_plays"],
                "revenue": round(choir_revenue, 2)
            })
    
    # Top performing albums
    album_pipeline = [
        {"$group": {
            "_id": "$album_id",
            "total_hours": {"$sum": "$duration_hours"},
            "total_plays": {"$sum": 1}
        }},
        {"$sort": {"total_hours": -1}},
        {"$limit": 5}
    ]
    top_albums_data = await db.listening_sessions.aggregate(album_pipeline).to_list(5)
    
    top_albums = []
    for album_data in top_albums_data:
        album = await db.albums.find_one({"album_id": album_data["_id"]}, {"_id": 0})
        if album:
            top_albums.append({
                "album_id": album_data["_id"],
                "title": album["title"],
                "artist": album.get("artist_name", "Unknown"),
                "total_hours": round(album_data["total_hours"], 2),
                "total_plays": album_data["total_plays"]
            })
    
    return {
        "summary": {
            "total_listening_hours": round(total_hours, 2),
            "premium_hours": round(premium_hours, 2),
            "standard_hours": round(standard_hours, 2),
            "total_sessions": total_sessions,
            "all_streams_count": all_streams_count,
            "revenue_streams_count": revenue_streams_count,  # Only streams >= 45s
            "gross_revenue": round(gross_revenue, 2),
            "platform_earnings": round(platform_share, 2),
            "choir_payouts": round(choir_payouts, 2),
            "avg_earning_per_hour": round(platform_share / max(total_hours, 1), 2),
            "avg_earning_per_day": round(platform_share / max(active_days, 1), 2),
            "active_days": active_days,
            "min_stream_duration_seconds": MIN_STREAM_DURATION_SECONDS
        },
        "rates": {
            "premium_rate": settings["premium_rate_per_hour"],
            "standard_rate": settings["standard_rate_per_hour"],
            "platform_share": settings["platform_share_percentage"]
        },
        "top_choirs": top_choirs,
        "top_albums": top_albums
    }

@api_router.get("/revenue/admin/daily")
async def get_admin_daily_revenue(days: int = 30):
    """Get daily revenue breakdown for admin"""
    # Get listening data grouped by date
    pipeline = [
        {"$group": {
            "_id": {"date": "$date", "type": "$content_type"},
            "hours": {"$sum": "$duration_hours"},
            "plays": {"$sum": 1}
        }},
        {"$sort": {"_id.date": -1}},
        {"$limit": days * 2}  # Account for premium + standard per day
    ]
    
    daily_data = await db.listening_sessions.aggregate(pipeline).to_list(days * 2)
    
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not settings:
        settings = {"premium_rate_per_hour": 10.0, "standard_rate_per_hour": 5.0, "platform_share_percentage": 30.0}
    
    # Organize by date
    by_date = {}
    for item in daily_data:
        date = item["_id"]["date"]
        if date not in by_date:
            by_date[date] = {"date": date, "premium_hours": 0, "standard_hours": 0, "plays": 0}
        
        if item["_id"]["type"] == "premium":
            by_date[date]["premium_hours"] = round(item["hours"], 2)
        else:
            by_date[date]["standard_hours"] = round(item["hours"], 2)
        by_date[date]["plays"] += item["plays"]
    
    # Calculate revenue for each day
    result = []
    for date, data in sorted(by_date.items(), reverse=True)[:days]:
        revenue = (data["premium_hours"] * settings["premium_rate_per_hour"] + 
                   data["standard_hours"] * settings["standard_rate_per_hour"])
        result.append({
            **data,
            "total_hours": round(data["premium_hours"] + data["standard_hours"], 2),
            "revenue": round(revenue, 2)
        })
    
    return {"daily_data": result}

@api_router.get("/revenue/admin/choirs")
async def get_all_choirs_revenue():
    """Get revenue breakdown for all choirs (admin view)"""
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not settings:
        settings = {"premium_rate_per_hour": 10.0, "standard_rate_per_hour": 5.0, "platform_share_percentage": 30.0}
    
    # Get all singers/choirs
    singers = await db.singers.find({}, {"_id": 0}).to_list(100)
    
    choir_revenues = []
    for singer in singers:
        # Get listening stats for this choir
        pipeline = [
            {"$match": {"choir_id": singer["singer_id"]}},
            {"$group": {
                "_id": "$content_type",
                "hours": {"$sum": "$duration_hours"},
                "plays": {"$sum": 1}
            }}
        ]
        stats = await db.listening_sessions.aggregate(pipeline).to_list(10)
        
        premium_hours = 0
        standard_hours = 0
        total_plays = 0
        
        for stat in stats:
            if stat["_id"] == "premium":
                premium_hours = stat["hours"]
            else:
                standard_hours = stat["hours"]
            total_plays += stat["plays"]
        
        gross = (premium_hours * settings["premium_rate_per_hour"] + 
                 standard_hours * settings["standard_rate_per_hour"])
        platform_share = gross * (settings["platform_share_percentage"] / 100)
        net = gross - platform_share
        
        # Get choir account balance
        account = await db.choir_accounts.find_one({"choir_id": singer["singer_id"]}, {"_id": 0})
        
        choir_revenues.append({
            "choir_id": singer["singer_id"],
            "name": singer["name"],
            "type": singer["type"],
            "premium_hours": round(premium_hours, 2),
            "standard_hours": round(standard_hours, 2),
            "total_hours": round(premium_hours + standard_hours, 2),
            "total_plays": total_plays,
            "gross_revenue": round(gross, 2),
            "platform_share": round(platform_share, 2),
            "net_revenue": round(net, 2),
            "current_balance": account["current_balance"] if account else 0,
            "account_status": account["status"] if account else "no_account"
        })
    
    # Sort by net revenue
    choir_revenues.sort(key=lambda x: x["net_revenue"], reverse=True)
    
    return {"choirs": choir_revenues}

@api_router.get("/analytics/enhanced")
async def get_enhanced_analytics(period: str = "30d"):
    """Get comprehensive analytics dashboard data"""
    # Parse period
    if period == "7d":
        days = 7
    elif period == "30d":
        days = 30
    elif period == "90d":
        days = 90
    elif period == "1y":
        days = 365
    else:
        days = 30
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not settings:
        settings = {"premium_rate_per_hour": 10.0, "standard_rate_per_hour": 5.0, "platform_share_percentage": 30.0}
    
    # Revenue eligible filter
    revenue_filter = {"$or": [
        {"counts_for_revenue": True},
        {"duration_seconds": {"$gte": MIN_STREAM_DURATION_SECONDS}}
    ]}
    
    # Total streams vs revenue-eligible streams
    total_streams = await db.listening_sessions.count_documents({})
    revenue_streams = await db.listening_sessions.count_documents(revenue_filter)
    
    # Unique listeners
    unique_listeners_pipeline = [
        {"$match": {"user_id": {"$ne": "anonymous"}}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"}
    ]
    unique_result = await db.listening_sessions.aggregate(unique_listeners_pipeline).to_list(1)
    unique_listeners = unique_result[0]["total"] if unique_result else 0
    
    # Unique songs played
    unique_songs_pipeline = [
        {"$group": {"_id": "$song_id"}},
        {"$count": "total"}
    ]
    unique_songs_result = await db.listening_sessions.aggregate(unique_songs_pipeline).to_list(1)
    unique_songs_played = unique_songs_result[0]["total"] if unique_songs_result else 0
    
    # Total listening time
    listening_pipeline = [
        {"$group": {
            "_id": None,
            "total_seconds": {"$sum": "$duration_seconds"},
            "total_hours": {"$sum": "$duration_hours"},
            "avg_duration": {"$avg": "$duration_seconds"}
        }}
    ]
    listening_result = await db.listening_sessions.aggregate(listening_pipeline).to_list(1)
    listening_stats = listening_result[0] if listening_result else {"total_seconds": 0, "total_hours": 0, "avg_duration": 0}
    
    # Revenue by content type
    revenue_pipeline = [
        {"$match": revenue_filter},
        {"$group": {
            "_id": "$content_type",
            "hours": {"$sum": "$duration_hours"},
            "streams": {"$sum": 1}
        }}
    ]
    revenue_by_type = await db.listening_sessions.aggregate(revenue_pipeline).to_list(10)
    
    premium_hours = 0
    standard_hours = 0
    for r in revenue_by_type:
        if r["_id"] == "premium":
            premium_hours = r["hours"]
        else:
            standard_hours = r["hours"]
    
    gross_revenue = (premium_hours * settings["premium_rate_per_hour"] + 
                    standard_hours * settings["standard_rate_per_hour"])
    platform_revenue = gross_revenue * (settings["platform_share_percentage"] / 100)
    
    # Daily trend data
    daily_pipeline = [
        {"$group": {
            "_id": "$date",
            "streams": {"$sum": 1},
            "hours": {"$sum": "$duration_hours"},
            "unique_users": {"$addToSet": "$user_id"}
        }},
        {"$sort": {"_id": -1}},
        {"$limit": days}
    ]
    daily_data = await db.listening_sessions.aggregate(daily_pipeline).to_list(days)
    
    daily_trend = []
    for d in reversed(daily_data):
        day_revenue = d["hours"] * settings["standard_rate_per_hour"]
        daily_trend.append({
            "date": d["_id"],
            "streams": d["streams"],
            "hours": round(d["hours"], 2),
            "unique_users": len(d["unique_users"]),
            "revenue": round(day_revenue, 2)
        })
    
    # Top songs
    top_songs_pipeline = [
        {"$group": {
            "_id": "$song_id",
            "plays": {"$sum": 1},
            "hours": {"$sum": "$duration_hours"}
        }},
        {"$sort": {"plays": -1}},
        {"$limit": 10}
    ]
    top_songs_data = await db.listening_sessions.aggregate(top_songs_pipeline).to_list(10)
    
    top_songs = []
    for s in top_songs_data:
        song = await db.songs.find_one({"song_id": s["_id"]}, {"_id": 0})
        if song:
            album = await db.albums.find_one({"album_id": song.get("album_id")}, {"_id": 0})
            top_songs.append({
                "song_id": s["_id"],
                "title": song.get("title", "Unknown"),
                "album": album.get("title") if album else "Unknown",
                "artist": album.get("artist_name") if album else "Unknown",
                "plays": s["plays"],
                "hours": round(s["hours"], 2)
            })
    
    # Top choirs with detailed stats
    choir_pipeline = [
        {"$match": revenue_filter},
        {"$group": {
            "_id": "$choir_id",
            "streams": {"$sum": 1},
            "hours": {"$sum": "$duration_hours"},
            "unique_listeners": {"$addToSet": "$user_id"}
        }},
        {"$sort": {"hours": -1}},
        {"$limit": 10}
    ]
    top_choirs_data = await db.listening_sessions.aggregate(choir_pipeline).to_list(10)
    
    top_choirs = []
    for c in top_choirs_data:
        singer = await db.singers.find_one({"singer_id": c["_id"]}, {"_id": 0})
        if singer:
            choir_revenue = c["hours"] * settings["standard_rate_per_hour"]
            top_choirs.append({
                "choir_id": c["_id"],
                "name": singer.get("name", "Unknown"),
                "streams": c["streams"],
                "hours": round(c["hours"], 2),
                "unique_listeners": len(c["unique_listeners"]),
                "revenue": round(choir_revenue, 2)
            })
    
    # Category breakdown
    category_pipeline = [
        {"$lookup": {
            "from": "albums",
            "localField": "album_id",
            "foreignField": "album_id",
            "as": "album"
        }},
        {"$unwind": {"path": "$album", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": "$album.category_name",
            "streams": {"$sum": 1},
            "hours": {"$sum": "$duration_hours"}
        }},
        {"$sort": {"streams": -1}},
        {"$limit": 10}
    ]
    category_data = await db.listening_sessions.aggregate(category_pipeline).to_list(10)
    
    categories = [{"name": c["_id"] or "Uncategorized", "streams": c["streams"], "hours": round(c["hours"], 2)} for c in category_data]
    
    # Platform stats
    total_albums = await db.albums.count_documents({"status": "active"})
    total_songs = await db.songs.count_documents({"status": "active"})
    total_choirs = await db.singers.count_documents({"status": "active"})
    total_users = await db.users.count_documents({})
    
    return {
        "period": period,
        "overview": {
            "total_streams": total_streams,
            "revenue_streams": revenue_streams,
            "unique_listeners": unique_listeners,
            "unique_songs_played": unique_songs_played,
            "total_listening_hours": round(listening_stats["total_hours"], 2),
            "avg_session_duration": round(listening_stats["avg_duration"] / 60, 2),  # in minutes
            "gross_revenue": round(gross_revenue, 2),
            "platform_revenue": round(platform_revenue, 2),
            "choir_payouts": round(gross_revenue - platform_revenue, 2)
        },
        "platform_stats": {
            "total_albums": total_albums,
            "total_songs": total_songs,
            "total_choirs": total_choirs,
            "total_users": total_users
        },
        "revenue_breakdown": {
            "premium_hours": round(premium_hours, 2),
            "standard_hours": round(standard_hours, 2),
            "premium_revenue": round(premium_hours * settings["premium_rate_per_hour"], 2),
            "standard_revenue": round(standard_hours * settings["standard_rate_per_hour"], 2)
        },
        "daily_trend": daily_trend,
        "top_songs": top_songs,
        "top_choirs": top_choirs,
        "categories": categories,
        "rates": {
            "premium_rate": settings["premium_rate_per_hour"],
            "standard_rate": settings["standard_rate_per_hour"],
            "platform_share": settings["platform_share_percentage"]
        }
    }

@api_router.get("/analytics/realtime")
async def get_realtime_analytics():
    """Get real-time analytics for the last hour"""
    one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    
    # Active sessions in last hour
    recent_pipeline = [
        {"$match": {"start_time": {"$gte": one_hour_ago}}},
        {"$group": {
            "_id": None,
            "active_streams": {"$sum": 1},
            "unique_listeners": {"$addToSet": "$user_id"}
        }}
    ]
    recent = await db.listening_sessions.aggregate(recent_pipeline).to_list(1)
    
    active_streams = recent[0]["active_streams"] if recent else 0
    active_listeners = len(recent[0]["unique_listeners"]) if recent else 0
    
    # Per-minute breakdown for last hour
    minute_pipeline = [
        {"$match": {"start_time": {"$gte": one_hour_ago}}},
        {"$project": {
            "minute": {"$substr": ["$start_time", 0, 16]}
        }},
        {"$group": {
            "_id": "$minute",
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    per_minute = await db.listening_sessions.aggregate(minute_pipeline).to_list(60)
    
    return {
        "active_streams": active_streams,
        "active_listeners": active_listeners,
        "per_minute": [{"time": m["_id"], "streams": m["count"]} for m in per_minute]
    }

# ============== USER APP ENDPOINTS ==============

@api_router.post("/user/register")
async def register_user(data: dict):
    """Register a new user with email/password or phone"""
    import hashlib
    
    email = data.get("email")
    phone = data.get("phone")
    password = data.get("password")
    name = data.get("name", "")
    
    if not password or (not email and not phone):
        raise HTTPException(status_code=400, detail="Email or phone and password required")
    
    # Check if user exists
    if email:
        existing = await db.app_users.find_one({"email": email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
    if phone:
        existing = await db.app_users.find_one({"phone": phone})
        if existing:
            raise HTTPException(status_code=400, detail="Phone already registered")
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    # Check if free trial is enabled
    settings = await db.monetization_settings.find_one({}, sort=[("created_at", -1)])
    trial_enabled = settings.get("free_trial_enabled", True) if settings else True
    trial_days = settings.get("free_trial_days", 7) if settings else 7
    
    # Calculate trial expiry
    trial_expires_at = None
    trial_status = None
    if trial_enabled and trial_days > 0:
        trial_expires_at = (datetime.now(timezone.utc) + timedelta(days=trial_days)).isoformat()
        trial_status = "active"
    
    user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "email": email,
        "phone": phone,
        "name": name,
        "password_hash": password_hash,
        "picture": None,
        "subscription_type": "free",  # free, premium
        "subscription_expires": None,
        "trial": {
            "status": trial_status,  # active, expired, converted, null
            "started_at": datetime.now(timezone.utc).isoformat() if trial_enabled else None,
            "expires_at": trial_expires_at,
            "days_granted": trial_days if trial_enabled else 0,
        } if trial_enabled else None,
        "favorites": [],
        "playlists": [],
        "recently_played": [],
        "downloads": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active"
    }
    
    await db.app_users.insert_one(user)
    del user["password_hash"]
    user.pop("_id", None)
    
    # Generate token
    token = f"tok_{uuid.uuid4().hex}"
    await db.user_tokens.insert_one({
        "token": token,
        "user_id": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    })
    
    return {
        "user": user, 
        "token": token,
        "trial_started": trial_enabled,
        "trial_days": trial_days if trial_enabled else 0,
        "trial_expires_at": trial_expires_at
    }

@api_router.post("/user/login")
async def login_user(data: dict):
    """Login user with email/phone and password"""
    import hashlib
    
    email = data.get("email")
    phone = data.get("phone")
    password = data.get("password")
    
    if not password or (not email and not phone):
        raise HTTPException(status_code=400, detail="Credentials required")
    
    query = {"email": email} if email else {"phone": phone}
    user = await db.app_users.find_one(query)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if user["password_hash"] != password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Generate token
    token = f"tok_{uuid.uuid4().hex}"
    await db.user_tokens.insert_one({
        "token": token,
        "user_id": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    })
    
    del user["password_hash"]
    user.pop("_id", None)
    
    return {"user": user, "token": token}

@api_router.get("/user/me")
async def get_user_profile(request: Request):
    """Get current user profile"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.replace("Bearer ", "")
    token_doc = await db.user_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.app_users.find_one({"user_id": token_doc["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

@api_router.get("/user/home")
async def get_user_home():
    """Get home screen data for the user app based on layout settings"""
    # Get active layout sections for app
    sections = await db.layout_sections.find(
        {"platforms": "app", "is_active": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(20)
    
    home_data = []
    
    for section in sections:
        section_data = {
            "section_id": section["section_id"],
            "type": section["section_type"],
            "title": section["display_name"],
            "description": section.get("description", "")
        }
        
        # Populate content based on type
        if section["section_type"] == "quick_access":
            categories = await db.categories.find(
                {"status": "active"},
                {"_id": 0}
            ).limit(section.get("content_count", 6)).to_list(6)
            section_data["items"] = categories
            
        elif section["section_type"] in ["featured_albums", "trending"]:
            albums = await db.albums.find(
                {"status": "active"},
                {"_id": 0}
            ).sort("created_at", -1).limit(section.get("content_count", 10)).to_list(10)
            section_data["items"] = albums
        
        elif section["section_type"] == "special_mixes":
            # Get special mix albums
            mixes = await db.special_mixes.find(
                {"status": "active"},
                {"_id": 0}
            ).sort("created_at", -1).limit(section.get("content_count", 10)).to_list(10)
            # Transform to album-like structure for consistency
            for mix in mixes:
                mix["album_id"] = mix["mix_id"]
                mix["is_special_mix"] = True
            section_data["items"] = mixes
        
        elif section["section_type"] == "choirs":
            # Get approved choirs/artists
            choirs = await db.singers.find(
                {"approval_status": "approved"},
                {"_id": 0}
            ).sort("followers_count", -1).limit(section.get("content_count", 10)).to_list(10)
            # Enrich with albums/songs count
            for choir in choirs:
                albums_count = await db.albums.count_documents({"artist_id": choir.get("singer_id"), "status": "active"})
                songs_count = await db.songs.count_documents({"artist_id": choir.get("singer_id"), "status": "active"})
                choir["albums_count"] = albums_count
                choir["songs_count"] = songs_count
                choir["entity_type"] = "choir"
            section_data["items"] = choirs
        
        elif section["section_type"] == "churches":
            # Get approved churches
            churches = await db.churches.find(
                {"status": "approved"},
                {"_id": 0}
            ).sort("followers_count", -1).limit(section.get("content_count", 10)).to_list(10)
            for church in churches:
                church["entity_type"] = "church"
            section_data["items"] = churches
            
        elif section["section_type"] == "hero":
            section_data["background"] = section.get("background_gradient") or section.get("background_color")
            section_data["items"] = []
            
        else:
            # For other types, get albums, categories, choirs, churches, or special mixes
            if section.get("content_ids"):
                content_type = section.get("content_type", "albums")
                if content_type == "albums":
                    items = await db.albums.find(
                        {"album_id": {"$in": section["content_ids"]}},
                        {"_id": 0}
                    ).to_list(20)
                elif content_type == "categories":
                    items = await db.categories.find(
                        {"category_id": {"$in": section["content_ids"]}},
                        {"_id": 0}
                    ).to_list(20)
                elif content_type == "special_mixes":
                    items = await db.special_mixes.find(
                        {"mix_id": {"$in": section["content_ids"]}},
                        {"_id": 0}
                    ).to_list(20)
                    for mix in items:
                        mix["album_id"] = mix["mix_id"]
                        mix["is_special_mix"] = True
                elif content_type == "choirs":
                    items = await db.singers.find(
                        {"singer_id": {"$in": section["content_ids"]}},
                        {"_id": 0}
                    ).to_list(20)
                    for choir in items:
                        choir["entity_type"] = "choir"
                elif content_type == "churches":
                    items = await db.churches.find(
                        {"church_id": {"$in": section["content_ids"]}},
                        {"_id": 0}
                    ).to_list(20)
                    for church in items:
                        church["entity_type"] = "church"
                else:
                    items = []
                section_data["items"] = items
            else:
                section_data["items"] = []
        
        home_data.append(section_data)
    
    # Get active burners
    burners = await db.layout_burners.find(
        {"platforms": "app", "is_active": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(5)
    
    # Get recently played (if authenticated, handled separately)
    
    return {
        "sections": home_data,
        "burners": burners
    }

DEFAULT_CATEGORIES = [
    {"category_id": "cat_prayers", "name": "Prayers", "description": "Prayer and meditation music", "icon": "book-open", "status": "active"},
    {"category_id": "cat_christmas", "name": "Christmas", "description": "Christmas carols and hymns", "icon": "star", "status": "active"},
    {"category_id": "cat_lent", "name": "Lent", "description": "Music for the Lenten season", "icon": "cross", "status": "active"},
    {"category_id": "cat_catechism", "name": "Catechism", "description": "Teaching songs and catechetical music", "icon": "church", "status": "active"},
    {"category_id": "cat_worship", "name": "Worship", "description": "Worship and praise music", "icon": "flame", "status": "active"},
    {"category_id": "cat_gospel", "name": "Gospel", "description": "Gospel music and spirituals", "icon": "sun", "status": "active"},
    {"category_id": "cat_hymns", "name": "Hymns", "description": "Traditional church hymns", "icon": "music", "status": "active"},
    {"category_id": "cat_praise", "name": "Praise", "description": "Contemporary praise music", "icon": "sparkles", "status": "active"},
    {"category_id": "cat_easter", "name": "Easter", "description": "Easter and resurrection songs", "icon": "sunrise", "status": "active"},
    {"category_id": "cat_marian", "name": "Marian", "description": "Songs honoring Mary", "icon": "heart", "status": "active"},
]

@api_router.get("/user/browse/categories")
async def browse_categories():
    """Get all categories for browsing"""
    categories = await db.categories.find({"status": "active"}, {"_id": 0}).to_list(50)
    
    # Create default categories if none exist
    if not categories:
        import copy
        for cat_data in DEFAULT_CATEGORIES:
            data_copy = copy.deepcopy(cat_data)
            data_copy["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.categories.insert_one(data_copy)
        categories = await db.categories.find({"status": "active"}, {"_id": 0}).to_list(50)
    
    return {"categories": categories}

@api_router.get("/user/browse/category/{category_id}")
async def get_category_albums(category_id: str):
    """Get albums in a category"""
    category = await db.categories.find_one({"category_id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    albums = await db.albums.find(
        {"category_id": category_id, "status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"category": category, "albums": albums}

@api_router.get("/user/album/{album_id}")
async def get_album_details(album_id: str):
    """Get album with all songs"""
    album = await db.albums.find_one({"album_id": album_id}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    songs = await db.songs.find(
        {"album_id": album_id, "status": "active"},
        {"_id": 0}
    ).sort("track_number", 1).to_list(100)
    
    # Get artist info
    artist = None
    if album.get("artist_id"):
        artist = await db.singers.find_one({"singer_id": album["artist_id"]}, {"_id": 0})
    
    return {"album": album, "songs": songs, "artist": artist}

@api_router.get("/user/search")
async def search_content(q: str):
    """Search albums, songs, and artists"""
    if not q or len(q) < 2:
        return {"albums": [], "songs": [], "artists": []}
    
    # Search albums
    albums = await db.albums.find(
        {"$or": [
            {"title": {"$regex": q, "$options": "i"}},
            {"artist_name": {"$regex": q, "$options": "i"}}
        ], "status": "active"},
        {"_id": 0}
    ).limit(10).to_list(10)
    
    # Search songs
    songs = await db.songs.find(
        {"title": {"$regex": q, "$options": "i"}, "status": "active"},
        {"_id": 0}
    ).limit(10).to_list(10)
    
    # Enrich songs with album info
    for song in songs:
        album = await db.albums.find_one({"album_id": song.get("album_id")}, {"_id": 0, "title": 1, "thumbnail": 1, "artist_name": 1})
        if album:
            song["album_title"] = album.get("title")
            song["album_thumbnail"] = album.get("thumbnail")
            song["artist_name"] = album.get("artist_name")
    
    # Search artists
    artists = await db.singers.find(
        {"name": {"$regex": q, "$options": "i"}, "status": "active"},
        {"_id": 0}
    ).limit(10).to_list(10)
    
    return {"albums": albums, "songs": songs, "artists": artists}

@api_router.post("/user/favorites/add")
async def add_to_favorites(request: Request, data: dict):
    """Add song or album to favorites"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.replace("Bearer ", "")
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    item_type = data.get("type")  # "song" or "album"
    item_id = data.get("id")
    
    await db.app_users.update_one(
        {"user_id": token_doc["user_id"]},
        {"$addToSet": {"favorites": {"type": item_type, "id": item_id, "added_at": datetime.now(timezone.utc).isoformat()}}}
    )
    
    return {"message": "Added to favorites"}

@api_router.post("/user/favorites/remove")
async def remove_from_favorites(request: Request, data: dict):
    """Remove from favorites"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.replace("Bearer ", "")
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    item_id = data.get("id")
    
    await db.app_users.update_one(
        {"user_id": token_doc["user_id"]},
        {"$pull": {"favorites": {"id": item_id}}}
    )
    
    return {"message": "Removed from favorites"}

@api_router.get("/user/library")
async def get_user_library(request: Request):
    """Get user's library (favorites, playlists, downloads)"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.replace("Bearer ", "")
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.app_users.find_one({"user_id": token_doc["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Enrich favorites with details
    favorites = []
    for fav in user.get("favorites", []):
        if fav["type"] == "song":
            song = await db.songs.find_one({"song_id": fav["id"]}, {"_id": 0})
            if song:
                album = await db.albums.find_one({"album_id": song.get("album_id")}, {"_id": 0})
                favorites.append({
                    "type": "song",
                    "item": song,
                    "album": album,
                    "added_at": fav.get("added_at")
                })
        elif fav["type"] == "album":
            album = await db.albums.find_one({"album_id": fav["id"]}, {"_id": 0})
            if album:
                favorites.append({
                    "type": "album",
                    "item": album,
                    "added_at": fav.get("added_at")
                })
    
    # Get playlists
    playlists = await db.playlists.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(50)
    
    # Recently played
    recent = await db.listening_sessions.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("start_time", -1).limit(20).to_list(20)
    
    recently_played = []
    seen_songs = set()
    for r in recent:
        if r["song_id"] not in seen_songs:
            song = await db.songs.find_one({"song_id": r["song_id"]}, {"_id": 0})
            if song:
                album = await db.albums.find_one({"album_id": song.get("album_id")}, {"_id": 0})
                recently_played.append({"song": song, "album": album})
                seen_songs.add(r["song_id"])
        if len(recently_played) >= 10:
            break
    
    return {
        "favorites": favorites,
        "playlists": playlists,
        "recently_played": recently_played,
        "downloads": user.get("downloads", [])
    }

@api_router.post("/user/playlist/create")
async def create_playlist(request: Request, data: dict):
    """Create a new playlist"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.replace("Bearer ", "")
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    playlist = {
        "playlist_id": f"pl_{uuid.uuid4().hex[:12]}",
        "user_id": token_doc["user_id"],
        "name": data.get("name", "My Playlist"),
        "description": data.get("description", ""),
        "songs": [],
        "is_public": data.get("is_public", False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.playlists.insert_one(playlist)
    playlist.pop("_id", None)
    
    return {"playlist": playlist}

@api_router.post("/user/playlist/{playlist_id}/add")
async def add_to_playlist(request: Request, playlist_id: str, data: dict):
    """Add song to playlist"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.replace("Bearer ", "")
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    song_id = data.get("song_id")
    
    result = await db.playlists.update_one(
        {"playlist_id": playlist_id, "user_id": token_doc["user_id"]},
        {"$addToSet": {"songs": song_id}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    return {"message": "Song added to playlist"}

@api_router.get("/user/playlist/{playlist_id}")
async def get_playlist(playlist_id: str):
    """Get playlist with songs"""
    playlist = await db.playlists.find_one({"playlist_id": playlist_id}, {"_id": 0})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Get songs
    songs = []
    for song_id in playlist.get("songs", []):
        song = await db.songs.find_one({"song_id": song_id}, {"_id": 0})
        if song:
            album = await db.albums.find_one({"album_id": song.get("album_id")}, {"_id": 0})
            songs.append({"song": song, "album": album})
    
    return {"playlist": playlist, "songs": songs}

# ============== CHOIR ACCOUNT MANAGEMENT ==============

@api_router.post("/choir/account/create")
async def create_choir_account(data: dict):
    """Create account for a choir (admin creates, choir gets credentials)"""
    import hashlib
    
    choir_id = data.get("choir_id")
    email = data.get("email")
    password = data.get("password")
    
    # Check if choir exists
    singer = await db.singers.find_one({"singer_id": choir_id}, {"_id": 0})
    if not singer:
        raise HTTPException(status_code=404, detail="Choir not found")
    
    # Check if account already exists
    existing = await db.choir_accounts.find_one({"choir_id": choir_id})
    if existing:
        raise HTTPException(status_code=400, detail="Account already exists for this choir")
    
    # Hash password
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    account = ChoirAccount(
        choir_id=choir_id,
        choir_name=singer["name"],
        email=email,
        password_hash=password_hash,
        status="approved"  # Admin-created accounts are auto-approved
    )
    doc = account.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.choir_accounts.insert_one(doc)
    
    return {"account_id": doc["account_id"], "message": "Choir account created successfully"}

@api_router.post("/choir/login")
async def choir_login(data: dict, response: Response):
    """Choir login endpoint"""
    import hashlib
    
    email = data.get("email")
    password = data.get("password")
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    account = await db.choir_accounts.find_one({
        "email": email,
        "password_hash": password_hash
    }, {"_id": 0})
    
    if not account:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if account["status"] != "approved":
        raise HTTPException(status_code=403, detail="Account not approved")
    
    # Create session
    session_token = f"choir_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_id": f"sess_{uuid.uuid4().hex}",
        "account_id": account["account_id"],
        "choir_id": account["choir_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.choir_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="choir_session",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    return {
        "choir_id": account["choir_id"],
        "choir_name": account["choir_name"],
        "email": account["email"],
        "session_token": session_token
    }

@api_router.get("/choir/me")
async def get_choir_profile(request: Request):
    """Get current choir profile"""
    session_token = request.cookies.get("choir_session")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.choir_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    account = await db.choir_accounts.find_one({"account_id": session["account_id"]}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    return {
        "choir_id": account["choir_id"],
        "choir_name": account["choir_name"],
        "email": account["email"],
        "current_balance": account["current_balance"],
        "total_earned": account["total_earned"],
        "total_withdrawn": account["total_withdrawn"],
        "status": account["status"]
    }

@api_router.post("/choir/logout")
async def choir_logout(request: Request, response: Response):
    """Choir logout"""
    session_token = request.cookies.get("choir_session")
    if session_token:
        await db.choir_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(key="choir_session", path="/")
    return {"message": "Logged out successfully"}

@api_router.get("/choir/accounts")
async def get_all_choir_accounts():
    """Get all choir accounts (admin view)"""
    accounts = await db.choir_accounts.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return {"accounts": accounts}

@api_router.put("/choir/account/{account_id}")
async def update_choir_account(account_id: str, updates: dict):
    """Update choir account status (admin)"""
    updates.pop("_id", None)
    updates.pop("account_id", None)
    updates.pop("password_hash", None)
    
    result = await db.choir_accounts.update_one({"account_id": account_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"message": "Account updated"}

# ============== CHURCH LEADER AUTHENTICATION ==============

@api_router.post("/church-leader/register")
async def church_leader_register(data: dict):
    """Church leader self-registration (requires approval)"""
    import hashlib
    
    church_id = data.get("church_id")
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    phone = data.get("phone")
    
    if not all([church_id, name, email, password]):
        raise HTTPException(status_code=400, detail="church_id, name, email, and password are required")
    
    # Check if church exists
    church = await db.churches.find_one({"church_id": church_id}, {"_id": 0})
    if not church:
        raise HTTPException(status_code=404, detail="Church not found")
    
    # Check if account already exists
    existing = await db.church_leader_accounts.find_one({"$or": [{"church_id": church_id}, {"email": email}]})
    if existing:
        raise HTTPException(status_code=400, detail="Account already exists for this church or email")
    
    # Hash password
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    account = ChurchLeaderAccount(
        church_id=church_id,
        church_name=church["name"],
        name=name,
        email=email,
        password_hash=password_hash,
        phone=phone,
        role="leader",
        status="pending"  # Requires admin approval
    )
    doc = account.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.church_leader_accounts.insert_one(doc)
    
    return {"account_id": doc["account_id"], "message": "Registration submitted - pending admin approval"}

@api_router.post("/church-leader/create")
async def admin_create_church_leader(data: dict):
    """Admin creates church leader account (auto-approved)"""
    import hashlib
    
    church_id = data.get("church_id")
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    phone = data.get("phone")
    
    if not all([church_id, name, email, password]):
        raise HTTPException(status_code=400, detail="church_id, name, email, and password are required")
    
    # Check if church exists
    church = await db.churches.find_one({"church_id": church_id}, {"_id": 0})
    if not church:
        raise HTTPException(status_code=404, detail="Church not found")
    
    # Check if account already exists
    existing = await db.church_leader_accounts.find_one({"$or": [{"church_id": church_id}, {"email": email}]})
    if existing:
        raise HTTPException(status_code=400, detail="Account already exists for this church or email")
    
    # Hash password
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    account = ChurchLeaderAccount(
        church_id=church_id,
        church_name=church["name"],
        name=name,
        email=email,
        password_hash=password_hash,
        phone=phone,
        role="admin_created",
        status="approved",
        approved_by="admin",
        approved_at=datetime.now(timezone.utc).isoformat()
    )
    doc = account.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.church_leader_accounts.insert_one(doc)
    
    return {"account_id": doc["account_id"], "message": "Church leader account created successfully"}

@api_router.post("/church-leader/login")
async def church_leader_login(data: dict, response: Response):
    """Church leader login"""
    import hashlib
    
    email = data.get("email")
    password = data.get("password")
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    account = await db.church_leader_accounts.find_one({
        "email": email,
        "password_hash": password_hash
    }, {"_id": 0})
    
    if not account:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if account["status"] != "approved":
        raise HTTPException(status_code=403, detail="Account pending approval")
    
    # Create session
    session_token = f"church_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_id": f"sess_{uuid.uuid4().hex}",
        "account_id": account["account_id"],
        "church_id": account["church_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.church_leader_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="church_leader_session",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    return {
        "church_id": account["church_id"],
        "church_name": account["church_name"],
        "name": account["name"],
        "email": account["email"],
        "session_token": session_token
    }

@api_router.get("/church-leader/me")
async def get_church_leader_profile(request: Request):
    """Get current church leader profile"""
    session_token = request.cookies.get("church_leader_session")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.church_leader_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    account = await db.church_leader_accounts.find_one({"account_id": session["account_id"]}, {"_id": 0, "password_hash": 0})
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    # Get church details
    church = await db.churches.find_one({"church_id": account["church_id"]}, {"_id": 0})
    
    return {
        "account_id": account["account_id"],
        "church_id": account["church_id"],
        "church_name": account["church_name"],
        "name": account["name"],
        "email": account["email"],
        "phone": account.get("phone"),
        "status": account["status"],
        "church": church
    }

@api_router.post("/church-leader/logout")
async def church_leader_logout(request: Request, response: Response):
    """Church leader logout"""
    session_token = request.cookies.get("church_leader_session")
    if session_token:
        await db.church_leader_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(key="church_leader_session", path="/")
    return {"message": "Logged out successfully"}

@api_router.get("/church-leader/my-announcements")
async def get_my_church_announcements(request: Request):
    """Get announcements for current church leader's church"""
    session_token = request.cookies.get("church_leader_session")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.church_leader_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    announcements = await db.church_announcements.find(
        {"church_id": session["church_id"]},
        {"_id": 0}
    ).sort("date", -1).to_list(100)
    
    return {"announcements": announcements}

@api_router.post("/church-leader/announcements")
async def create_announcement_by_leader(data: dict, request: Request):
    """Church leader creates announcement"""
    session_token = request.cookies.get("church_leader_session")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.church_leader_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    account = await db.church_leader_accounts.find_one({"account_id": session["account_id"]}, {"_id": 0})
    
    announcement = ChurchAnnouncement(
        church_id=session["church_id"],
        church_name=account["church_name"],
        date=data.get("date"),
        title=data.get("title"),
        announcement_type=data.get("announcement_type", "general"),
        description=data.get("description"),
        time=data.get("time"),
        location=data.get("location"),
        contact_person=data.get("contact_person"),
        contact_phone=data.get("contact_phone"),
        is_recurring=data.get("is_recurring", False),
        recurrence_pattern=data.get("recurrence_pattern"),
        created_by=account["name"]
    )
    
    # Set expiry to 2 weeks from announcement date
    try:
        ann_date = datetime.strptime(data.get("date"), "%Y-%m-%d")
        announcement.expires_at = ann_date + timedelta(days=14)
    except:
        pass
    
    doc = announcement.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    if doc.get("expires_at"):
        doc["expires_at"] = doc["expires_at"].isoformat()
    
    await db.church_announcements.insert_one(doc)
    
    # Notify followers
    await notify_followers("church", session["church_id"], "new_announcement", {
        "church_name": account["church_name"],
        "announcement_title": data.get("title"),
        "announcement_type": data.get("announcement_type", "general")
    })
    
    return {"announcement_id": doc["announcement_id"], "message": "Announcement created"}

@api_router.get("/church-leader/accounts")
async def get_all_church_leader_accounts():
    """Get all church leader accounts (admin view)"""
    accounts = await db.church_leader_accounts.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return {"accounts": accounts}

@api_router.put("/church-leader/account/{account_id}/approve")
async def approve_church_leader_account(account_id: str, data: dict):
    """Approve church leader account"""
    result = await db.church_leader_accounts.update_one(
        {"account_id": account_id},
        {"$set": {
            "status": "approved",
            "approved_by": data.get("approved_by", "admin"),
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"message": "Account approved"}

@api_router.put("/church-leader/account/{account_id}/reject")
async def reject_church_leader_account(account_id: str, data: dict):
    """Reject church leader account"""
    result = await db.church_leader_accounts.update_one(
        {"account_id": account_id},
        {"$set": {"status": "rejected", "admin_notes": data.get("admin_notes")}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"message": "Account rejected"}

# ============== CHOIR CONTENT EDITING ==============

@api_router.post("/choir/albums/{album_id}/edit-request")
async def request_album_edit(album_id: str, data: dict, request: Request):
    """Choir requests to edit an album - requires admin approval"""
    session_token = request.cookies.get("choir_session")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.choir_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Get album and verify ownership
    album = await db.albums.find_one({"album_id": album_id}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    if album.get("singer_id") != session["choir_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to edit this album")
    
    account = await db.choir_accounts.find_one({"choir_id": session["choir_id"]}, {"_id": 0})
    
    # Create edit request
    edit_request = ContentEditRequest(
        choir_id=session["choir_id"],
        choir_name=account["choir_name"],
        content_type="album",
        content_id=album_id,
        original_data=album,
        updated_data=data
    )
    doc = edit_request.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.content_edit_requests.insert_one(doc)
    
    return {"request_id": doc["request_id"], "message": "Edit request submitted for approval"}

@api_router.post("/choir/songs/{song_id}/edit-request")
async def request_song_edit(song_id: str, data: dict, request: Request):
    """Choir requests to edit a song - requires admin approval"""
    session_token = request.cookies.get("choir_session")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.choir_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Get song and verify ownership
    song = await db.songs.find_one({"song_id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    if song.get("singer_id") != session["choir_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to edit this song")
    
    account = await db.choir_accounts.find_one({"choir_id": session["choir_id"]}, {"_id": 0})
    
    # Create edit request
    edit_request = ContentEditRequest(
        choir_id=session["choir_id"],
        choir_name=account["choir_name"],
        content_type="song",
        content_id=song_id,
        original_data=song,
        updated_data=data
    )
    doc = edit_request.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.content_edit_requests.insert_one(doc)
    
    return {"request_id": doc["request_id"], "message": "Edit request submitted for approval"}

@api_router.get("/choir/my-edit-requests")
async def get_my_edit_requests(request: Request):
    """Get choir's content edit requests"""
    session_token = request.cookies.get("choir_session")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.choir_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    requests = await db.content_edit_requests.find(
        {"choir_id": session["choir_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"requests": requests}

@api_router.get("/admin/content-edit-requests")
async def get_all_content_edit_requests(status: Optional[str] = None):
    """Get all content edit requests (admin view)"""
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.content_edit_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"requests": requests}

@api_router.post("/admin/content-edit-requests/{request_id}/approve")
async def approve_content_edit(request_id: str, data: dict):
    """Approve content edit request and apply changes"""
    edit_req = await db.content_edit_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not edit_req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if edit_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")
    
    # Apply the changes
    content_type = edit_req["content_type"]
    content_id = edit_req["content_id"]
    updated_data = edit_req["updated_data"]
    
    # Remove fields that shouldn't be overwritten
    updated_data.pop("_id", None)
    updated_data.pop("album_id", None)
    updated_data.pop("song_id", None)
    updated_data.pop("singer_id", None)
    updated_data.pop("choir_id", None)
    
    if content_type == "album":
        await db.albums.update_one({"album_id": content_id}, {"$set": updated_data})
    elif content_type == "song":
        await db.songs.update_one({"song_id": content_id}, {"$set": updated_data})
    
    # Update request status
    await db.content_edit_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "approved",
            "processed_by": data.get("processed_by", "admin"),
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "admin_notes": data.get("admin_notes")
        }}
    )
    
    return {"message": f"{content_type.capitalize()} updated successfully"}

@api_router.post("/admin/content-edit-requests/{request_id}/reject")
async def reject_content_edit(request_id: str, data: dict):
    """Reject content edit request"""
    result = await db.content_edit_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": "rejected",
            "processed_by": data.get("processed_by", "admin"),
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "admin_notes": data.get("admin_notes")
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"message": "Edit request rejected"}

# ============== CHOIR REVENUE ANALYTICS ==============

@api_router.get("/choir/revenue/{choir_id}")
async def get_choir_revenue(choir_id: str):
    """Get revenue analytics for a specific choir"""
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not settings:
        settings = {"premium_rate_per_hour": 10.0, "standard_rate_per_hour": 5.0, "platform_share_percentage": 30.0, "minimum_withdrawal": 10000}
    
    # Only count streams >= 45 seconds for revenue
    revenue_filter = {"choir_id": choir_id, "$or": [
        {"counts_for_revenue": True},
        {"duration_seconds": {"$gte": MIN_STREAM_DURATION_SECONDS}}
    ]}
    
    # Get overall stats (only revenue-eligible streams)
    pipeline = [
        {"$match": revenue_filter},
        {"$group": {
            "_id": "$content_type",
            "hours": {"$sum": "$duration_hours"},
            "plays": {"$sum": 1}
        }}
    ]
    stats = await db.listening_sessions.aggregate(pipeline).to_list(10)
    
    # Also get all streams for comparison
    all_streams = await db.listening_sessions.count_documents({"choir_id": choir_id})
    revenue_streams = await db.listening_sessions.count_documents(revenue_filter)
    
    # Calculate total listening time (in minutes and hours)
    total_time_pipeline = [
        {"$match": revenue_filter},
        {"$group": {
            "_id": None,
            "total_seconds": {"$sum": "$duration_seconds"},
            "total_hours": {"$sum": "$duration_hours"}
        }}
    ]
    total_time_result = await db.listening_sessions.aggregate(total_time_pipeline).to_list(1)
    total_seconds = total_time_result[0]["total_seconds"] if total_time_result else 0
    total_minutes = total_seconds / 60
    
    premium_hours = 0
    standard_hours = 0
    total_plays = 0
    
    for stat in stats:
        if stat["_id"] == "premium":
            premium_hours = stat["hours"]
        else:
            standard_hours = stat["hours"]
        total_plays += stat["plays"]
    
    gross = (premium_hours * settings["premium_rate_per_hour"] + 
             standard_hours * settings["standard_rate_per_hour"])
    platform_share = gross * (settings["platform_share_percentage"] / 100)
    net = gross - platform_share
    
    # Get account info
    account = await db.choir_accounts.find_one({"choir_id": choir_id}, {"_id": 0, "password_hash": 0})
    
    # Get album performance (only revenue-eligible streams)
    album_pipeline = [
        {"$match": revenue_filter},
        {"$group": {
            "_id": "$album_id",
            "premium_hours": {"$sum": {"$cond": [{"$eq": ["$content_type", "premium"]}, "$duration_hours", 0]}},
            "standard_hours": {"$sum": {"$cond": [{"$ne": ["$content_type", "premium"]}, "$duration_hours", 0]}},
            "total_plays": {"$sum": 1}
        }},
        {"$sort": {"total_plays": -1}}
    ]
    album_stats = await db.listening_sessions.aggregate(album_pipeline).to_list(50)
    
    albums_performance = []
    for album_stat in album_stats:
        album = await db.albums.find_one({"album_id": album_stat["_id"]}, {"_id": 0})
        if album:
            album_revenue = (album_stat["premium_hours"] * settings["premium_rate_per_hour"] + 
                           album_stat["standard_hours"] * settings["standard_rate_per_hour"])
            albums_performance.append({
                "album_id": album_stat["_id"],
                "title": album["title"],
                "monetization_type": album.get("monetization_type", "standard"),
                "premium_hours": round(album_stat["premium_hours"], 2),
                "standard_hours": round(album_stat["standard_hours"], 2),
                "total_hours": round(album_stat["premium_hours"] + album_stat["standard_hours"], 2),
                "total_plays": album_stat["total_plays"],
                "revenue": round(album_revenue, 2),
                "revenue_percentage": round((album_revenue / max(gross, 1)) * 100, 1)
            })
    
    # Monthly breakdown (only revenue-eligible streams)
    monthly_pipeline = [
        {"$match": revenue_filter},
        {"$group": {
            "_id": "$month",
            "premium_hours": {"$sum": {"$cond": [{"$eq": ["$content_type", "premium"]}, "$duration_hours", 0]}},
            "standard_hours": {"$sum": {"$cond": [{"$ne": ["$content_type", "premium"]}, "$duration_hours", 0]}},
            "plays": {"$sum": 1}
        }},
        {"$sort": {"_id": -1}},
        {"$limit": 12}
    ]
    monthly_data = await db.listening_sessions.aggregate(monthly_pipeline).to_list(12)
    
    monthly_revenue = []
    for month in monthly_data:
        month_gross = (month["premium_hours"] * settings["premium_rate_per_hour"] + 
                      month["standard_hours"] * settings["standard_rate_per_hour"])
        month_net = month_gross * (1 - settings["platform_share_percentage"] / 100)
        monthly_revenue.append({
            "month": month["_id"],
            "premium_hours": round(month["premium_hours"], 2),
            "standard_hours": round(month["standard_hours"], 2),
            "plays": month["plays"],
            "gross_revenue": round(month_gross, 2),
            "net_revenue": round(month_net, 2)
        })
    
    return {
        "summary": {
            "total_hours": round(premium_hours + standard_hours, 2),
            "total_minutes": round(total_minutes, 0),
            "premium_hours": round(premium_hours, 2),
            "standard_hours": round(standard_hours, 2),
            "total_plays": total_plays,
            "all_streams_count": all_streams,
            "unique_streams_count": revenue_streams,  # Streams >= 45s
            "gross_revenue": round(gross, 2),
            "platform_share": round(platform_share, 2),
            "net_revenue": round(net, 2),
            "current_balance": account["current_balance"] if account else 0,
            "total_withdrawn": account["total_withdrawn"] if account else 0
        },
        "rates": {
            "premium_rate": settings["premium_rate_per_hour"],
            "standard_rate": settings["standard_rate_per_hour"],
            "platform_share": settings["platform_share_percentage"],
            "minimum_withdrawal": settings.get("minimum_withdrawal", 10000)
        },
        "albums": albums_performance,
        "monthly": monthly_revenue
    }

# ============== CHOIR PAYMENT DETAILS ==============

async def get_choir_from_session(request: Request):
    """Helper to get choir account from session"""
    session_token = request.cookies.get("choir_session")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.choir_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    account = await db.choir_accounts.find_one({"account_id": session["account_id"]}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    return account

@api_router.post("/choir/payment-details/request-otp")
async def request_otp_for_mobile_money(data: dict, request: Request):
    """Request OTP for mobile money verification (MOCK)"""
    account = await get_choir_from_session(request)
    phone_number = data.get("phone_number")
    
    if not phone_number:
        raise HTTPException(status_code=400, detail="Phone number required")
    
    # Generate 6-digit OTP (In production, send via SMS)
    import random
    otp_code = str(random.randint(100000, 999999))
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    
    # Store OTP
    otp_doc = {
        "otp_id": f"otp_{uuid.uuid4().hex[:12]}",
        "choir_id": account["choir_id"],
        "phone_number": phone_number,
        "otp_code": otp_code,
        "verified": False,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.otp_verifications.insert_one(otp_doc)
    
    # In production, send SMS here. For now, return the OTP in response (MOCK)
    return {
        "message": "OTP sent to phone number",
        "otp_id": otp_doc["otp_id"],
        "mock_otp": otp_code,  # REMOVE IN PRODUCTION - only for demo
        "expires_in_minutes": 10
    }

@api_router.post("/choir/payment-details/verify-otp")
async def verify_otp(data: dict, request: Request):
    """Verify OTP for mobile money"""
    account = await get_choir_from_session(request)
    otp_id = data.get("otp_id")
    otp_code = data.get("otp_code")
    
    otp_record = await db.otp_verifications.find_one({
        "otp_id": otp_id,
        "choir_id": account["choir_id"]
    }, {"_id": 0})
    
    if not otp_record:
        raise HTTPException(status_code=404, detail="OTP not found")
    
    expires_at = datetime.fromisoformat(otp_record["expires_at"].replace("Z", "+00:00"))
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired")
    
    if otp_record["otp_code"] != otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Mark as verified
    await db.otp_verifications.update_one(
        {"otp_id": otp_id},
        {"$set": {"verified": True}}
    )
    
    return {"message": "OTP verified successfully", "phone_number": otp_record["phone_number"]}

@api_router.post("/choir/payment-details/submit")
async def submit_payment_details(data: dict, request: Request):
    """Submit payment details for approval"""
    account = await get_choir_from_session(request)
    
    payment_method = data.get("payment_method")  # mobile_money or bank_transfer
    payment_details = data.get("payment_details", {})
    otp_id = data.get("otp_id")  # Required for mobile money
    
    if payment_method not in ["mobile_money", "bank_transfer"]:
        raise HTTPException(status_code=400, detail="Invalid payment method")
    
    otp_verified = False
    if payment_method == "mobile_money":
        if not otp_id:
            raise HTTPException(status_code=400, detail="OTP verification required for mobile money")
        
        otp_record = await db.otp_verifications.find_one({
            "otp_id": otp_id,
            "choir_id": account["choir_id"],
            "verified": True
        }, {"_id": 0})
        
        if not otp_record:
            raise HTTPException(status_code=400, detail="Please verify phone number first")
        
        payment_details["phone"] = otp_record["phone_number"]
        otp_verified = True
    else:
        # Bank transfer validation
        if not payment_details.get("bank_name") or not payment_details.get("account_number"):
            raise HTTPException(status_code=400, detail="Bank name and account number required")
    
    # Create payment detail change request for admin approval
    change_request = PaymentDetailChangeRequest(
        choir_id=account["choir_id"],
        choir_name=account["choir_name"],
        payment_method=payment_method,
        payment_details=payment_details,
        otp_verified=otp_verified
    )
    doc = change_request.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.payment_change_requests.insert_one(doc)
    
    # Create notification for priest/admin
    notification = PriestNotification(
        notification_type="payment_change",
        choir_id=account["choir_id"],
        choir_name=account["choir_name"],
        message=f"{account['choir_name']} has requested to update their payment details ({payment_method})",
        details={"request_id": doc["request_id"], "payment_method": payment_method}
    )
    notif_doc = notification.model_dump()
    notif_doc["created_at"] = notif_doc["created_at"].isoformat()
    await db.priest_notifications.insert_one(notif_doc)
    
    return {"message": "Payment details submitted for approval", "request_id": doc["request_id"]}

@api_router.get("/choir/payment-details")
async def get_my_payment_details(request: Request):
    """Get current payment details for choir"""
    account = await get_choir_from_session(request)
    
    # Get any pending requests
    pending_request = await db.payment_change_requests.find_one({
        "choir_id": account["choir_id"],
        "status": "pending"
    }, {"_id": 0})
    
    return {
        "current_method": account.get("payment_method"),
        "current_details": account.get("payment_details"),
        "details_status": account.get("payment_details_status", "not_set"),
        "pending_request": pending_request
    }

# ============== ADMIN PAYMENT APPROVAL ==============

@api_router.get("/admin/payment-requests")
async def get_payment_change_requests(status: Optional[str] = None):
    """Get all payment change requests (admin)"""
    query = {}
    if status:
        query["status"] = status
    requests = await db.payment_change_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"requests": requests}

@api_router.put("/admin/payment-requests/{request_id}")
async def process_payment_request(request_id: str, data: dict):
    """Approve or reject payment detail change request"""
    status = data.get("status")  # approved or rejected
    admin_notes = data.get("admin_notes", "")
    processed_by = data.get("processed_by", "admin")
    
    if status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be approved or rejected")
    
    change_request = await db.payment_change_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not change_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Update request status
    await db.payment_change_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": status,
            "admin_notes": admin_notes,
            "processed_by": processed_by,
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # If approved, update the choir account
    if status == "approved":
        await db.choir_accounts.update_one(
            {"choir_id": change_request["choir_id"]},
            {"$set": {
                "payment_method": change_request["payment_method"],
                "payment_details": change_request["payment_details"],
                "payment_details_status": "approved",
                "payment_details_updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {"message": f"Payment request {status}"}

# ============== CHOIR CONTENT UPLOAD (WITH APPROVAL) ==============

@api_router.post("/choir/albums/create")
async def choir_create_album_request(data: dict, request: Request):
    """Choir requests to create an album (requires admin approval)"""
    account = await get_choir_from_session(request)
    
    album_data = {
        "title": data.get("title"),
        "description": data.get("description"),
        "category_id": data.get("category_id"),
        "monetization_type": data.get("monetization_type", "standard"),
        "release_date": data.get("release_date"),
        "thumbnail": data.get("thumbnail")
    }
    
    if not album_data["title"]:
        raise HTTPException(status_code=400, detail="Album title required")
    
    # Create content request
    content_request = ChoirContentRequest(
        choir_id=account["choir_id"],
        choir_name=account["choir_name"],
        request_type="album_create",
        content_data=album_data
    )
    doc = content_request.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.choir_content_requests.insert_one(doc)
    
    # Notify priest/admin
    notification = PriestNotification(
        notification_type="content_request",
        choir_id=account["choir_id"],
        choir_name=account["choir_name"],
        message=f"{account['choir_name']} wants to create a new album: {album_data['title']}",
        details={"request_id": doc["request_id"], "album_title": album_data["title"]}
    )
    notif_doc = notification.model_dump()
    notif_doc["created_at"] = notif_doc["created_at"].isoformat()
    await db.priest_notifications.insert_one(notif_doc)
    
    return {"message": "Album creation request submitted for approval", "request_id": doc["request_id"]}

@api_router.post("/choir/songs/upload")
async def choir_upload_song_request(data: dict, request: Request):
    """Choir requests to upload a song (requires admin approval)"""
    account = await get_choir_from_session(request)
    
    song_data = {
        "title": data.get("title"),
        "album_id": data.get("album_id"),
        "duration": data.get("duration"),
        "duration_formatted": data.get("duration_formatted"),
        "audio_url": data.get("audio_url"),
        "lyrics": data.get("lyrics"),
        "track_number": data.get("track_number")
    }
    
    if not song_data["title"]:
        raise HTTPException(status_code=400, detail="Song title is required")
    
    album_title = "No Album"
    
    # Verify album if provided
    if song_data["album_id"]:
        album = await db.albums.find_one({"album_id": song_data["album_id"]}, {"_id": 0})
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        if album.get("artist_id") != account["choir_id"]:
            raise HTTPException(status_code=403, detail="You can only upload songs to your own albums")
        album_title = album["title"]
    
    # Create content request
    content_request = ChoirContentRequest(
        choir_id=account["choir_id"],
        choir_name=account["choir_name"],
        request_type="song_upload",
        content_data=song_data
    )
    doc = content_request.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.choir_content_requests.insert_one(doc)
    
    # Notify priest/admin
    notification = PriestNotification(
        notification_type="content_request",
        choir_id=account["choir_id"],
        choir_name=account["choir_name"],
        message=f"{account['choir_name']} wants to upload a new song: {song_data['title']}",
        details={"request_id": doc["request_id"], "song_title": song_data["title"], "album": album_title}
    )
    notif_doc = notification.model_dump()
    notif_doc["created_at"] = notif_doc["created_at"].isoformat()
    await db.priest_notifications.insert_one(notif_doc)
    
    return {"message": "Song upload request submitted for approval", "request_id": doc["request_id"]}

@api_router.get("/choir/my-content-requests")
async def get_my_content_requests(request: Request):
    """Get choir's content requests"""
    account = await get_choir_from_session(request)
    
    requests = await db.choir_content_requests.find(
        {"choir_id": account["choir_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"requests": requests}

@api_router.get("/choir/my-albums")
async def get_my_albums(request: Request):
    """Get albums belonging to this choir"""
    account = await get_choir_from_session(request)
    
    albums = await db.albums.find(
        {"artist_id": account["choir_id"]},
        {"_id": 0}
    ).to_list(100)
    
    return {"albums": albums}

# ============== ADMIN CONTENT APPROVAL ==============

@api_router.get("/admin/content-requests")
async def get_content_requests(status: Optional[str] = None):
    """Get all content requests (admin)"""
    query = {}
    if status:
        query["status"] = status
    requests = await db.choir_content_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"requests": requests}

@api_router.put("/admin/content-requests/{request_id}")
async def process_content_request(request_id: str, data: dict):
    """Approve or reject content request"""
    status = data.get("status")  # approved or rejected
    admin_notes = data.get("admin_notes", "")
    processed_by = data.get("processed_by", "admin")
    
    if status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be approved or rejected")
    
    content_request = await db.choir_content_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not content_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Update request status
    await db.choir_content_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": status,
            "admin_notes": admin_notes,
            "processed_by": processed_by,
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # If approved, create the content
    if status == "approved":
        if content_request["request_type"] == "album_create":
            album_data = content_request["content_data"]
            album_obj = Album(
                title=album_data["title"],
                description=album_data.get("description"),
                artist_id=content_request["choir_id"],
                artist_name=content_request["choir_name"],
                category_id=album_data.get("category_id"),
                thumbnail=album_data.get("thumbnail"),
                release_date=album_data.get("release_date"),
                monetization_type=album_data.get("monetization_type", "standard"),
                status="active"
            )
            doc = album_obj.model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.albums.insert_one(doc)
            
        elif content_request["request_type"] == "song_upload":
            song_data = content_request["content_data"]
            song_obj = Song(
                title=song_data["title"],
                album_id=song_data["album_id"],
                duration=song_data.get("duration"),
                duration_formatted=song_data.get("duration_formatted"),
                audio_url=song_data.get("audio_url"),
                lyrics=song_data.get("lyrics"),
                track_number=song_data.get("track_number"),
                status="active"
            )
            doc = song_obj.model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.songs.insert_one(doc)
            
            # Update album song count
            await db.albums.update_one(
                {"album_id": song_data["album_id"]},
                {"$inc": {"songs_count": 1}}
            )
    
    return {"message": f"Content request {status}"}

# ============== PRIEST NOTIFICATIONS ==============

@api_router.get("/admin/notifications")
async def get_admin_notifications(unread_only: bool = False):
    """Get notifications for admins/priests"""
    query = {}
    if unread_only:
        query["read"] = False
    
    notifications = await db.priest_notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    unread_count = await db.priest_notifications.count_documents({"read": False})
    
    return {"notifications": notifications, "unread_count": unread_count}

@api_router.put("/admin/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark notification as read"""
    await db.priest_notifications.update_one(
        {"notification_id": notification_id},
        {"$set": {"read": True}}
    )
    return {"message": "Notification marked as read"}

@api_router.put("/admin/notifications/read-all")
async def mark_all_notifications_read():
    """Mark all notifications as read"""
    await db.priest_notifications.update_many({}, {"$set": {"read": True}})
    return {"message": "All notifications marked as read"}

# ============== WITHDRAWAL REQUESTS ==============

@api_router.post("/withdrawal/request")
async def create_withdrawal_request(data: dict, request: Request):
    """Create a withdrawal request (choir)"""
    # Get choir from session
    session_token = request.cookies.get("choir_session")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.choir_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    account = await db.choir_accounts.find_one({"account_id": session["account_id"]}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    amount = data.get("amount", 0)
    
    # Get minimum withdrawal
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    min_withdrawal = settings.get("minimum_withdrawal", 10000) if settings else 10000
    
    if amount < min_withdrawal:
        raise HTTPException(status_code=400, detail=f"Minimum withdrawal is TZS {min_withdrawal}")
    
    if amount > account["current_balance"]:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    withdrawal = WithdrawalRequest(
        choir_id=account["choir_id"],
        choir_name=account["choir_name"],
        amount=amount,
        payment_method=data.get("payment_method", "mobile_money"),
        payment_details=data.get("payment_details", {})
    )
    doc = withdrawal.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.withdrawal_requests.insert_one(doc)
    
    # Notify priest about withdrawal request (in-app)
    notification = PriestNotification(
        notification_type="withdrawal_request",
        choir_id=account["choir_id"],
        choir_name=account["choir_name"],
        message=f"{account['choir_name']} has requested a withdrawal of TZS {amount:,.0f}",
        details={"request_id": doc["request_id"], "amount": amount, "payment_method": data.get("payment_method", "mobile_money")}
    )
    notif_doc = notification.model_dump()
    notif_doc["created_at"] = notif_doc["created_at"].isoformat()
    await db.priest_notifications.insert_one(notif_doc)
    
    # Send SMS to treasurer, chairman, and parish priest (MOCK)
    await notify_choir_contacts_withdrawal(account["choir_id"], doc, "withdrawal_request")
    
    return {"request_id": doc["request_id"], "message": "Withdrawal request submitted"}

@api_router.get("/withdrawal/requests")
async def get_withdrawal_requests(status: Optional[str] = None):
    """Get all withdrawal requests (admin)"""
    query = {}
    if status:
        query["status"] = status
    requests = await db.withdrawal_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"requests": requests}

@api_router.get("/withdrawal/my-requests")
async def get_my_withdrawal_requests(request: Request):
    """Get withdrawal requests for current choir"""
    session_token = request.cookies.get("choir_session")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.choir_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    requests = await db.withdrawal_requests.find(
        {"choir_id": session["choir_id"]}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"requests": requests}

@api_router.put("/withdrawal/{request_id}")
async def process_withdrawal(request_id: str, data: dict):
    """Process withdrawal request (admin)"""
    status = data.get("status")  # approved, rejected, completed
    admin_notes = data.get("admin_notes", "")
    processed_by = data.get("processed_by", "admin")
    
    withdrawal = await db.withdrawal_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Request not found")
    
    updates = {
        "status": status,
        "admin_notes": admin_notes,
        "processed_by": processed_by,
        "processed_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.withdrawal_requests.update_one({"request_id": request_id}, {"$set": updates})
    
    # If completed, update choir account balance
    if status == "completed":
        await db.choir_accounts.update_one(
            {"choir_id": withdrawal["choir_id"]},
            {
                "$inc": {
                    "current_balance": -withdrawal["amount"],
                    "total_withdrawn": withdrawal["amount"]
                }
            }
        )
    
    return {"message": f"Withdrawal request {status}"}

# ============== ADMIN CHOIR ANALYTICS & MANAGEMENT ==============

@api_router.get("/admin/choirs")
async def get_all_choirs_admin():
    """Get all choirs with their performance summary"""
    choirs = await db.singers.find({"type": "choir"}, {"_id": 0}).to_list(500)
    
    # Get performance data for each choir
    choir_list = []
    for choir in choirs:
        # Get account info
        account = await db.choir_accounts.find_one({"choir_id": choir["singer_id"]}, {"_id": 0, "password_hash": 0})
        
        # Get revenue stats
        revenue_filter = {"choir_id": choir["singer_id"], "$or": [
            {"counts_for_revenue": True},
            {"duration_seconds": {"$gte": MIN_STREAM_DURATION_SECONDS}}
        ]}
        
        pipeline = [
            {"$match": revenue_filter},
            {"$group": {
                "_id": None,
                "total_hours": {"$sum": "$duration_hours"},
                "total_plays": {"$sum": 1}
            }}
        ]
        stats = await db.listening_sessions.aggregate(pipeline).to_list(1)
        
        # Get album count
        album_count = await db.albums.count_documents({"artist_id": choir["singer_id"]})
        
        # Get song count
        albums = await db.albums.find({"artist_id": choir["singer_id"]}, {"album_id": 1}).to_list(100)
        album_ids = [a["album_id"] for a in albums]
        song_count = await db.songs.count_documents({"album_id": {"$in": album_ids}}) if album_ids else 0
        
        choir_data = {
            **choir,
            "has_account": account is not None,
            "account_status": account.get("status") if account else None,
            "current_balance": account.get("current_balance", 0) if account else 0,
            "total_earned": account.get("total_earned", 0) if account else 0,
            "total_hours": stats[0]["total_hours"] if stats else 0,
            "total_plays": stats[0]["total_plays"] if stats else 0,
            "album_count": album_count,
            "song_count": song_count
        }
        choir_list.append(choir_data)
    
    return {"choirs": choir_list, "total": len(choir_list)}

@api_router.get("/admin/choirs/{choir_id}")
async def get_choir_details_admin(choir_id: str):
    """Get detailed choir information including all albums, songs, revenue"""
    # Get choir
    choir = await db.singers.find_one({"singer_id": choir_id}, {"_id": 0})
    if not choir:
        raise HTTPException(status_code=404, detail="Choir not found")
    
    # Get account
    account = await db.choir_accounts.find_one({"choir_id": choir_id}, {"_id": 0, "password_hash": 0})
    
    # Get revenue settings
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not settings:
        settings = {"premium_rate_per_hour": 10.0, "standard_rate_per_hour": 5.0, "platform_share_percentage": 30.0}
    
    # Get revenue stats (only streams >= 45s)
    revenue_filter = {"choir_id": choir_id, "$or": [
        {"counts_for_revenue": True},
        {"duration_seconds": {"$gte": MIN_STREAM_DURATION_SECONDS}}
    ]}
    
    pipeline = [
        {"$match": revenue_filter},
        {"$group": {
            "_id": "$content_type",
            "hours": {"$sum": "$duration_hours"},
            "plays": {"$sum": 1}
        }}
    ]
    stats = await db.listening_sessions.aggregate(pipeline).to_list(10)
    
    premium_hours = 0
    standard_hours = 0
    total_plays = 0
    for stat in stats:
        if stat["_id"] == "premium":
            premium_hours = stat["hours"]
        else:
            standard_hours = stat["hours"]
        total_plays += stat["plays"]
    
    gross_revenue = (premium_hours * settings["premium_rate_per_hour"] + 
                    standard_hours * settings["standard_rate_per_hour"])
    platform_share = gross_revenue * (settings["platform_share_percentage"] / 100)
    net_revenue = gross_revenue - platform_share
    
    # Get all albums with songs
    albums = await db.albums.find({"artist_id": choir_id}, {"_id": 0}).to_list(100)
    albums_with_songs = []
    for album in albums:
        songs = await db.songs.find({"album_id": album["album_id"]}, {"_id": 0}).to_list(100)
        
        # Get album-specific revenue
        album_revenue_pipeline = [
            {"$match": {"album_id": album["album_id"], **revenue_filter}},
            {"$group": {
                "_id": None,
                "hours": {"$sum": "$duration_hours"},
                "plays": {"$sum": 1}
            }}
        ]
        album_stats = await db.listening_sessions.aggregate(album_revenue_pipeline).to_list(1)
        
        album_hours = album_stats[0]["hours"] if album_stats else 0
        album_plays = album_stats[0]["plays"] if album_stats else 0
        album_revenue = album_hours * (settings["premium_rate_per_hour"] if album.get("monetization_type") == "premium" else settings["standard_rate_per_hour"])
        
        albums_with_songs.append({
            **album,
            "songs": songs,
            "total_hours": round(album_hours, 2),
            "total_plays": album_plays,
            "revenue": round(album_revenue, 2)
        })
    
    # Get withdrawal history
    withdrawals = await db.withdrawal_requests.find({"choir_id": choir_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Get monthly revenue trend
    monthly_pipeline = [
        {"$match": revenue_filter},
        {"$group": {
            "_id": "$month",
            "hours": {"$sum": "$duration_hours"},
            "plays": {"$sum": 1}
        }},
        {"$sort": {"_id": -1}},
        {"$limit": 12}
    ]
    monthly = await db.listening_sessions.aggregate(monthly_pipeline).to_list(12)
    
    return {
        "choir": choir,
        "account": account,
        "revenue": {
            "total_hours": round(premium_hours + standard_hours, 2),
            "premium_hours": round(premium_hours, 2),
            "standard_hours": round(standard_hours, 2),
            "total_plays": total_plays,
            "gross_revenue": round(gross_revenue, 2),
            "platform_share": round(platform_share, 2),
            "net_revenue": round(net_revenue, 2),
            "current_balance": account.get("current_balance", 0) if account else 0,
            "total_withdrawn": account.get("total_withdrawn", 0) if account else 0
        },
        "albums": albums_with_songs,
        "withdrawals": withdrawals,
        "monthly": monthly
    }

@api_router.put("/admin/choirs/{choir_id}")
async def update_choir_admin(choir_id: str, data: dict):
    """Admin update choir details (approve, suspend, edit)"""
    update_data = {}
    
    # Allowed fields to update
    allowed_fields = [
        "name", "denomination", "church_id", "church_name", "bio", "photo",
        "treasurer_name", "treasurer_phone", "chairman_name", "chairman_phone",
        "parish_priest_name", "parish_priest_phone", "status", "approval_status", "admin_notes"
    ]
    
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    result = await db.singers.update_one(
        {"singer_id": choir_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Choir not found")
    
    # Also update choir account if exists
    account_update = {}
    for field in ["choir_name", "denomination", "treasurer_name", "treasurer_phone", 
                  "chairman_name", "chairman_phone", "parish_priest_name", "parish_priest_phone"]:
        if field in data:
            account_field = "choir_name" if field == "name" else field
            account_update[account_field] = data[field]
    
    if account_update:
        await db.choir_accounts.update_one(
            {"choir_id": choir_id},
            {"$set": account_update}
        )
    
    return {"message": "Choir updated successfully"}

@api_router.post("/admin/choirs")
async def create_choir_admin(data: dict):
    """Admin create a new choir with all details"""
    choir = Singer(
        name=data.get("name"),
        type="choir",
        denomination=data.get("denomination"),
        church_id=data.get("church_id"),
        church_name=data.get("church_name"),
        treasurer_name=data.get("treasurer_name"),
        treasurer_phone=data.get("treasurer_phone"),
        chairman_name=data.get("chairman_name"),
        chairman_phone=data.get("chairman_phone"),
        parish_priest_name=data.get("parish_priest_name"),
        parish_priest_phone=data.get("parish_priest_phone"),
        bio=data.get("bio"),
        photo=data.get("photo"),
        status="active",
        approval_status="approved"  # Admin-created choirs are auto-approved
    )
    
    doc = choir.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.singers.insert_one(doc)
    
    return {"singer_id": doc["singer_id"], "message": "Choir created successfully"}

# ============== ADMIN ALBUM & SONG MANAGEMENT ==============

@api_router.get("/admin/albums")
async def get_all_albums_admin(status: Optional[str] = None, choir_id: Optional[str] = None):
    """Get all albums with choir info and performance data"""
    query = {}
    if status:
        query["status"] = status
    if choir_id:
        query["artist_id"] = choir_id
    
    albums = await db.albums.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Enrich with performance data
    enriched_albums = []
    for album in albums:
        # Get songs
        songs = await db.songs.find({"album_id": album["album_id"]}, {"_id": 0}).to_list(100)
        
        # Get listening stats
        stats_pipeline = [
            {"$match": {"album_id": album["album_id"]}},
            {"$group": {
                "_id": None,
                "total_plays": {"$sum": 1},
                "total_hours": {"$sum": "$duration_hours"}
            }}
        ]
        stats = await db.listening_sessions.aggregate(stats_pipeline).to_list(1)
        
        enriched_albums.append({
            **album,
            "songs": songs,
            "songs_count": len(songs),
            "total_plays": stats[0]["total_plays"] if stats else 0,
            "total_hours": round(stats[0]["total_hours"], 2) if stats else 0
        })
    
    return {"albums": enriched_albums, "total": len(enriched_albums)}

@api_router.get("/admin/albums/{album_id}")
async def get_album_details_admin(album_id: str):
    """Get detailed album info with all songs for preview"""
    album = await db.albums.find_one({"album_id": album_id}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    # Get all songs
    songs = await db.songs.find({"album_id": album_id}, {"_id": 0}).to_list(100)
    
    # Get choir info
    choir = await db.singers.find_one({"singer_id": album.get("artist_id")}, {"_id": 0})
    
    # Get listening stats per song
    for song in songs:
        song_stats = await db.listening_sessions.aggregate([
            {"$match": {"song_id": song["song_id"]}},
            {"$group": {
                "_id": None,
                "plays": {"$sum": 1},
                "hours": {"$sum": "$duration_hours"}
            }}
        ]).to_list(1)
        song["total_plays"] = song_stats[0]["plays"] if song_stats else 0
        song["total_hours"] = round(song_stats[0]["hours"], 2) if song_stats else 0
    
    # Get approval request if pending
    approval = await db.choir_content_requests.find_one({
        "content_data.album_id": album_id,
        "status": "pending"
    }, {"_id": 0})
    
    return {
        "album": album,
        "songs": songs,
        "choir": choir,
        "pending_approval": approval
    }

@api_router.put("/admin/albums/{album_id}")
async def update_album_admin(album_id: str, data: dict):
    """Admin update album (approve, edit, enable/disable)"""
    update_data = {}
    
    allowed_fields = [
        "title", "description", "category_id", "category_name", "thumbnail",
        "release_date", "monetization_type", "status"
    ]
    
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    result = await db.albums.update_one(
        {"album_id": album_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Album not found")
    
    return {"message": "Album updated successfully"}

@api_router.put("/admin/songs/{song_id}")
async def update_song_admin(song_id: str, data: dict):
    """Admin update song (enable/disable, edit)"""
    update_data = {}
    
    allowed_fields = ["title", "audio_url", "lyrics", "track_number", "status"]
    
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    result = await db.songs.update_one(
        {"song_id": song_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Song not found")
    
    return {"message": "Song updated successfully"}

@api_router.post("/admin/albums/{album_id}/approve")
async def approve_album_with_songs(album_id: str, data: dict = None):
    """Approve an album and all its songs at once"""
    data = data or {}
    
    # Update album status
    await db.albums.update_one(
        {"album_id": album_id},
        {"$set": {"status": "active"}}
    )
    
    # Update all songs to active
    await db.songs.update_many(
        {"album_id": album_id},
        {"$set": {"status": "active"}}
    )
    
    # Update content request if exists
    await db.choir_content_requests.update_many(
        {"content_data.album_id": album_id, "status": "pending"},
        {"$set": {
            "status": "approved",
            "processed_by": data.get("processed_by", "admin"),
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Album and all songs approved"}

@api_router.get("/admin/sms-logs")
async def get_sms_logs(choir_id: Optional[str] = None, status: Optional[str] = None):
    """Get SMS notification logs (for debugging/future integration)"""
    query = {}
    if choir_id:
        query["choir_id"] = choir_id
    if status:
        query["status"] = status
    
    logs = await db.sms_notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"logs": logs, "total": len(logs)}

@api_router.post("/admin/sms/send")
async def send_manual_sms(data: dict):
    """Manually trigger SMS (for testing/admin override)"""
    recipient_phone = data.get("phone")
    message = data.get("message")
    recipient_name = data.get("name", "Unknown")
    
    if not recipient_phone or not message:
        raise HTTPException(status_code=400, detail="Phone and message required")
    
    sms_doc = await send_sms_notification(
        recipient_type="manual",
        recipient_name=recipient_name,
        recipient_phone=recipient_phone,
        message=message,
        notification_type="manual_admin"
    )
    
    return {"sms_id": sms_doc["sms_id"], "status": "mock_sent"}

# ============== LAYOUT MANAGEMENT ==============

# Default sections to create on first load
DEFAULT_SECTIONS = [
    {
        "section_id": "section_hero_main",
        "name": "hero_main",
        "display_name": "Hero Section",
        "section_type": "hero",
        "description": "Main hero banner at the top of the page",
        "platforms": ["app", "web"],
        "is_active": True,
        "sort_order": 1,
        "content_type": None,
        "background_gradient": "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)",
    },
    {
        "section_id": "section_quick_access",
        "name": "quick_access",
        "display_name": "Quick Access",
        "section_type": "quick_access",
        "description": "Quick access grid for popular categories",
        "platforms": ["app", "web"],
        "is_active": True,
        "sort_order": 2,
        "content_type": "categories",
        "content_count": 6,
        "content_ids": [],  # Admin can set specific categories/albums
    },
    {
        "section_id": "section_featured",
        "name": "featured_albums",
        "display_name": "Featured Albums",
        "section_type": "featured_albums",
        "description": "Handpicked featured albums",
        "platforms": ["app", "web"],
        "is_active": True,
        "sort_order": 3,
        "content_type": "albums",
        "content_count": 5,
        "content_source": "manual",
        "carousel": True,  # Carousel display (max 5)
        "content_ids": [],  # Admin selects up to 5 albums for carousel
    },
    {
        "section_id": "section_trending",
        "name": "trending",
        "display_name": "Trending Now",
        "section_type": "trending",
        "description": "Most popular songs this week",
        "platforms": ["app", "web"],
        "is_active": True,
        "sort_order": 4,
        "content_type": "albums",
        "content_count": 10,
    },
    {
        "section_id": "section_christmas",
        "name": "christmas_songs",
        "display_name": "Christmas Songs",
        "section_type": "seasonal",
        "description": "Celebrate the birth of Christ",
        "platforms": ["app", "web"],
        "is_active": True,
        "sort_order": 5,
        "content_type": "albums",
        "content_count": 10,
        "filter_category": "christmas",
    },
    {
        "section_id": "section_lent",
        "name": "lent_songs",
        "display_name": "Lent & Easter",
        "section_type": "seasonal",
        "description": "Music for the Lenten season",
        "platforms": ["app", "web"],
        "is_active": False,
        "sort_order": 6,
        "content_type": "albums",
        "content_count": 10,
        "filter_category": "lent",
    },
    {
        "section_id": "section_prayers",
        "name": "prayers",
        "display_name": "Prayer & Meditation",
        "section_type": "custom",
        "description": "Peaceful music for prayer time",
        "platforms": ["app", "web"],
        "is_active": True,
        "sort_order": 7,
        "content_type": "albums",
        "content_count": 10,
        "filter_category": "prayers",
    },
    {
        "section_id": "section_catechism",
        "name": "catechism",
        "display_name": "Catechism & Teaching",
        "section_type": "custom",
        "description": "Learn the faith through music",
        "platforms": ["app", "web"],
        "is_active": True,
        "sort_order": 8,
        "content_type": "albums",
        "content_count": 10,
        "filter_category": "catechism",
    },
    {
        "section_id": "section_worship",
        "name": "worship",
        "display_name": "Worship & Praise",
        "section_type": "custom",
        "description": "Songs for worship services",
        "platforms": ["app", "web"],
        "is_active": True,
        "sort_order": 9,
        "content_type": "albums",
        "content_count": 10,
        "filter_category": "worship",
    },
    {
        "section_id": "section_new_releases",
        "name": "new_releases",
        "display_name": "New Releases",
        "section_type": "cta",
        "description": "Latest additions to our library",
        "platforms": ["app", "web"],
        "is_active": True,
        "sort_order": 10,
        "content_type": "albums",
        "content_count": 10,
    },
]

DEFAULT_BURNERS = [
    {
        "burner_id": "burner_premium",
        "name": "premium_upgrade",
        "icon": "crown",
        "icon_color": "#fbbf24",
        "headline": "Upgrade to Premium",
        "subtitle": "Enjoy ad-free music with offline listening",
        "cta_text": "Get Premium",
        "cta_link": "/subscription",
        "cta_link_type": "page",
        "background_type": "gradient",
        "background_color": "#1e1b4b",
        "background_gradient": "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
        "text_color": "#ffffff",
        "button_color": "#ffffff",
        "button_text_color": "#000000",
        "platforms": ["app", "web"],
        "is_active": True,
        "sort_order": 1,
    },
]

@api_router.get("/layout/sections")
async def get_layout_sections(platform: Optional[str] = None, active_only: bool = False):
    """Get all layout sections"""
    query = {}
    if platform:
        query["platforms"] = platform
    if active_only:
        query["is_active"] = True
    
    sections = await db.layout_sections.find(query, {"_id": 0}).sort("sort_order", 1).to_list(100)
    
    # If no sections exist, create defaults
    if not sections:
        import copy
        for section_data in DEFAULT_SECTIONS:
            data_copy = copy.deepcopy(section_data)
            data_copy["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.layout_sections.insert_one(data_copy)
        # Re-fetch to get clean data without _id
        sections = await db.layout_sections.find(query, {"_id": 0}).sort("sort_order", 1).to_list(100)
    
    # Enrich sections with content details
    for section in sections:
        if section.get("content_type") == "categories" and section.get("content_ids"):
            categories = await db.categories.find(
                {"category_id": {"$in": section["content_ids"]}},
                {"_id": 0}
            ).to_list(50)
            section["content_items"] = categories
        elif section.get("content_type") == "albums" and section.get("content_ids"):
            albums = await db.albums.find(
                {"album_id": {"$in": section["content_ids"]}},
                {"_id": 0}
            ).to_list(50)
            section["content_items"] = albums
        elif section.get("content_type") == "songs" and section.get("content_ids"):
            songs = await db.songs.find(
                {"song_id": {"$in": section["content_ids"]}},
                {"_id": 0}
            ).to_list(50)
            section["content_items"] = songs
    
    return {"sections": sections, "total": len(sections)}

@api_router.get("/layout/sections/{section_id}")
async def get_layout_section(section_id: str):
    """Get a specific layout section"""
    section = await db.layout_sections.find_one({"section_id": section_id}, {"_id": 0})
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    # Enrich with content
    if section.get("content_type") == "categories" and section.get("content_ids"):
        categories = await db.categories.find(
            {"category_id": {"$in": section["content_ids"]}},
            {"_id": 0}
        ).to_list(50)
        section["content_items"] = categories
    elif section.get("content_type") == "albums" and section.get("content_ids"):
        albums = await db.albums.find(
            {"album_id": {"$in": section["content_ids"]}},
            {"_id": 0}
        ).to_list(50)
        section["content_items"] = albums
    
    return section

@api_router.post("/layout/sections")
async def create_layout_section(data: dict):
    """Create a new layout section"""
    # Get max sort_order
    max_order = await db.layout_sections.find_one({}, sort=[("sort_order", -1)])
    next_order = (max_order.get("sort_order", 0) if max_order else 0) + 1
    
    section = LayoutSection(
        name=data.get("name"),
        display_name=data.get("display_name"),
        section_type=data.get("section_type", "custom"),
        description=data.get("description"),
        platforms=data.get("platforms", ["app", "web"]),
        is_active=data.get("is_active", True),
        sort_order=data.get("sort_order", next_order),
        content_type=data.get("content_type"),
        content_ids=data.get("content_ids", []),
        content_count=data.get("content_count", 10),
        content_source=data.get("content_source", "manual"),
        background_image=data.get("background_image"),
        background_color=data.get("background_color"),
        background_gradient=data.get("background_gradient"),
        link_type=data.get("link_type"),
        link_target=data.get("link_target"),
        schedule_start=data.get("schedule_start"),
        schedule_end=data.get("schedule_end"),
        last_edited_by=data.get("last_edited_by")
    )
    
    doc = section.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.layout_sections.insert_one(doc)
    
    return {"section_id": doc["section_id"], "message": "Section created"}

@api_router.put("/layout/sections/{section_id}")
async def update_layout_section(section_id: str, data: dict):
    """Update a layout section"""
    allowed_fields = [
        "name", "display_name", "section_type", "description", "platforms",
        "is_active", "sort_order", "content_type", "content_ids", "content_count",
        "content_source", "background_image", "background_color", "background_gradient",
        "link_type", "link_target", "schedule_start", "schedule_end", "last_edited_by"
    ]
    
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.layout_sections.update_one(
        {"section_id": section_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Section not found")
    
    return {"message": "Section updated"}

@api_router.delete("/layout/sections/{section_id}")
async def delete_layout_section(section_id: str):
    """Delete a layout section"""
    result = await db.layout_sections.delete_one({"section_id": section_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Section not found")
    return {"message": "Section deleted"}

@api_router.post("/layout/sections/reorder")
async def reorder_sections(data: dict):
    """Reorder sections by updating sort_order"""
    section_order = data.get("section_order", [])  # List of section_ids in new order
    platform = data.get("platform")  # Optional: only reorder for specific platform
    
    for idx, section_id in enumerate(section_order):
        await db.layout_sections.update_one(
            {"section_id": section_id},
            {"$set": {"sort_order": idx + 1, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": "Sections reordered", "new_order": section_order}

@api_router.put("/layout/sections/{section_id}/toggle")
async def toggle_section(section_id: str, data: dict):
    """Toggle section active status"""
    is_active = data.get("is_active", True)
    platform = data.get("platform")  # Optional: toggle only for specific platform
    
    update = {"is_active": is_active, "updated_at": datetime.now(timezone.utc).isoformat()}
    
    result = await db.layout_sections.update_one(
        {"section_id": section_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Section not found")
    
    return {"message": f"Section {'activated' if is_active else 'deactivated'}"}

@api_router.post("/layout/sections/{section_id}/assign-content")
async def assign_content_to_section(section_id: str, data: dict):
    """Assign content (categories, albums, songs) to a section"""
    content_type = data.get("content_type")  # categories, albums, songs
    content_ids = data.get("content_ids", [])  # List of IDs
    
    update = {
        "content_type": content_type,
        "content_ids": content_ids,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.layout_sections.update_one(
        {"section_id": section_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Section not found")
    
    return {"message": "Content assigned to section"}

# ============== BURNERS / CTAs ==============

@api_router.get("/layout/burners")
async def get_burners(platform: Optional[str] = None, active_only: bool = False):
    """Get all burners/CTAs"""
    query = {}
    if platform:
        query["platforms"] = platform
    if active_only:
        query["is_active"] = True
    
    burners = await db.layout_burners.find(query, {"_id": 0}).sort("sort_order", 1).to_list(50)
    
    # If no burners exist, create defaults
    if not burners:
        import copy
        for burner_data in DEFAULT_BURNERS:
            data_copy = copy.deepcopy(burner_data)
            data_copy["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.layout_burners.insert_one(data_copy)
        # Re-fetch to get clean data without _id
        burners = await db.layout_burners.find(query, {"_id": 0}).sort("sort_order", 1).to_list(50)
    
    return {"burners": burners, "total": len(burners)}

@api_router.get("/layout/burners/{burner_id}")
async def get_burner(burner_id: str):
    """Get a specific burner"""
    burner = await db.layout_burners.find_one({"burner_id": burner_id}, {"_id": 0})
    if not burner:
        raise HTTPException(status_code=404, detail="Burner not found")
    return burner

@api_router.post("/layout/burners")
async def create_burner(data: dict):
    """Create a new burner/CTA"""
    max_order = await db.layout_burners.find_one({}, sort=[("sort_order", -1)])
    next_order = (max_order.get("sort_order", 0) if max_order else 0) + 1
    
    burner = LayoutBurner(
        name=data.get("name"),
        icon=data.get("icon"),
        icon_color=data.get("icon_color", "#a855f7"),
        headline=data.get("headline"),
        subtitle=data.get("subtitle"),
        cta_text=data.get("cta_text"),
        cta_link=data.get("cta_link"),
        cta_link_type=data.get("cta_link_type", "page"),
        background_type=data.get("background_type", "gradient"),
        background_color=data.get("background_color", "#1e1b4b"),
        background_gradient=data.get("background_gradient", "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)"),
        background_image=data.get("background_image"),
        text_color=data.get("text_color", "#ffffff"),
        button_style=data.get("button_style", "solid"),
        button_color=data.get("button_color", "#ffffff"),
        button_text_color=data.get("button_text_color", "#000000"),
        border_radius=data.get("border_radius", "16px"),
        platforms=data.get("platforms", ["app", "web"]),
        is_active=data.get("is_active", True),
        sort_order=data.get("sort_order", next_order),
        section_id=data.get("section_id"),
        schedule_start=data.get("schedule_start"),
        schedule_end=data.get("schedule_end"),
        last_edited_by=data.get("last_edited_by")
    )
    
    doc = burner.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.layout_burners.insert_one(doc)
    
    return {"burner_id": doc["burner_id"], "message": "Burner created"}

@api_router.put("/layout/burners/{burner_id}")
async def update_burner(burner_id: str, data: dict):
    """Update a burner"""
    allowed_fields = [
        "name", "icon", "icon_color", "headline", "subtitle", "cta_text", "cta_link",
        "cta_link_type", "background_type", "background_color", "background_gradient",
        "background_image", "text_color", "button_style", "button_color", "button_text_color",
        "border_radius", "platforms", "is_active", "sort_order", "section_id",
        "schedule_start", "schedule_end", "last_edited_by"
    ]
    
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.layout_burners.update_one(
        {"burner_id": burner_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Burner not found")
    
    return {"message": "Burner updated"}

@api_router.delete("/layout/burners/{burner_id}")
async def delete_burner(burner_id: str):
    """Delete a burner"""
    result = await db.layout_burners.delete_one({"burner_id": burner_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Burner not found")
    return {"message": "Burner deleted"}

@api_router.put("/layout/burners/{burner_id}/toggle")
async def toggle_burner(burner_id: str, data: dict):
    """Toggle burner active status"""
    is_active = data.get("is_active", True)
    
    result = await db.layout_burners.update_one(
        {"burner_id": burner_id},
        {"$set": {"is_active": is_active, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Burner not found")
    
    return {"message": f"Burner {'activated' if is_active else 'deactivated'}"}

# ============== LAYOUT CONFIG (User-side rendering) ==============

@api_router.get("/layout/config/{platform}")
async def get_layout_config(platform: str):
    """Get complete layout configuration for app or web"""
    if platform not in ["app", "web"]:
        raise HTTPException(status_code=400, detail="Platform must be 'app' or 'web'")
    
    # Get active sections for this platform
    sections = await db.layout_sections.find(
        {"platforms": platform, "is_active": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(50)
    
    # Check scheduled sections
    now = datetime.now(timezone.utc).isoformat()
    active_sections = []
    for section in sections:
        # Check schedule
        if section.get("schedule_start") and section["schedule_start"] > now:
            continue
        if section.get("schedule_end") and section["schedule_end"] < now:
            continue
        
        # Enrich with content
        if section.get("content_type") == "categories" and section.get("content_ids"):
            items = await db.categories.find(
                {"category_id": {"$in": section["content_ids"]}},
                {"_id": 0}
            ).to_list(section.get("content_count", 10))
            section["content_items"] = items
        elif section.get("content_type") == "albums" and section.get("content_ids"):
            items = await db.albums.find(
                {"album_id": {"$in": section["content_ids"]}, "status": "active"},
                {"_id": 0}
            ).to_list(section.get("content_count", 10))
            section["content_items"] = items
        elif section.get("content_source") == "auto_trending":
            # Auto-populate with trending albums
            items = await db.albums.find(
                {"status": "active"},
                {"_id": 0}
            ).sort("plays_count", -1).to_list(section.get("content_count", 10))
            section["content_items"] = items
        elif section.get("content_source") == "auto_recent":
            items = await db.albums.find(
                {"status": "active"},
                {"_id": 0}
            ).sort("created_at", -1).to_list(section.get("content_count", 10))
            section["content_items"] = items
        
        active_sections.append(section)
    
    # Get active burners
    burners = await db.layout_burners.find(
        {"platforms": platform, "is_active": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(20)
    
    # Filter scheduled burners
    active_burners = []
    for burner in burners:
        if burner.get("schedule_start") and burner["schedule_start"] > now:
            continue
        if burner.get("schedule_end") and burner["schedule_end"] < now:
            continue
        active_burners.append(burner)
    
    return {
        "platform": platform,
        "sections": active_sections,
        "burners": active_burners,
        "generated_at": now
    }

@api_router.post("/layout/sections/{section_id}/track-click")
async def track_section_click(section_id: str):
    """Track click on a section"""
    await db.layout_sections.update_one(
        {"section_id": section_id},
        {"$inc": {"clicks_count": 1}}
    )
    return {"message": "Click tracked"}

@api_router.post("/layout/burners/{burner_id}/track-click")
async def track_burner_click(burner_id: str):
    """Track click on a burner"""
    await db.layout_burners.update_one(
        {"burner_id": burner_id},
        {"$inc": {"clicks_count": 1}}
    )
    return {"message": "Click tracked"}

@api_router.post("/layout/burners/{burner_id}/track-impression")
async def track_burner_impression(burner_id: str):
    """Track impression of a burner"""
    await db.layout_burners.update_one(
        {"burner_id": burner_id},
        {"$inc": {"impressions_count": 1}}
    )
    return {"message": "Impression tracked"}

# ============== SIMULATE LISTENING DATA (for demo) ==============

@api_router.post("/demo/generate-listening-data")
async def generate_demo_listening_data():
    """Generate demo listening data for testing analytics"""
    import random
    
    # Get all albums and songs
    albums = await db.albums.find({}, {"_id": 0}).to_list(100)
    
    if not albums:
        return {"message": "No albums found. Create some albums first."}
    
    generated = 0
    now = datetime.now(timezone.utc)
    
    for album in albums:
        songs = await db.songs.find({"album_id": album["album_id"]}, {"_id": 0}).to_list(50)
        
        # Generate random listening sessions for the past 30 days
        for day_offset in range(30):
            date = now - timedelta(days=day_offset)
            num_sessions = random.randint(5, 50)
            
            for _ in range(num_sessions):
                song = random.choice(songs) if songs else None
                if not song:
                    continue
                
                duration_seconds = random.randint(60, 600)  # 1-10 minutes
                duration_hours = duration_seconds / 3600
                
                session = {
                    "session_id": f"listen_{uuid.uuid4().hex[:12]}",
                    "user_id": f"user_{random.randint(1, 100)}",
                    "song_id": song["song_id"],
                    "album_id": album["album_id"],
                    "choir_id": album.get("artist_id", ""),
                    "content_type": album.get("monetization_type", "standard"),
                    "start_time": date.isoformat(),
                    "end_time": (date + timedelta(seconds=duration_seconds)).isoformat(),
                    "duration_seconds": duration_seconds,
                    "duration_hours": duration_hours,
                    "date": date.strftime("%Y-%m-%d"),
                    "month": date.strftime("%Y-%m"),
                    "created_at": date.isoformat()
                }
                await db.listening_sessions.insert_one(session)
                generated += 1
                
                # Update song plays
                await db.songs.update_one({"song_id": song["song_id"]}, {"$inc": {"plays": 1}})
    
    # Update choir account balances based on new data
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not settings:
        settings = {"premium_rate_per_hour": 10.0, "standard_rate_per_hour": 5.0, "platform_share_percentage": 30.0}
    
    # Calculate and update choir balances
    choir_pipeline = [
        {"$group": {
            "_id": "$choir_id",
            "premium_hours": {"$sum": {"$cond": [{"$eq": ["$content_type", "premium"]}, "$duration_hours", 0]}},
            "standard_hours": {"$sum": {"$cond": [{"$ne": ["$content_type", "premium"]}, "$duration_hours", 0]}}
        }}
    ]
    choir_stats = await db.listening_sessions.aggregate(choir_pipeline).to_list(100)
    
    for choir in choir_stats:
        if not choir["_id"]:
            continue
        gross = (choir["premium_hours"] * settings["premium_rate_per_hour"] + 
                 choir["standard_hours"] * settings["standard_rate_per_hour"])
        net = gross * (1 - settings["platform_share_percentage"] / 100)
        
        await db.choir_accounts.update_one(
            {"choir_id": choir["_id"]},
            {"$set": {"current_balance": round(net, 2), "total_earned": round(net, 2)}}
        )
    
    return {"message": f"Generated {generated} listening sessions"}

# ============== FILE UPLOAD (Base64 for now, Firebase can be integrated) ==============

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload file and return URL (stores in MongoDB)"""
    content = await file.read()
    
    # Check file size (max 50MB for audio, 5MB for images)
    max_size = 50 * 1024 * 1024 if file.content_type and file.content_type.startswith('audio') else 5 * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail=f"File too large. Max size is {max_size // (1024*1024)}MB")
    
    base64_content = base64.b64encode(content).decode('utf-8')
    
    file_doc = {
        "file_id": f"file_{uuid.uuid4().hex[:12]}",
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(content),
        "data": base64_content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.files.insert_one(file_doc)
    
    # For audio files, return a streaming URL instead of data URL
    if file.content_type and file.content_type.startswith('audio'):
        url = f"/api/files/{file_doc['file_id']}/stream"
    else:
        # For images, return data URL for immediate display
        url = f"data:{file.content_type};base64,{base64_content}"
    
    return {
        "file_id": file_doc["file_id"],
        "url": url,
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(content)
    }

@api_router.post("/upload/multiple")
async def upload_multiple_files(files: List[UploadFile] = File(...)):
    """Upload multiple files at once (for bulk song upload)"""
    results = []
    
    for file in files:
        content = await file.read()
        
        # Check file size
        max_size = 50 * 1024 * 1024 if file.content_type and file.content_type.startswith('audio') else 5 * 1024 * 1024
        if len(content) > max_size:
            results.append({
                "filename": file.filename,
                "error": f"File too large. Max size is {max_size // (1024*1024)}MB"
            })
            continue
        
        base64_content = base64.b64encode(content).decode('utf-8')
        
        file_doc = {
            "file_id": f"file_{uuid.uuid4().hex[:12]}",
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(content),
            "data": base64_content,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.files.insert_one(file_doc)
        
        # Extract song name from filename (remove extension)
        song_name = Path(file.filename).stem if file.filename else "Unknown"
        
        # For audio, return streaming URL
        if file.content_type and file.content_type.startswith('audio'):
            url = f"/api/files/{file_doc['file_id']}/stream"
        else:
            url = f"data:{file.content_type};base64,{base64_content}"
        
        results.append({
            "file_id": file_doc["file_id"],
            "url": url,
            "filename": file.filename,
            "song_name": song_name,
            "content_type": file.content_type,
            "size": len(content)
        })
    
    return {"files": results, "total": len(results)}

@api_router.get("/files/{file_id}/stream")
async def stream_file(file_id: str, request: Request):
    """Stream a file (for audio playback)"""
    file_doc = await db.files.find_one({"file_id": file_id})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Decode base64 content
    content = base64.b64decode(file_doc["data"])
    content_type = file_doc.get("content_type", "application/octet-stream")
    file_size = len(content)
    
    # Handle range requests for audio seeking
    range_header = request.headers.get("Range")
    
    if range_header:
        # Parse range header (e.g., "bytes=0-1024")
        range_match = range_header.replace("bytes=", "").split("-")
        start = int(range_match[0]) if range_match[0] else 0
        end = int(range_match[1]) if range_match[1] else file_size - 1
        
        # Ensure valid range
        if start >= file_size:
            start = 0
        if end >= file_size:
            end = file_size - 1
        
        chunk = content[start:end + 1]
        
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(len(chunk)),
            "Content-Type": content_type
        }
        
        return Response(content=chunk, status_code=206, headers=headers, media_type=content_type)
    
    # Full file response
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": content_type
    }
    
    return Response(content=content, headers=headers, media_type=content_type)

@api_router.get("/files/{file_id}")
async def get_file_info(file_id: str):
    """Get file metadata"""
    file_doc = await db.files.find_one({"file_id": file_id}, {"_id": 0, "data": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    return file_doc

# ============== ROLE-BASED ACCESS CONTROL API ==============

@api_router.get("/rbac/roles")
async def get_all_roles():
    """Get all system and custom roles"""
    # Return system roles from the defined hierarchy
    system_roles = []
    for role in ROLE_HIERARCHY:
        system_roles.append({
            "role_id": role["id"],
            "name": role["name"],
            "description": role["description"],
            "level": role["level"],
            "color": role["color"],
            "permissions": ROLE_PERMISSIONS.get(role["id"], []),
            "is_system_role": True,
            "is_active": True
        })
    
    # Get custom roles from database
    custom_roles = await db.custom_roles.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    return {
        "system_roles": system_roles,
        "custom_roles": custom_roles,
        "all_roles": system_roles + custom_roles
    }

@api_router.get("/rbac/permissions")
async def get_all_permissions():
    """Get all available permissions"""
    permissions = []
    for perm_id, description in SYSTEM_PERMISSIONS.items():
        permissions.append({
            "permission_id": perm_id,
            "name": perm_id.replace("_", " ").title(),
            "description": description,
            "category": categorize_permission(perm_id)
        })
    return {"permissions": permissions}

def categorize_permission(perm_id: str) -> str:
    """Categorize permissions for UI grouping"""
    if perm_id in ["platform_settings", "role_assignment", "user_management", "choir_onboarding_approval"]:
        return "Platform Administration"
    elif perm_id in ["create_albums", "upload_songs", "create_teachings", "edit_own_content", "submit_content_approval"]:
        return "Content Creation"
    elif perm_id in ["content_moderation", "content_approval", "set_content_monetization"]:
        return "Content Moderation"
    elif perm_id in ["view_platform_analytics", "view_own_analytics"]:
        return "Analytics & Reports"
    elif perm_id in ["revenue_configuration", "view_all_revenue_reports", "view_own_revenue_reports", "request_withdrawal", "approve_payouts"]:
        return "Revenue & Finance"
    elif perm_id in ["layout_promotion_control"]:
        return "Layout & Promotion"
    elif perm_id in ["access_free_content", "access_premium_content"]:
        return "Content Access"
    return "Other"

@api_router.get("/rbac/role/{role_id}")
async def get_role_details(role_id: str):
    """Get details of a specific role"""
    # Check system roles first
    for role in ROLE_HIERARCHY:
        if role["id"] == role_id:
            return {
                "role_id": role["id"],
                "name": role["name"],
                "description": role["description"],
                "level": role["level"],
                "color": role["color"],
                "permissions": ROLE_PERMISSIONS.get(role["id"], []),
                "is_system_role": True,
                "is_active": True
            }
    
    # Check custom roles
    custom_role = await db.custom_roles.find_one({"role_id": role_id}, {"_id": 0})
    if custom_role:
        return custom_role
    
    raise HTTPException(status_code=404, detail="Role not found")

@api_router.post("/rbac/roles")
async def create_custom_role(data: dict):
    """Create a new custom role"""
    name = data.get("name")
    description = data.get("description", "")
    permissions = data.get("permissions", [])
    based_on = data.get("based_on")
    color = data.get("color", "#666666")
    created_by = data.get("created_by", "admin")
    
    if not name:
        raise HTTPException(status_code=400, detail="Role name is required")
    
    # Check if name already exists
    existing = await db.custom_roles.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="A role with this name already exists")
    
    # If based on a system role, inherit permissions
    if based_on and based_on in ROLE_PERMISSIONS:
        if not permissions:
            permissions = ROLE_PERMISSIONS[based_on].copy()
    
    role = CustomRole(
        name=name,
        description=description,
        permissions=permissions,
        based_on=based_on,
        color=color,
        created_by=created_by
    )
    
    role_doc = role.model_dump()
    role_doc["created_at"] = role_doc["created_at"].isoformat()
    await db.custom_roles.insert_one(role_doc)
    
    # Log the action
    await log_role_change("create_role", None, role.role_id, name, created_by, "Created new custom role")
    
    return {"message": "Custom role created", "role": {k: v for k, v in role_doc.items() if k != "_id"}}

@api_router.put("/rbac/roles/{role_id}")
async def update_custom_role(role_id: str, data: dict):
    """Update a custom role"""
    # Check if it's a system role
    for role in ROLE_HIERARCHY:
        if role["id"] == role_id:
            raise HTTPException(status_code=400, detail="Cannot modify system roles")
    
    update_fields = {}
    if "name" in data:
        update_fields["name"] = data["name"]
    if "description" in data:
        update_fields["description"] = data["description"]
    if "permissions" in data:
        update_fields["permissions"] = data["permissions"]
    if "color" in data:
        update_fields["color"] = data["color"]
    if "is_active" in data:
        update_fields["is_active"] = data["is_active"]
    
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.custom_roles.update_one(
        {"role_id": role_id},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    
    updated_by = data.get("updated_by", "admin")
    await log_role_change("modify", None, role_id, data.get("name", role_id), updated_by, "Modified custom role")
    
    return {"message": "Role updated successfully"}

@api_router.delete("/rbac/roles/{role_id}")
async def delete_custom_role(role_id: str, deleted_by: str = "admin"):
    """Delete a custom role"""
    # Check if it's a system role
    for role in ROLE_HIERARCHY:
        if role["id"] == role_id:
            raise HTTPException(status_code=400, detail="Cannot delete system roles")
    
    # Check if any users have this role
    users_with_role = await db.user_role_assignments.count_documents({"role_id": role_id, "is_active": True})
    if users_with_role > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete role: {users_with_role} users have this role assigned")
    
    role_doc = await db.custom_roles.find_one({"role_id": role_id})
    if not role_doc:
        raise HTTPException(status_code=404, detail="Role not found")
    
    await db.custom_roles.delete_one({"role_id": role_id})
    await log_role_change("delete_role", None, role_id, role_doc.get("name", role_id), deleted_by, "Deleted custom role")
    
    return {"message": "Role deleted successfully"}

@api_router.get("/rbac/users")
async def get_users_with_roles(role_filter: Optional[str] = None, search: Optional[str] = None):
    """Get all users with their role assignments"""
    # Get users from different collections
    users = []
    
    # Get admin users
    admin_query = {}
    if search:
        admin_query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}}
        ]
    admin_users = await db.admin_users.find(admin_query, {"_id": 0, "password": 0}).to_list(500)
    for user in admin_users:
        user["user_type"] = "admin"
        user["user_id"] = user.get("admin_id", user.get("email"))
        users.append(user)
    
    # Get choir users
    choir_query = {}
    if search:
        choir_query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}}
        ]
    choir_users = await db.choir_accounts.find(choir_query, {"_id": 0, "password_hash": 0}).to_list(500)
    for user in choir_users:
        user["user_type"] = "choir"
        user["user_id"] = user.get("choir_id")
        users.append(user)
    
    # Get app users (listeners)
    app_query = {}
    if search:
        app_query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}}
        ]
    app_users = await db.app_users.find(app_query, {"_id": 0, "password_hash": 0}).to_list(500)
    for user in app_users:
        user["user_type"] = "app_user"
        users.append(user)
    
    # Get role assignments for each user
    for user in users:
        user_id = user.get("user_id") or user.get("email")
        assignment = await db.user_role_assignments.find_one(
            {"user_id": user_id, "is_active": True},
            {"_id": 0}
        )
        if assignment:
            user["assigned_role"] = assignment.get("role_id")
            user["role_name"] = assignment.get("role_name")
        else:
            # Assign default role based on user type
            if user["user_type"] == "admin":
                user["assigned_role"] = "admin"
                user["role_name"] = "Admin"
            elif user["user_type"] == "choir":
                user["assigned_role"] = "choir_artist"
                user["role_name"] = "Choir / Artist"
            else:
                # Check if paid listener
                is_premium = user.get("subscription_type") == "premium" or (user.get("trial", {}) or {}).get("status") == "active"
                user["assigned_role"] = "listener_paid" if is_premium else "listener_free"
                user["role_name"] = "Listener (Paid)" if is_premium else "Listener (Free)"
    
    # Filter by role if specified
    if role_filter:
        users = [u for u in users if u.get("assigned_role") == role_filter]
    
    return {"users": users, "total": len(users)}

@api_router.post("/rbac/users/{user_id}/assign-role")
async def assign_role_to_user(user_id: str, data: dict):
    """Assign a role to a user"""
    role_id = data.get("role_id")
    assigned_by = data.get("assigned_by", "admin")
    assigned_by_name = data.get("assigned_by_name", "Administrator")
    notes = data.get("notes", "")
    
    if not role_id:
        raise HTTPException(status_code=400, detail="Role ID is required")
    
    # Validate role exists
    role_exists = False
    role_name = role_id
    for role in ROLE_HIERARCHY:
        if role["id"] == role_id:
            role_exists = True
            role_name = role["name"]
            break
    
    if not role_exists:
        custom_role = await db.custom_roles.find_one({"role_id": role_id})
        if custom_role:
            role_exists = True
            role_name = custom_role.get("name", role_id)
    
    if not role_exists:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Get user info
    user_info = await get_user_info(user_id)
    if not user_info:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user already has a role assignment
    existing = await db.user_role_assignments.find_one({"user_id": user_id, "is_active": True})
    previous_role = existing.get("role_id") if existing else None
    previous_role_name = existing.get("role_name") if existing else None
    
    # Deactivate existing assignment
    if existing:
        await db.user_role_assignments.update_one(
            {"assignment_id": existing["assignment_id"]},
            {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Create new assignment
    assignment = UserRoleAssignment(
        user_id=user_id,
        user_email=user_info.get("email"),
        user_name=user_info.get("name"),
        role_id=role_id,
        role_name=role_name,
        assigned_by=assigned_by,
        assigned_by_name=assigned_by_name,
        notes=notes
    )
    
    assignment_doc = assignment.model_dump()
    assignment_doc["created_at"] = assignment_doc["created_at"].isoformat()
    await db.user_role_assignments.insert_one(assignment_doc)
    
    # Log the change
    await log_role_change(
        "assign", user_id, role_id, role_name, assigned_by,
        notes, previous_role, previous_role_name, user_info.get("name")
    )
    
    return {
        "message": f"Role '{role_name}' assigned to user successfully",
        "assignment": {k: v for k, v in assignment_doc.items() if k != "_id"}
    }

@api_router.post("/rbac/users/{user_id}/revoke-role")
async def revoke_user_role(user_id: str, data: dict):
    """Revoke a user's role assignment"""
    revoked_by = data.get("revoked_by", "admin")
    reason = data.get("reason", "Role revoked")
    
    existing = await db.user_role_assignments.find_one({"user_id": user_id, "is_active": True})
    if not existing:
        raise HTTPException(status_code=404, detail="No active role assignment found")
    
    await db.user_role_assignments.update_one(
        {"assignment_id": existing["assignment_id"]},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    user_info = await get_user_info(user_id)
    await log_role_change(
        "revoke", user_id, existing["role_id"], existing.get("role_name", ""),
        revoked_by, reason, None, None, user_info.get("name") if user_info else None
    )
    
    return {"message": "Role revoked successfully"}

@api_router.get("/rbac/users/{user_id}/permissions")
async def get_user_permissions(user_id: str):
    """Get all permissions for a specific user"""
    # Get user's role assignment
    assignment = await db.user_role_assignments.find_one({"user_id": user_id, "is_active": True})
    
    if not assignment:
        # Get user info to determine default role
        user_info = await get_user_info(user_id)
        if not user_info:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Assign default permissions based on user type
        user_type = user_info.get("user_type", "listener")
        if user_type == "admin":
            role_id = "admin"
        elif user_type == "choir":
            role_id = "choir_artist"
        else:
            is_premium = user_info.get("subscription_type") == "premium"
            role_id = "listener_paid" if is_premium else "listener_free"
    else:
        role_id = assignment.get("role_id")
    
    # Get permissions for the role
    permissions = ROLE_PERMISSIONS.get(role_id, [])
    
    # Check for custom role
    if not permissions:
        custom_role = await db.custom_roles.find_one({"role_id": role_id})
        if custom_role:
            permissions = custom_role.get("permissions", [])
    
    return {
        "user_id": user_id,
        "role_id": role_id,
        "permissions": permissions,
        "permission_details": [
            {"id": p, "description": SYSTEM_PERMISSIONS.get(p, "")} for p in permissions
        ]
    }

@api_router.get("/rbac/check-permission/{user_id}/{permission}")
async def check_user_permission(user_id: str, permission: str):
    """Check if a user has a specific permission"""
    user_perms = await get_user_permissions(user_id)
    has_permission = permission in user_perms.get("permissions", [])
    return {
        "user_id": user_id,
        "permission": permission,
        "has_permission": has_permission,
        "role_id": user_perms.get("role_id")
    }

@api_router.get("/rbac/audit-log")
async def get_role_audit_log(
    user_id: Optional[str] = None,
    role_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100
):
    """Get role change audit log"""
    query = {}
    if user_id:
        query["user_id"] = user_id
    if role_id:
        query["role_id"] = role_id
    if action:
        query["action"] = action
    
    logs = await db.role_change_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"logs": logs, "total": len(logs)}

@api_router.get("/rbac/stats")
async def get_rbac_stats():
    """Get role-based access control statistics"""
    stats = {}
    
    # Count users per role
    for role in ROLE_HIERARCHY:
        count = await db.user_role_assignments.count_documents({"role_id": role["id"], "is_active": True})
        stats[role["id"]] = {
            "name": role["name"],
            "count": count,
            "color": role["color"]
        }
    
    # Count custom roles
    custom_role_count = await db.custom_roles.count_documents({"is_active": True})
    
    # Count total role assignments
    total_assignments = await db.user_role_assignments.count_documents({"is_active": True})
    
    return {
        "role_stats": stats,
        "custom_roles_count": custom_role_count,
        "total_assignments": total_assignments
    }

async def get_user_info(user_id: str) -> Optional[dict]:
    """Helper to get user info from various collections"""
    # Check admin users
    admin = await db.admin_users.find_one(
        {"$or": [{"admin_id": user_id}, {"email": user_id}]},
        {"_id": 0, "password": 0}
    )
    if admin:
        admin["user_type"] = "admin"
        admin["user_id"] = admin.get("admin_id", admin.get("email"))
        return admin
    
    # Check choir accounts
    choir = await db.choir_accounts.find_one(
        {"choir_id": user_id},
        {"_id": 0, "password_hash": 0}
    )
    if choir:
        choir["user_type"] = "choir"
        choir["user_id"] = choir.get("choir_id")
        return choir
    
    # Check app users
    app_user = await db.app_users.find_one(
        {"user_id": user_id},
        {"_id": 0, "password_hash": 0}
    )
    if app_user:
        app_user["user_type"] = "app_user"
        return app_user
    
    return None

async def log_role_change(
    action: str,
    user_id: Optional[str],
    role_id: str,
    role_name: str,
    performed_by: str,
    reason: Optional[str] = None,
    previous_role_id: Optional[str] = None,
    previous_role_name: Optional[str] = None,
    user_name: Optional[str] = None
):
    """Log role changes for audit"""
    log = RoleChangeLog(
        action=action,
        user_id=user_id,
        user_name=user_name,
        role_id=role_id,
        role_name=role_name,
        previous_role_id=previous_role_id,
        previous_role_name=previous_role_name,
        performed_by=performed_by,
        reason=reason
    )
    log_doc = log.model_dump()
    log_doc["created_at"] = log_doc["created_at"].isoformat()
    await db.role_change_logs.insert_one(log_doc)

# Include the router in the main app
app.include_router(api_router)

# CORS configuration - for credentials, we need specific origins
cors_origins = os.environ.get('CORS_ORIGINS', '*')
if cors_origins == '*':
    # For development/testing, allow common origins
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://faithfusion.preview.emergentagent.com"
    ]
else:
    allowed_origins = [origin.strip() for origin in cors_origins.split(',')]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_db_migration():
    """Run database migrations on startup"""
    # Migrate singers: convert 'followers' to 'followers_count' for consistency
    result = await db.singers.update_many(
        {"followers": {"$exists": True}, "followers_count": {"$exists": False}},
        [{"$set": {"followers_count": {"$ifNull": ["$followers", 0]}}}]
    )
    if result.modified_count > 0:
        logger.info(f"Migrated {result.modified_count} singer records: followers -> followers_count")
    
    # Set followers_count to 0 for records that don't have it
    result2 = await db.singers.update_many(
        {"followers_count": {"$exists": False}},
        {"$set": {"followers_count": 0}}
    )
    if result2.modified_count > 0:
        logger.info(f"Initialized followers_count for {result2.modified_count} singer records")
    
    # Same for churches
    result3 = await db.churches.update_many(
        {"followers_count": {"$exists": False}},
        {"$set": {"followers_count": 0}}
    )
    if result3.modified_count > 0:
        logger.info(f"Initialized followers_count for {result3.modified_count} church records")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
