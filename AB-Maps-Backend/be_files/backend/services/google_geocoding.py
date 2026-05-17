"""
Google Geocoding service helper.

Provides a small wrapper to call the Google Geocoding API and return
structured results for use by the application.
"""

from __future__ import annotations

import time
import logging
from typing import Any, Dict, Optional, Tuple

import requests


logger = logging.getLogger(__name__)


class GoogleGeocodingError(Exception):
    """Raised when Google Geocoding returns a non-success status."""


def geocode_with_google(
    address_text: str,
    api_key: str,
    *,
    country_code: str = "NO",
    region: str = "no",
    timeout_seconds: int = 30,
    max_retries: int = 2,
) -> Dict[str, Any]:
    """
    Call Google Geocoding API and return a dict with coordinates and metadata.

    Returns a dict like:
        {
            'status': 'success',
            'latitude': float,
            'longitude': float,
            'formatted_address': str,
            'place_id': str,
            'raw': dict,  # full Google result item
        }

    On failure, returns:
        { 'status': 'failed', 'reason': str, 'google_status': str, 'error_message': str | None }
    """

    if not api_key:
        return {
            "status": "failed",
            "reason": "Missing Google API key",
            "google_status": None,
            "error_message": None,
        }

    base_url = "https://maps.googleapis.com/maps/api/geocode/json"

    # Google may return 200 with an error encoded in JSON 'status'.
    # Retry a couple of times for transient statuses.
    attempt = 0
    while True:
        attempt += 1
        try:
            params = {
                "address": address_text,
                "components": f"country:{country_code}",
                "region": region,
                "key": api_key,
            }
            resp = requests.get(base_url, params=params, timeout=timeout_seconds)
        except requests.Timeout:
            if attempt <= max_retries:
                sleep_seconds = 2 ** attempt
                logger.warning(
                    "Google Geocoding timeout (attempt %s). Retrying in %ss...",
                    attempt,
                    sleep_seconds,
                )
                time.sleep(sleep_seconds)
                continue
            return {
                "status": "failed",
                "reason": "Timeout from Google Geocoding API",
                "google_status": None,
                "error_message": None,
            }
        except requests.RequestException as e:
            return {
                "status": "failed",
                "reason": f"HTTP error: {e}",
                "google_status": None,
                "error_message": None,
            }

        # Parse Google response
        try:
            payload = resp.json()
        except ValueError:
            return {
                "status": "failed",
                "reason": "Invalid JSON from Google Geocoding API",
                "google_status": None,
                "error_message": None,
            }

        g_status: Optional[str] = payload.get("status")
        error_message: Optional[str] = payload.get("error_message")

        if g_status == "OK":
            results = payload.get("results", [])
            if not results:
                return {
                    "status": "failed",
                    "reason": "No results returned",
                    "google_status": g_status,
                    "error_message": None,
                }
            first = results[0]
            location = first.get("geometry", {}).get("location") or {}
            lat = location.get("lat")
            lng = location.get("lng")
            if lat is None or lng is None:
                return {
                    "status": "failed",
                    "reason": "Missing coordinates in result",
                    "google_status": g_status,
                    "error_message": None,
                }
            return {
                "status": "success",
                "latitude": float(lat),
                "longitude": float(lng),
                "formatted_address": first.get("formatted_address"),
                "place_id": first.get("place_id"),
                "raw": first,
            }

        # Retry for transient statuses
        if g_status in {"UNKNOWN_ERROR", "OVER_QUERY_LIMIT"} and attempt <= max_retries:
            sleep_seconds = 2 ** attempt
            logger.warning(
                "Google Geocoding status %s (attempt %s). Retrying in %ss...", g_status, attempt, sleep_seconds
            )
            time.sleep(sleep_seconds)
            continue

        # Non-retriable failure
        return {
            "status": "failed",
            "reason": "Google Geocoding returned error status",
            "google_status": g_status,
            "error_message": error_message,
        }


