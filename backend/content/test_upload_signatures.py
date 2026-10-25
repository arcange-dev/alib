from django.test import SimpleTestCase

from content.views import _file_signature_matches


class UploadSignatureValidationTests(SimpleTestCase):
    def test_each_allowed_file_type_requires_its_signature(self):
        valid_headers = {
            'image/jpeg': b'\xff\xd8\xff\xe0' + b'0' * 8,
            'image/png': b'\x89PNG\r\n\x1a\n' + b'0' * 8,
            'image/webp': b'RIFF' + b'0' * 4 + b'WEBP' + b'0' * 4,
            'image/gif': b'GIF89a' + b'0' * 8,
            'application/pdf': b'%PDF-1.7\n',
            'audio/mpeg': b'ID3' + b'0' * 8,
            'audio/mp4': b'\x00\x00\x00\x18ftypM4A ' + b'0' * 4,
            'video/mp4': b'\x00\x00\x00\x18ftypisom' + b'0' * 4,
            'video/webm': b'\x1a\x45\xdf\xa3' + b'0' * 8,
        }
        for mime_type, header in valid_headers.items():
            with self.subTest(mime_type=mime_type):
                self.assertTrue(_file_signature_matches(mime_type, header))

    def test_mismatched_bytes_are_rejected_even_when_extension_or_mime_lies(self):
        for mime_type in (
            'image/jpeg', 'image/png', 'image/webp', 'image/gif',
            'application/pdf', 'audio/mpeg', 'audio/mp4', 'video/mp4', 'video/webm',
        ):
            with self.subTest(mime_type=mime_type):
                self.assertFalse(_file_signature_matches(mime_type, b'<html>not a media file</html>'))

    def test_unknown_mime_type_is_not_accepted(self):
        self.assertFalse(_file_signature_matches('application/x-msdownload', b'MZ'))
