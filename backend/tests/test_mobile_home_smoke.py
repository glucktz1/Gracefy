"""Backend smoke tests for mobile HomeScreen data-loading fix."""
import os
import pytest
import requests

BASE_URL = "https://gracefy-hls-launch.preview.emergentagent.com"
TIMEOUT = 30


@pytest.fixture(scope="module")
def home_app():
    r = requests.get(f"{BASE_URL}/api/home/app", timeout=TIMEOUT)
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:400]}"
    return r.json()


def test_home_app_has_sections_and_hero(home_app):
    data = home_app
    sections = data.get("sections") or []
    hero = data.get("hero") or {}
    hero_items = hero.get("items") or []
    assert len(sections) >= 5, f"expected >=5 sections, got {len(sections)}"
    assert len(hero_items) > 0, "hero.items empty"
    non_empty = [s for s in sections if (s.get("items") or [])]
    assert len(non_empty) > 0, "no section has items"


def test_song_categories_with_counts():
    r = requests.get(f"{BASE_URL}/api/song-categories?with_counts=true", timeout=TIMEOUT)
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    cats = body if isinstance(body, list) else body.get("categories") or body.get("data") or []
    assert isinstance(cats, list) and len(cats) > 0, f"empty categories: {body}"
    assert any("total_songs" in c for c in cats), "no total_songs field on any category"


def test_layout_home_filters():
    r = requests.get(f"{BASE_URL}/api/layout/home-filters", timeout=TIMEOUT)
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    filters = body if isinstance(body, list) else body.get("filters") or body.get("data") or body
    assert filters, f"no filters returned: {body}"


def _find_song_id(home_app):
    for s in home_app.get("sections") or []:
        for it in s.get("items") or []:
            sid = it.get("id") or it.get("song_id") or it.get("_id")
            if sid and (it.get("audio_url") or it.get("hls_url") or it.get("type") in (None, "song")):
                return sid
    for it in (home_app.get("hero") or {}).get("items") or []:
        sid = it.get("id") or it.get("song_id")
        if sid:
            return sid
    return None


def _find_album_id(home_app):
    for s in home_app.get("sections") or []:
        for it in s.get("items") or []:
            if it.get("type") == "album" or "album_id" in it:
                return it.get("album_id") or it.get("id")
    return None


def test_recommendations_next_songs(home_app):
    sid = _find_song_id(home_app)
    if not sid:
        aid = _find_album_id(home_app)
        if aid:
            ar = requests.get(f"{BASE_URL}/api/albums/{aid}", timeout=TIMEOUT).json()
            songs = ar.get("songs") or []
            if songs:
                sid = songs[0].get("song_id") or songs[0].get("id")
    if not sid:
        pytest.skip("no song id found")
    r = requests.get(
        f"{BASE_URL}/api/recommendations/next-songs",
        params={"current_song_id": sid, "limit": 12},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    songs = body if isinstance(body, list) else body.get("songs") or body.get("data") or []
    assert len(songs) > 0, f"empty next-songs: {body}"
    assert any(s.get("audio_url") or s.get("hls_url") for s in songs), "no audio_url/hls_url in any recommended song"


def test_album_detail_with_songs(home_app):
    aid = _find_album_id(home_app)
    if not aid:
        # fallback: fetch albums list
        r = requests.get(f"{BASE_URL}/api/albums", timeout=TIMEOUT)
        if r.status_code == 200:
            body = r.json()
            arr = body if isinstance(body, list) else body.get("albums") or body.get("data") or []
            if arr:
                aid = arr[0].get("id") or arr[0].get("_id")
    if not aid:
        pytest.skip("no album id available")
    r = requests.get(f"{BASE_URL}/api/albums/{aid}", timeout=TIMEOUT)
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    songs = body.get("songs") or (body.get("album") or {}).get("songs") or []
    assert len(songs) > 0, f"album has no songs: keys={list(body.keys())}"
    urls = [s.get("audio_url") for s in songs if s.get("audio_url")]
    assert len(urls) > 0, "no audio_url on any song in album"
    # quick sanity: URL scheme
    assert urls[0].startswith("http"), f"invalid audio_url: {urls[0]}"
