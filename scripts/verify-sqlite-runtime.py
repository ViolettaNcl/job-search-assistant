"""Exercise the built HTTP app and persistence without external accounts or submissions."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DLL = ROOT / "src/JobSearchAssistant/bin/Release/net10.0/JobSearchAssistant.dll"
BACKEND = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DLL


def verify():
    with tempfile.TemporaryDirectory(prefix="vja-sqlite-") as directory:
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        env = dict(os.environ, ConnectionStrings__Postgres="",
                   ConnectionStrings__Sqlite=f"Data Source={directory}/pilot.db",
                   HH__Enabled="false", Remotive__Enabled="false", Adzuna__Enabled="false",
                   Telegram__BotToken="", Security__EnableAutomaticSubmission="false", Reasoning__Enabled="false")

        def request(path, data=None):
            req = urllib.request.Request(base + path,
                data=None if data is None else json.dumps(data).encode(),
                headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=5) as response:
                body = response.read()
                return json.loads(body) if body else None

        vacancy_id = None
        for restart in range(2):
            with open(Path(directory) / f"server-{restart}.log", "w+") as log:
                command = [str(BACKEND)] if BACKEND.suffix == ".exe" else ["dotnet", str(BACKEND)]
                content_root = BACKEND.parent if BACKEND.suffix == ".exe" else ROOT / "src/JobSearchAssistant"
                process = subprocess.Popen(command + ["--urls", base],
                    cwd=content_root, env=env, stdout=log, stderr=log)
                try:
                    for attempt in range(100):
                        if process.poll() is not None:
                            raise RuntimeError("Backend exited before readiness")
                        try:
                            health = request("/health")
                            break
                        except (urllib.error.URLError, TimeoutError):
                            time.sleep(0.1)
                    else:
                        raise RuntimeError("Backend readiness timed out")
                    assert health["database"] == "sqlite" and health["persistent"]
                    request("/health/ready")
                    if restart == 0:
                        settings = request('/api/settings/autoapply/preferences', {'minimumScore': 50, 'dailyLimit': 90})
                        assert settings['autoApplyMinimumScore'] == 50 and settings['dailyAutoApplyLimit'] == 90
                        started = request('/api/collect/start', {})
                        assert started['running']
                        for _ in range(50):
                            collection = request('/api/automation/status')['collection']
                            if not collection['running']: break
                            time.sleep(.1)
                        assert not collection['running'] and collection['result']['errors'], 'Disabled HH must be reported, not silently look successful'
                        vacancy = request("/api/import/browser", {
                            "url": "https://example.com/jobs/sqlite-pilot", "title": "Junior C# internship",
                            "company": "SQLite Pilot", "description": "C# .NET ASP.NET Core EF Core SQL REST Git. Junior paid internship. Remote Europe.",
                            "country": "Poland", "location": "Europe", "remoteScope": "Europe", "remote": True})
                        vacancy_id = vacancy["id"]
                    settings = request('/api/automation/status')
                    assert settings['autoApplyMinimumScore'] == 50 and settings['dailyAutoApplyLimit'] == 90, 'Settings must survive restart'
                    rows = request("/api/vacancies?market=International&type=Internship")
                    assert any(row["id"] == vacancy_id for row in rows), "Imported job must survive restart"
                    dashboard = request("/api/dashboard")
                    assert dashboard["best"] if restart == 0 else dashboard["pipeline"]
                    request("/api/application-queue")
                    request("/api/followups")
                    request("/api/analytics/outcomes")
                    knowledge = request("/api/operator/candidate")
                    assert knowledge["identity"]["russian"] == "Виолетта Николау"
                    assessment = request(f"/api/operator/vacancies/{vacancy_id}")
                    assert assessment["assessment"]["reasoningMode"] == "deterministic-fallback"
                    assert assessment["strategy"]["projects"][0]["id"] == "dental"
                    prepared = request(f"/api/operator/vacancies/{vacancy_id}/prepare", {})
                    assert prepared["application"]["reasoningMode"] == "deterministic-fallback"
                    assert "DentalClinic" in prepared["application"]["letter"]
                    today = request("/api/operator/today")
                    assert today["pilot"]["confirmedSuccessRate"] is None
                    triage = request("/api/operator/recruiter/triage", {"text": "Приглашаем на собеседование завтра."})
                    assert triage["urgency"] == "CRITICAL" and triage["requiresApproval"]
                    if restart == 0:
                        # A CRM status only; no employer API or application submission.
                        request(f"/api/vacancies/{vacancy_id}/status", {"status": "HrContact", "note": "Synthetic CI fixture"})
                    else:
                        assert rows[0]["status"] == "HrContact"
                except Exception:
                    log.flush()
                    log.seek(0)
                    print(log.read())
                    raise
                finally:
                    process.terminate()
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
        print("SQLite HTTP smoke passed: import, dashboard, filters, queues, analytics, restart persistence.")


if __name__ == "__main__":
    verify()
