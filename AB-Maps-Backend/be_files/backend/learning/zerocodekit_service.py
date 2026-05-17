"""
0CodeKit Storage API Service

This module handles all interactions with the 0CodeKit external storage API
for uploading images and videos used in learning content.

API Documentation: https://docs.0codekit.com/api/0-codekit-api/
"""
import base64
import requests
import logging
from typing import Optional, Dict, Any, Tuple
from django.conf import settings

logger = logging.getLogger(__name__)


class ZeroCodeKitError(Exception):
    """Exception raised for 0CodeKit API errors."""
    def __init__(self, message: str, status_code: int = None, response_data: dict = None):
        self.message = message
        self.status_code = status_code
        self.response_data = response_data
        super().__init__(self.message)


class ZeroCodeKitService:
    """
    Service class for interacting with 0CodeKit Storage API.
    
    Supports:
    - Permanent storage (files persist indefinitely)
    - Temporary storage (files deleted after 24 hours)
    
    Usage:
        service = ZeroCodeKitService()
        result = service.upload_to_permanent_storage(file_buffer, "video.mp4")
        print(result['url'])  # Permanent URL to the file
        print(result['fileId'])  # File ID for management
    """
    
    def __init__(self, api_key: str = None, base_url: str = None):
        """
        Initialize the 0CodeKit service.
        
        Args:
            api_key: API key for authentication. Defaults to settings.ZEROCODEKIT_API_KEY
            base_url: Base URL for the API. Defaults to settings.ZEROCODEKIT_BASE_URL
        """
        self.api_key = api_key or getattr(settings, 'ZEROCODEKIT_API_KEY', '')
        self.base_url = base_url or getattr(settings, 'ZEROCODEKIT_BASE_URL', 'https://api.0codekit.com')
        
        if not self.api_key:
            raise ZeroCodeKitError("0CodeKit API key not configured")
    
    def _get_headers(self) -> Dict[str, str]:
        """
        Get headers for API requests.
        
        According to 0CodeKit documentation:
        - Authentication uses header parameter 'auth' (not 'Authorization')
        - Content-Type should be 'application/json'
        """
        return {
            'auth': self.api_key,  # 0CodeKit uses 'auth' header, not 'Authorization: Bearer'
            'Content-Type': 'application/json',
        }
    
    def _make_request(self, method: str, endpoint: str, data: dict = None) -> Dict[str, Any]:
        """
        Make a request to the 0CodeKit API.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint (e.g., /storage/perm/add)
            data: Request body data
        
        Returns:
            Response data as dictionary
        
        Raises:
            ZeroCodeKitError: If the request fails
        """
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=self._get_headers(),
                json=data,
                timeout=120  # 2 minute timeout for large video uploads
            )
            
            # Log the request for debugging
            logger.info(f"0CodeKit API {method} {endpoint}: Status {response.status_code}")
            
            if response.status_code == 200:
                return response.json()
            else:
                error_data = None
                try:
                    error_data = response.json()
                except:
                    error_data = {'raw': response.text}
                
                logger.error(f"0CodeKit API error: {response.status_code} - {error_data}")
                raise ZeroCodeKitError(
                    message=f"API request failed: {response.status_code}",
                    status_code=response.status_code,
                    response_data=error_data
                )
        
        except requests.exceptions.Timeout:
            logger.error("0CodeKit API timeout")
            raise ZeroCodeKitError("Request timed out. File may be too large.")
        
        except requests.exceptions.RequestException as e:
            logger.error(f"0CodeKit API request exception: {str(e)}")
            raise ZeroCodeKitError(f"Request failed: {str(e)}")
    
    def upload_to_permanent_storage(
        self, 
        file_buffer: bytes, 
        filename: str
    ) -> Dict[str, str]:
        """
        Upload a file to 0CodeKit permanent storage.
        
        Files uploaded to permanent storage do not expire and are accessible
        via the returned URL indefinitely (subject to plan limits).
        
        Args:
            file_buffer: Raw bytes of the file to upload
            filename: Original filename (used for download name)
        
        Returns:
            Dictionary with:
                - fileId: Unique identifier for the file
                - url: Permanent URL to access the file
        
        Raises:
            ZeroCodeKitError: If upload fails
        
        Example:
            >>> with open('video.mp4', 'rb') as f:
            ...     result = service.upload_to_permanent_storage(f.read(), 'video.mp4')
            >>> print(result['url'])
            'https://files.0codekit.com/abc123/video.mp4'
        """
        # Encode file to base64
        file_base64 = base64.b64encode(file_buffer).decode('utf-8')
        
        payload = {
            'fileBuffer': file_base64,
            'uploadName': filename
        }
        
        logger.info(f"Uploading {filename} ({len(file_buffer)} bytes) to 0CodeKit permanent storage")
        
        result = self._make_request('POST', '/storage/perm/add', payload)
        
        logger.info(f"Successfully uploaded {filename}. File ID: {result.get('fileId')}")
        
        return {
            'fileId': result.get('fileId'),
            'url': result.get('url')
        }
    
    def upload_to_temporary_storage(
        self, 
        file_buffer: bytes, 
        filename: str
    ) -> Dict[str, str]:
        """
        Upload a file to 0CodeKit temporary storage.
        
        Files uploaded to temporary storage are automatically deleted after ~24 hours.
        Useful for previews, drafts, or temporary content.
        
        Args:
            file_buffer: Raw bytes of the file to upload
            filename: Original filename
        
        Returns:
            Dictionary with:
                - url: Temporary URL to access the file (expires in ~24 hours)
        
        Raises:
            ZeroCodeKitError: If upload fails
        """
        # Encode file to base64
        file_base64 = base64.b64encode(file_buffer).decode('utf-8')
        
        payload = {
            'buffer': file_base64,
            'fileName': filename
        }
        
        logger.info(f"Uploading {filename} to 0CodeKit temporary storage")
        
        result = self._make_request('POST', '/storage/temp', payload)
        
        return {
            'url': result.get('url')
        }
    
    def upload_from_url(self, file_url: str, filename: str) -> Dict[str, str]:
        """
        Upload a file to permanent storage from an existing URL.
        
        Instead of uploading file bytes, you can provide a URL to an existing file
        and 0CodeKit will fetch and store it.
        
        Args:
            file_url: URL of the file to upload
            filename: Filename to use for the stored file
        
        Returns:
            Dictionary with fileId and url
        
        Raises:
            ZeroCodeKitError: If upload fails
        """
        payload = {
            'fileUrl': file_url,
            'uploadName': filename
        }
        
        logger.info(f"Uploading from URL {file_url} to 0CodeKit")
        
        result = self._make_request('POST', '/storage/perm/add', payload)
        
        return {
            'fileId': result.get('fileId'),
            'url': result.get('url')
        }
    
    def delete_from_permanent_storage(self, file_id: str) -> bool:
        """
        Delete a file from permanent storage.
        
        Args:
            file_id: The fileId returned when the file was uploaded
        
        Returns:
            True if deletion was successful
        
        Raises:
            ZeroCodeKitError: If deletion fails
        """
        payload = {
            'fileId': file_id
        }
        
        logger.info(f"Deleting file {file_id} from 0CodeKit")
        
        self._make_request('POST', '/storage/perm/del', payload)
        
        return True


def get_zerocodekit_service() -> ZeroCodeKitService:
    """
    Factory function to get a configured 0CodeKit service instance.
    
    Returns:
        Configured ZeroCodeKitService instance
    """
    return ZeroCodeKitService()


def upload_media_to_zerocodekit(
    file_data: bytes,
    filename: str,
    permanent: bool = True
) -> Tuple[str, Optional[str]]:
    """
    Helper function to upload media to 0CodeKit.
    
    Args:
        file_data: Raw bytes of the file
        filename: Original filename
        permanent: Whether to use permanent storage (default: True)
    
    Returns:
        Tuple of (url, file_id) - file_id is None for temporary storage
    
    Raises:
        ZeroCodeKitError: If upload fails
    """
    service = get_zerocodekit_service()
    
    if permanent:
        result = service.upload_to_permanent_storage(file_data, filename)
        return result['url'], result['fileId']
    else:
        result = service.upload_to_temporary_storage(file_data, filename)
        return result['url'], None
