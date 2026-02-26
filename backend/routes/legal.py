"""
Legal & Compliance Routes
Handles Terms of Service, Privacy Policy, and Contact information
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core.database import get_db

router = APIRouter(prefix="/api", tags=["legal"])


class LegalPageUpdate(BaseModel):
    title: str
    title_sw: Optional[str] = None
    content: str
    content_sw: Optional[str] = None


# Default content templates
DEFAULT_PAGES = {
    "terms_of_service": {
        "page_id": "terms_of_service",
        "title": "Terms of Service",
        "title_sw": "Masharti ya Huduma",
        "content": """# Terms of Service

Welcome to Gracefy. By using our service, you agree to these terms.

## 1. Acceptance of Terms
By accessing or using Gracefy, you agree to be bound by these Terms of Service.

## 2. Use of Service
- You must be at least 13 years old to use this service
- You are responsible for maintaining the confidentiality of your account
- You agree not to misuse or abuse the service

## 3. Content
- All content is provided for personal, non-commercial use
- You may not download, copy, or redistribute content without permission
- Respect copyright and intellectual property rights

## 4. Subscriptions
- Premium features require an active subscription
- Subscriptions auto-renew unless cancelled
- Refunds are subject to our refund policy

## 5. Termination
We reserve the right to suspend or terminate accounts that violate these terms.

## 6. Changes to Terms
We may update these terms from time to time. Continued use constitutes acceptance.

## Contact
For questions, contact us at support@gracefy.com
""",
        "content_sw": """# Masharti ya Huduma

Karibu Gracefy. Kwa kutumia huduma yetu, unakubali masharti haya.

## 1. Kukubali Masharti
Kwa kufikia au kutumia Gracefy, unakubali kufungwa na Masharti haya ya Huduma.

## 2. Matumizi ya Huduma
- Lazima uwe na umri wa miaka 13 au zaidi kutumia huduma hii
- Unawajibika kudumisha usiri wa akaunti yako
- Unakubali kutotumia vibaya huduma

## 3. Maudhui
- Maudhui yote yanatolewa kwa matumizi ya kibinafsi, yasiyo ya kibiashara
- Huwezi kupakua, kunakili, au kusambaza maudhui bila ruhusa
- Heshimu hakimiliki na haki za mali ya kiakili

## 4. Usajili
- Vipengele vya Premium vinahitaji usajili unaotumika
- Usajili unajirudia kiotomatiki isipokuwa umesitishwa
- Marejesho yanategemea sera yetu ya marejesho

## 5. Kusitisha
Tunahifadhi haki ya kusimamisha au kusitisha akaunti zinazokiuka masharti haya.

## 6. Mabadiliko ya Masharti
Tunaweza kusasisha masharti haya mara kwa mara. Kuendelea kutumia kunamaanisha kukubalika.

## Wasiliana Nasi
Kwa maswali, wasiliana nasi kwa support@gracefy.com
"""
    },
    "privacy_policy": {
        "page_id": "privacy_policy",
        "title": "Privacy Policy",
        "title_sw": "Sera ya Faragha",
        "content": """# Privacy Policy

Your privacy is important to us. This policy explains how we collect, use, and protect your information.

## 1. Information We Collect

### Personal Information
- Email address and name when you create an account
- Phone number (optional)
- Payment information for subscriptions

### Usage Data
- Songs and albums you listen to
- Playlists you create
- App usage patterns

### Device Information
- Device type and operating system
- IP address and location (country/region)

## 2. How We Use Your Information
- Provide and improve our service
- Personalize your music experience
- Process payments
- Send important notifications
- Analyze usage to improve features

## 3. Data Sharing
We do not sell your personal information. We may share data with:
- Payment processors (for transactions)
- Analytics services (anonymized data)
- Legal authorities (when required by law)

## 4. Data Security
We use industry-standard encryption and security measures to protect your data.

## 5. Your Rights
You have the right to:
- Access your personal data
- Correct inaccurate information
- Delete your account
- Export your data

## 6. Contact Us
For privacy questions: support@gracefy.com

Last updated: February 2026
""",
        "content_sw": """# Sera ya Faragha

Faragha yako ni muhimu kwetu. Sera hii inaeleza jinsi tunavyokusanya, kutumia, na kulinda taarifa zako.

## 1. Taarifa Tunazokusanya

### Taarifa za Kibinafsi
- Barua pepe na jina unapounda akaunti
- Nambari ya simu (si lazima)
- Taarifa za malipo kwa usajili

### Data ya Matumizi
- Nyimbo na albamu unazosikiza
- Orodha za nyimbo unazounda
- Mifumo ya matumizi ya programu

### Taarifa za Kifaa
- Aina ya kifaa na mfumo wa uendeshaji
- Anwani ya IP na eneo (nchi/mkoa)

## 2. Jinsi Tunavyotumia Taarifa Zako
- Kutoa na kuboresha huduma yetu
- Kubinafsisha uzoefu wako wa muziki
- Kushughulikia malipo
- Kutuma arifa muhimu
- Kuchambua matumizi ili kuboresha vipengele

