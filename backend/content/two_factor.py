import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

from cryptography.fernet import Fernet
from django.conf import settings


def _fernet():
    # Derive a dedicated encryption key. Rotating DJANGO_SECRET_KEY intentionally
    # requires users to disable/re-enrol their second factor.
    digest = hashlib.sha256((settings.SECRET_KEY + ':alib-staff-2fa-v1').encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode('ascii')).decode('ascii')


def decrypt_secret(ciphertext: str) -> str:
    return _fernet().decrypt(ciphertext.encode('ascii')).decode('ascii')


def generate_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode('ascii').rstrip('=')


def provisioning_uri(secret: str, username: str) -> str:
    label = quote(f'ALIB:{username}', safe='')
    return f'otpauth://totp/{label}?secret={secret}&issuer=ALIB&algorithm=SHA1&digits=6&period=30'


def code_for_step(secret: str, step: int) -> str:
    padded = secret.upper() + ('=' * ((8 - len(secret) % 8) % 8))
    key = base64.b32decode(padded, casefold=True)
    digest = hmac.new(key, struct.pack('>Q', step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    binary = struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(binary % 1_000_000).zfill(6)


def verify_code(secret: str, provided: str, now: float | None = None) -> int | None:
    candidate = str(provided or '').strip()
    if len(candidate) != 6 or not candidate.isascii() or not candidate.isdigit():
        return None
    current_step = int((time.time() if now is None else now) // 30)
    for step in (current_step - 1, current_step, current_step + 1):
        expected = code_for_step(secret, step)
        if hmac.compare_digest(expected, candidate):
            return step
    return None
