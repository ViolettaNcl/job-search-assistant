"""Validate the release publication PLAN and real local Git semantics.
This is not execution of the Windows PowerShell publisher. No GitHub writes.
"""
from pathlib import Path, PurePosixPath
import hashlib, json, re, shutil, subprocess, tempfile, unittest

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'source-sync-manifest.json'
ALLOWED = re.compile(r'^(browser-extension/|tests/|docs/|tools/|scripts/|\.github/workflows/candidate-memory-regression\.yml$|README\.md$|ARCHITECTURE\.md$|IMPLEMENTATION_STATUS\.md$|SUPPORTED_SITES\.md$|TESTING_GUIDE\.md$|WHAT_CHANGED\.md$|START_HERE\.txt$|SECURITY\.md$|ROADMAP\.md$|start-assistant\.cmd$|STOP_ASSISTANT\.cmd$|BACKEND_DIAGNOSTICS\.cmd$|UPDATE_EXISTING\.cmd$|user-settings\.example\.cmd$)')
FORBIDDEN = re.compile(r'(?i)\.(dll|exe|pdb|zip|log|db|woff2?|ttf|otf)$|(^|/)node_modules/|test-results/|(^|/)\.env$|candidate\.private\.json$|appsettings\.local\.json$|(^|/)user-settings\.cmd$')

def safe(root, relative):
    q = PurePosixPath(relative.replace('\\', '/'))
    if q.is_absolute() or '..' in q.parts or '.git' in q.parts or ':' in relative:
        raise ValueError('unsafe path')
    result = (root / str(q)).resolve()
    if root.resolve() not in result.parents:
        raise ValueError('root escape')
    return result

def validate(data):
    if data.get('version') != '3.8.0' or data.get('repository') != 'ViolettaNcl/job-search-assistant':
        raise ValueError('wrong release')
    seen = set()
    for row in data['files']:
        if not ALLOWED.search(row['target']) or FORBIDDEN.search(row['target']):
            raise ValueError('not source')
        safe(ROOT, row['target'])
        if row['target'].lower() in seen:
            raise ValueError('duplicate target')
        seen.add(row['target'].lower())
        path = safe(ROOT, row['source'])
        if hashlib.sha256(path.read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('hash mismatch')
    return seen

def git(cwd, *args, codes=(0,)):
    r = subprocess.run(['git', '-C', str(cwd), *args], text=True, capture_output=True)
    if r.returncode not in codes:
        raise AssertionError(f'git {args}: {r.returncode}\n{r.stderr}')
    return r

@unittest.skipUnless(MANIFEST.exists(), 'Release manifest exists in Windows ZIP, not source-only clone')
class PublicationPlanTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads(MANIFEST.read_text())

    def test_every_hash_and_whitelisted_target(self):
        targets = validate(self.data)
        self.assertIn('browser-extension/manifest.json', targets)
        self.assertIn('.github/workflows/candidate-memory-regression.yml', targets)
        self.assertIn('scripts/start-assistant-windows.cmd', targets)
        self.assertFalse(any(t.startswith(('backend/', 'extension/', 'src/')) for t in targets))

    def test_tampered_hash_stops(self):
        self.data['files'][0]['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'hash'): validate(self.data)

    def test_traversal_and_git_paths_stop(self):
        for path in ['../config', 'docs/../../.git/config', '.git/config', 'C:/anything', '/tmp/absolute']:
            with self.assertRaises(ValueError): safe(ROOT, path)

    def test_runtime_binary_and_secret_targets_stop(self):
        for target in ['backend/JobSearchAssistant.exe', 'docs/key.env', 'tools/user-settings.cmd', 'docs/test-results/chat.log', 'browser-extension/font.ttf']:
            data = json.loads(json.dumps(self.data))
            # key.env is a source-like file name but not whitelisted as a secret extension;
            # use the exact .env convention guarded by the publisher.
            if target == 'docs/key.env': target = 'docs/.env'
            data['files'][0]['target'] = target
            with self.assertRaises(ValueError): validate(data)

    def test_duplicate_target_stops(self):
        self.data['files'].append(self.data['files'][0])
        with self.assertRaisesRegex(ValueError, 'duplicate'): validate(self.data)

    def test_publisher_checks_exit_codes_and_never_force_resets(self):
        script = (ROOT/'Publish-Violetta-3.8.0.ps1').read_text(encoding='utf-8-sig')
        self.assertIn('$LASTEXITCODE', script)
        self.assertIn("@('diff','--cached','--quiet') -Accepted @(0,1)", script)
        self.assertIn("@('push','origin','HEAD:main')", script)
        self.assertIn("@('merge','--ff-only','origin/main')", script)
        self.assertNotRegex(script, r"@\('(?:reset|clean|stash)'")
        self.assertNotIn("'--force'", script)
        self.assertNotIn("'--force-with-lease'", script)
        self.assertIn('PUBLISHED:', script)
        self.assertIn('ls-remote', script)

    def test_real_git_source_copy_preserves_backend_and_normal_push(self):
        validate(self.data)
        with tempfile.TemporaryDirectory(prefix='violetta-git-plan-') as temp:
            base = Path(temp); repo = base/'repo'; repo.mkdir(); remote = base/'remote.git'
            git(repo, 'init', '-b', 'main')
            git(repo, 'config', 'user.email', 'fixture@example.invalid')
            git(repo, 'config', 'user.name', 'Fixture')
            original = b'// unrelated backend source must survive\n'
            code = repo/'src/JobSearchAssistant/Keep.cs'; code.parent.mkdir(parents=True); code.write_bytes(original)
            note = repo/'user-note.md'; note.write_text('Keep unrelated work\n')
            git(repo, 'add', '--', 'src', 'user-note.md'); git(repo, 'commit', '-m', 'Fixture base')
            git(base, 'init', '--bare', str(remote)); git(repo, 'remote', 'add', 'origin', str(remote)); git(repo, 'push', '-u', 'origin', 'main')
            before = git(repo, 'rev-parse', 'HEAD').stdout.strip()
            paths = []
            for row in self.data['files']:
                dst = safe(repo, row['target']); dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(safe(ROOT, row['source']), dst); paths.append(row['target'])
            for i in range(0, len(paths), 30): git(repo, 'add', '--', *paths[i:i+30])
            self.assertEqual(git(repo, 'diff', '--cached', '--quiet', codes=(0,1)).returncode, 1)
            self.assertEqual(code.read_bytes(), original); self.assertEqual(note.read_text(), 'Keep unrelated work\n')
            tracked = git(repo, 'ls-files').stdout.splitlines()
            self.assertFalse(any(t.startswith('backend/') or t.endswith(('.exe','.dll','.log')) for t in tracked))
            git(repo, 'commit', '-m', 'Fixture source update')
            after = git(repo, 'rev-parse', 'HEAD').stdout.strip()
            self.assertNotEqual(before, after)
            git(repo, 'push', 'origin', 'HEAD:main')
            self.assertEqual(git(repo, 'ls-remote', '--heads', 'origin', 'main').stdout.split()[0], after)
            self.assertEqual(git(repo, 'status', '--porcelain').stdout.strip(), '')
            self.assertEqual(git(repo, 'diff', '--cached', '--quiet', codes=(0,1)).returncode, 0)

if __name__ == '__main__': unittest.main(verbosity=2)
