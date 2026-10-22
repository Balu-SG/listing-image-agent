"""URL fetching safeguards: only public https image links get through."""

import socket

import pytest

from api import fetch_url
from api.fetch_url import UrlRejected, check_url


def resolves_to(monkeypatch, address):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(None, None, None, "", (address, 443))])


@pytest.mark.parametrize("url", ["http://example.com/a.jpg", "file:///etc/passwd", "ftp://example.com/a.jpg", "https://user:pw@example.com/a.jpg"])
def test_only_plain_https_links(url):
    with pytest.raises(UrlRejected):
        check_url(url)


@pytest.mark.parametrize("address", ["127.0.0.1", "10.0.0.5", "192.168.1.10", "169.254.169.254", "::1", "fd00::1"])
def test_private_and_local_addresses_are_rejected(monkeypatch, address):
    resolves_to(monkeypatch, address)
    with pytest.raises(UrlRejected, match="private or local"):
        check_url("https://images.example.com/a.jpg")


def test_public_address_is_allowed(monkeypatch):
    resolves_to(monkeypatch, "93.184.216.34")
    assert check_url("https://images.example.com/a.jpg") == "images.example.com"


class FakeResponse:
    def __init__(self, content_type, body):
        self.headers = {"Content-Type": content_type, "Content-Length": str(len(body))}
        self.body = body

    def read(self, limit):
        return self.body[:limit]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def test_web_pages_are_rejected(monkeypatch):
    resolves_to(monkeypatch, "93.184.216.34")
    monkeypatch.setattr(fetch_url._opener, "open", lambda request, timeout: FakeResponse("text/html", b"<html>"))
    with pytest.raises(UrlRejected, match="not a JPEG"):
        fetch_url.fetch_image("https://www.example.com/product-page")


def test_oversized_images_are_rejected(monkeypatch):
    resolves_to(monkeypatch, "93.184.216.34")
    big = b"x" * (fetch_url.MAX_BYTES + 10)
    monkeypatch.setattr(fetch_url._opener, "open", lambda request, timeout: FakeResponse("image/jpeg", big))
    with pytest.raises(UrlRejected, match="4.5 MB"):
        fetch_url.fetch_image("https://images.example.com/big.jpg")


def test_image_is_returned_with_its_filename(monkeypatch):
    resolves_to(monkeypatch, "93.184.216.34")
    monkeypatch.setattr(fetch_url._opener, "open", lambda request, timeout: FakeResponse("image/png", b"\x89PNG..."))
    data, name = fetch_url.fetch_image("https://images.example.com/path/shoe.png?x=1")
    assert data.startswith(b"\x89PNG") and name == "shoe.png"


def test_redirect_to_private_address_is_rejected(monkeypatch):
    """Each redirect hop is re-checked, so a public link cannot bounce the server to an internal one."""
    import urllib.error

    addresses = {"public.example.com": "93.184.216.34", "internal.example.com": "10.0.0.7"}
    monkeypatch.setattr(socket, "getaddrinfo", lambda host, *a, **k: [(None, None, None, "", (addresses[host], 443))])

    def redirect(request, timeout):
        raise urllib.error.HTTPError(request.full_url, 302, "Found", {"Location": "https://internal.example.com/x.jpg"}, None)

    monkeypatch.setattr(fetch_url._opener, "open", redirect)
    with pytest.raises(UrlRejected, match="private or local"):
        fetch_url.fetch_image("https://public.example.com/a.jpg")
