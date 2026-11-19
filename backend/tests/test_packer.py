import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app import auth


def req(method, path):
    return Request({"type": "http", "method": method, "path": path, "headers": [], "query_string": b""})


@pytest.mark.parametrize("method,path,ok", [
    ("GET", "/api/admin/orders", True),
    ("PATCH", "/api/admin/orders/3a399896-43f5-4f46-9db4-510c4434c7c5", True),
    ("GET", "/api/admin/orders/3a399896-43f5-4f46-9db4-510c4434c7c5/invoice", True),
    ("GET", "/api/admin/stats", False),
    ("GET", "/api/admin/orders/export", False),
    ("PUT", "/api/admin/settings", False),
    ("GET", "/api/admin/customers", False),
    ("POST", "/api/admin/products", False),
])
def test_packer_limits(monkeypatch, method, path, ok):
    monkeypatch.setattr(auth, "role_of", lambda u: "packer")
    r = req(method, path)
    if ok:
        assert auth.admin_gate(r, {"id": "u"}) == {"id": "u"} and r.state.role == "packer"
    else:
        with pytest.raises(HTTPException):
            auth.admin_gate(r, {"id": "u"})


def test_customer_refused_admin_allowed(monkeypatch):
    monkeypatch.setattr(auth, "role_of", lambda u: "customer")
    with pytest.raises(HTTPException):
        auth.admin_gate(req("GET", "/api/admin/orders"), {"id": "u"})
    monkeypatch.setattr(auth, "role_of", lambda u: "admin")
    assert auth.admin_gate(req("GET", "/api/admin/stats"), {"id": "u"})
