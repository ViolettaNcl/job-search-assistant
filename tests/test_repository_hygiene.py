import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / 'tools' / 'check-repo-hygiene.py'
spec = importlib.util.spec_from_file_location('repo_hygiene', TOOL)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class RepositoryHygieneTests(unittest.TestCase):
    def test_rejects_nested_release_folder(self):
        self.assertIsNotNone(mod.reason('Violetta-Apply-Assistant-3.9.13/extension/background.js'))

    def test_rejects_runtime_roots(self):
        for path in [
            'backend/JobSearchAssistant.dll',
            'extension/manifest.json',
            'github-source/.github/workflows/ci.yml',
            'test-results/output.log',
            'dist/package.js',
            'artifacts/report.txt',
        ]:
            self.assertIsNotNone(mod.reason(path), path)

    def test_rejects_build_and_local_private_files(self):
        for path in [
            'src/App/bin/Release/App.dll',
            'src/App/obj/project.assets.json',
            'docs/.env',
            'browser-extension/candidate.private.json',
            'src/JobSearchAssistant/appsettings.local.json',
            'tools/user-settings.cmd',
        ]:
            self.assertIsNotNone(mod.reason(path), path)

    def test_allows_source_layout_and_candidate_assets(self):
        for path in [
            'browser-extension/manifest.json',
            'browser-extension/assets/cv/Violetta_Nicolaou_CV.pdf',
            'src/JobSearchAssistant/Program.cs',
            'tests/browser_e2e.py',
            'docs/USER_GUIDE.md',
            '.github/workflows/ci.yml',
            '.env.example',
        ]:
            self.assertIsNone(mod.reason(path), path)

    def test_current_publication_plan_is_clean(self):
        bad = [(p, mod.reason(p)) for p in mod.tracked_paths() if mod.reason(p)]
        self.assertEqual(bad, [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
