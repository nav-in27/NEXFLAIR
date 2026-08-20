import os
import pytest
from app.core.config import settings

@pytest.fixture(autouse=True)
def configure_test_gps_mode(monkeypatch):
    """
    Ensure the test suite tests real GPS algorithms by default unless
    explicitly enabled in a specific test.
    """
    # If a test didn't explicitly set DEMO_GPS_MODE, set it to False during unit test execution
    # to test real haversine/spatial calculations.
    monkeypatch.setattr(settings, "DEMO_GPS_MODE", False)