## 3. Kushiriki Data
Hatuuzi taarifa zako za kibinafsi. Tunaweza kushiriki data na:
- Wasindikaji wa malipo (kwa miamala)
- Huduma za uchambuzi (data isiyojulikana)
- Mamlaka za kisheria (inapohitajika na sheria)

## 4. Usalama wa Data
Tunatumia hatua za kisasa za usimbaji na usalama kulinda data yako.

## 5. Haki Zako
Una haki ya:
- Kufikia data yako ya kibinafsi
- Kurekebisha taarifa zisizo sahihi
- Kufuta akaunti yako
- Kusafirisha data yako

## 6. Wasiliana Nasi
Kwa maswali ya faragha: support@gracefy.com

Imesasishwa mwisho: Februari 2026
"""
    },
    "contact": {
        "page_id": "contact",
        "title": "Contact Us",
        "title_sw": "Wasiliana Nasi",
        "content": """# Contact Us

We'd love to hear from you! Here's how you can reach us:

## Customer Support
- **Email:** support@gracefy.com
- **Response Time:** Within 24-48 hours

## Business Inquiries
- **Email:** business@gracefy.com

## Content Submissions
Artists and labels interested in adding content:
- **Email:** content@gracefy.com

## Social Media
Follow us for updates:
- Facebook: @GracefyApp
- Instagram: @GracefyApp
- Twitter: @GracefyApp

## Office Location
Dar es Salaam, Tanzania

## Feedback
We value your feedback! Help us improve by sharing your thoughts at feedback@gracefy.com

---

Thank you for using Gracefy - Christian Music Streaming from East Africa 🎵
""",
        "content_sw": """# Wasiliana Nasi

Tungependa kusikia kutoka kwako! Hivi ndivyo unavyoweza kuwasiliana nasi:

## Msaada kwa Wateja
- **Barua pepe:** support@gracefy.com
- **Muda wa Majibu:** Ndani ya masaa 24-48

## Maswali ya Biashara
- **Barua pepe:** business@gracefy.com

## Kuwasilisha Maudhui
Wasanii na lebo wanaopenda kuongeza maudhui:
- **Barua pepe:** content@gracefy.com

## Mitandao ya Kijamii
Tufuate kwa habari mpya:
- Facebook: @GracefyApp
- Instagram: @GracefyApp
- Twitter: @GracefyApp

## Mahali pa Ofisi
Dar es Salaam, Tanzania

## Maoni
Tunathamini maoni yako! Tusaidie kuboresha kwa kushiriki mawazo yako kwa feedback@gracefy.com

---

Asante kwa kutumia Gracefy - Muziki wa Kikristo kutoka Afrika Mashariki 🎵
"""
    }
}


@router.get("/legal/{page_id}")
async def get_legal_page(page_id: str, lang: str = "en"):
    """
    Get a legal page (terms, privacy, contact).
    Public endpoint - no auth required.
    """
    db = get_db()
    
    # Valid page IDs
    valid_pages = ["terms_of_service", "privacy_policy", "contact"]
    if page_id not in valid_pages:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Try to get from database
    page = await db.legal_pages.find_one({"page_id": page_id}, {"_id": 0})
    
    # Use default if not found
    if not page:
        page = DEFAULT_PAGES.get(page_id, {})
    
    # Return localized content based on language
    if lang == "sw":
        return {
            "page_id": page_id,
            "title": page.get("title_sw") or page.get("title", ""),
            "content": page.get("content_sw") or page.get("content", ""),
            "updated_at": page.get("updated_at")
        }
    else:
        return {
            "page_id": page_id,
            "title": page.get("title", ""),
            "content": page.get("content", ""),
            "updated_at": page.get("updated_at")
        }


@router.get("/admin/legal")
async def get_all_legal_pages():
    """Get all legal pages for admin editing."""
    db = get_db()
    
    pages = []
    for page_id in ["terms_of_service", "privacy_policy", "contact"]:
        page = await db.legal_pages.find_one({"page_id": page_id}, {"_id": 0})
        if not page:
            page = DEFAULT_PAGES.get(page_id, {})
        pages.append(page)
    
    return {"pages": pages}


@router.put("/admin/legal/{page_id}")
async def update_legal_page(page_id: str, data: LegalPageUpdate):
    """Update a legal page (admin only)."""
    db = get_db()
    
    valid_pages = ["terms_of_service", "privacy_policy", "contact"]
    if page_id not in valid_pages:
        raise HTTPException(status_code=404, detail="Page not found")
    
    update_data = {
        "page_id": page_id,
        "title": data.title,
        "title_sw": data.title_sw or data.title,
        "content": data.content,
        "content_sw": data.content_sw or data.content,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.legal_pages.update_one(
        {"page_id": page_id},
        {"$set": update_data},
        upsert=True
    )
    
    return {"success": True, "page": update_data}


@router.post("/admin/legal/{page_id}/reset")
async def reset_legal_page(page_id: str):
    """Reset a legal page to default content."""
    db = get_db()
    
    if page_id not in DEFAULT_PAGES:
        raise HTTPException(status_code=404, detail="Page not found")
    
    default = DEFAULT_PAGES[page_id]
    default["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.legal_pages.update_one(
        {"page_id": page_id},
        {"$set": default},
        upsert=True
    )
    
    return {"success": True, "page": default}
