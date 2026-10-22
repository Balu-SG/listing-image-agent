"""Download an image from a user-supplied URL, safely.

The server fetches whatever it is given, so: https only, every resolved address must be public
(no loopback, private, link-local, cloud metadata), redirects are re-checked hop by hop, only
image content types, a hard size cap and a short timeout.
"""

import ipaddress
import socket
import urllib.error
import urllib.request
from urllib.parse import urljoin, urlparse

MAX_BYTES = 4_500_000
TIMEOUT_SECONDS = 10
MAX_REDIRECTS = 3
IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp")


class UrlRejected(ValueError):
    """The URL is not allowed or did not return a usable image (message is shown to the user)."""


def check_url(url: str) -> str:
    """Returns the hostname if the URL is https and every address it resolves to is public."""
    parsed = urlparse(url.strip())
    if parsed.scheme != "https":
        raise UrlRejected("Only https:// image links are supported")
    if not parsed.hostname or parsed.username or parsed.password:
        raise UrlRejected("That does not look like a valid image link")
    try:
        addresses = {info[4][0] for info in socket.getaddrinfo(parsed.hostname, parsed.port or 443, proto=socket.IPPROTO_TCP)}
    except socket.gaierror as error:
        raise UrlRejected("Could not find that website") from error
    for address in addresses:
        ip = ipaddress.ip_address(address.split("%")[0])
        if not ip.is_global or ip.is_multicast:
            raise UrlRejected("That link points to a private or local address")
    return parsed.hostname


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None  # redirects are followed manually so each hop is checked


_opener = urllib.request.build_opener(_NoRedirect)


def fetch_image(url: str) -> tuple[bytes, str]:
    """Returns (image bytes, filename taken from the final URL path)."""
    current = url.strip()
    for _ in range(MAX_REDIRECTS + 1):
        check_url(current)
        request = urllib.request.Request(current, headers={"User-Agent": "ListingImageAgent/1.0", "Accept": "image/*"})
        try:
            response = _opener.open(request, timeout=TIMEOUT_SECONDS)
        except urllib.error.HTTPError as error:
            if error.code in (301, 302, 303, 307, 308) and error.headers.get("Location"):
                current = urljoin(current, error.headers["Location"])
                continue
            raise UrlRejected(f"The link returned HTTP {error.code}") from error
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            raise UrlRejected("Could not download that link") from error

        with response:
            content_type = (response.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            if content_type not in IMAGE_TYPES:
                raise UrlRejected("That link is not a JPEG, PNG or WebP image (copy the image address, not the page address)")
            declared = response.headers.get("Content-Length")
            if declared and declared.isdigit() and int(declared) > MAX_BYTES:
                raise UrlRejected("Image is larger than 4.5 MB")
            data = response.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise UrlRejected("Image is larger than 4.5 MB")
        name = urlparse(current).path.rsplit("/", 1)[-1] or "image"
        return data, name[:120]
    raise UrlRejected("Too many redirects")
