import requests
from django.conf import settings
from rest_framework.exceptions import APIException

class StorageNotConfigured(APIException):
    status_code = 503
    default_detail = 'File storage is not configured. Add the Supabase URL and storage service key to the backend environment.'
    default_code = 'storage_not_configured'

def _configuration():
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY or not settings.SUPABASE_STORAGE_BUCKET:
        raise StorageNotConfigured()
    return settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY, settings.SUPABASE_STORAGE_BUCKET

def _headers(key: str):
    return {'Authorization': f'Bearer {key}', 'apikey': key}

def upload_object(object_key: str, mime_type: str, data: bytes):
    base_url, key, bucket = _configuration()
    headers = _headers(key) | {'Content-Type': mime_type, 'x-upsert': 'false'}
    try:
        response = requests.post(f'{base_url}/storage/v1/object/{bucket}/{object_key}', headers=headers, data=data, timeout=30)
    except requests.RequestException as exc:
        raise APIException('The storage provider could not be reached. Check the backend storage configuration.') from exc
    if response.status_code not in (200, 201):
        raise APIException(f'Storage upload failed with status {response.status_code}. Check the bucket and storage permissions.')
    return object_key

def delete_object(object_key: str):
    base_url, key, bucket = _configuration()
    try:
        response = requests.delete(f'{base_url}/storage/v1/object/{bucket}/{object_key}', headers=_headers(key), timeout=15)
    except requests.RequestException as exc:
        raise APIException('The storage provider could not be reached. Try again later.') from exc
    if response.status_code not in (200, 201, 202, 204, 404):
        raise APIException(f'Storage delete failed with status {response.status_code}.')
    return True

def signed_object_url(object_key: str, expires_in: int = 120):
    base_url, key, bucket = _configuration()
    try:
        response = requests.post(
            f'{base_url}/storage/v1/object/sign/{bucket}/{object_key}',
            headers=_headers(key) | {'Content-Type': 'application/json'},
            json={'expiresIn': expires_in}, timeout=15,
        )
    except requests.RequestException as exc:
        raise APIException('The storage provider could not be reached. Try again later.') from exc
    if response.status_code not in (200, 201):
        raise APIException(f'Storage could not issue a signed URL (status {response.status_code}).')
    payload = response.json()
    signed_path = payload.get('signedURL') or payload.get('signedUrl')
    if not signed_path:
        raise APIException('The storage provider returned an unexpected signed-URL response.')
    if signed_path.startswith('http://') or signed_path.startswith('https://'):
        return signed_path
    return f'{base_url}/storage/v1{signed_path if signed_path.startswith("/") else "/" + signed_path}'
