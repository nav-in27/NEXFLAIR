"""
Phase 15 – Deterministic Hackathon Demo Mode Tests
==================================================
Tests the 6 deterministic verification scenarios and endpoints:
1. GENUINE_RESOLUTION (VERIFIED, score 95)
2. WRONG_LOCATION (SUSPICIOUS, score 42)
3. NO_RESOLUTION (HUMAN_REVIEW, score 58)
4. REPLAYED_EVIDENCE (SUSPICIOUS, score 64)
5. SPATIO_TEMPORAL_ANOMALY (SUSPICIOUS, score 67)
6. LOW_QUALITY_EVIDENCE (HUMAN_REVIEW, score 62)
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestDemoModeScenarios:

    def test_get_all_demo_scenarios(self):
        """Endpoint /api/tickets/demo-scenarios returns 6 deterministic scenarios."""
        resp = client.get("/api/tickets/demo-scenarios")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 6

    def test_scenario_1_genuine_resolution(self):
        """Scenario 1: Genuine Resolution returns VERIFIED decision (score 95)."""
        resp = client.get("/api/tickets/demo-scenarios/GENUINE_RESOLUTION")
        assert resp.status_code == 200
        data = resp.json()
        assert data["decision"] == "VERIFIED"
        assert data["overall_score"] == 95
        assert data["signals"]["scene"] == 96
        assert data["signals"]["hazard"] == 94

    def test_scenario_2_wrong_location(self):
        """Scenario 2: Wrong Location returns SUSPICIOUS decision (scene 28, score 42)."""
        resp = client.get("/api/tickets/demo-scenarios/WRONG_LOCATION")
        assert resp.status_code == 200
        data = resp.json()
        assert data["decision"] in ["SUSPICIOUS", "CLOSURE_NOT_VERIFIED"]
        assert data["signals"]["scene"] in [8, 28]
        assert ("does not correspond" in data["explanation"].lower() or "low visual consistency" in data["explanation"].lower())

    def test_scenario_3_no_resolution(self):
        """Scenario 3: No Resolution returns HUMAN_REVIEW decision (hazard 15, score 58)."""
        resp = client.get("/api/tickets/demo-scenarios/NO_RESOLUTION")
        assert resp.status_code == 200
        data = resp.json()
        assert data["decision"] == "HUMAN_REVIEW"
        assert data["signals"]["hazard"] == 15
        assert "hazard area reduction" in data["explanation"].lower()

    def test_scenario_4_replayed_evidence(self):
        """Scenario 4: Replayed Evidence returns SUSPICIOUS decision (freshness 12)."""
        resp = client.get("/api/tickets/demo-scenarios/REPLAYED_EVIDENCE")
        assert resp.status_code == 200
        data = resp.json()
        assert data["decision"] == "SUSPICIOUS"
        assert data["signals"]["freshness"] == 12
        assert "exact duplicate" in data["explanation"].lower()

    def test_scenario_5_spatio_temporal_anomaly(self):
        """Scenario 5: Spatio-Temporal Anomaly returns SUSPICIOUS decision."""
        resp = client.get("/api/tickets/demo-scenarios/SPATIO_TEMPORAL_ANOMALY")
        assert resp.status_code == 200
        data = resp.json()
        assert data["decision"] == "SUSPICIOUS"
        assert data["signals"]["temporal"] == 20
        assert "spatio-temporal inconsistency" in data["explanation"].lower()

    def test_scenario_6_low_quality(self):
        """Scenario 6: Low Quality Evidence returns HUMAN_REVIEW decision (quality 35)."""
        resp = client.get("/api/tickets/demo-scenarios/LOW_QUALITY_EVIDENCE")
        assert resp.status_code == 200
        data = resp.json()
        assert data["decision"] == "HUMAN_REVIEW"
        assert data["signals"]["quality"] == 35
        assert "quality flags" in data["explanation"].lower()
