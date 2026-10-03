"""Focused 3.9.10 service-worker regression for HH full-vacancy acquisition."""
from pathlib import Path
import json, subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    proc = subprocess.Popen(
        ['node', str(ROOT / 'tests' / 'worker-bridge.cjs')],
        cwd=ROOT,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )
    seq = 0
    passed = []

    def call(op, **kwargs):
        nonlocal seq
        seq += 1
        payload = {'id': seq, 'op': op, **kwargs}
        proc.stdin.write(json.dumps(payload, ensure_ascii=False) + '\n')
        proc.stdin.flush()
        line = proc.stdout.readline()
        if not line:
            raise RuntimeError(proc.stderr.read())
        result = json.loads(line)
        if result.get('error'):
            raise RuntimeError(result['error'])
        return result.get('result')

    def check(label, condition):
        if not condition:
            raise AssertionError(label)
        passed.append(label)
        print('PASS', label, flush=True)

    try:
        readable = call(
            'eval',
            code="cpReadVacancy('https://hh.ru/vacancy/785',{url:'https://hh.ru/search/vacancy'},{fast:true})",
        )
        check(
            'interactive hidden HH tab is readable before tab.status becomes complete',
            readable.get('vacancyId') == '785' and readable.get('descriptionCoverage') == 'full-dom',
        )

        fallback = call(
            'eval',
            code="cpCompleteVacancy({url:'https://hh.ru/vacancy/784',vacancyId:'784',title:'Специалист технической поддержки / Support L1',description:'snippet',descriptionCoverage:'snippet'},{url:'https://hh.ru/search/vacancy'},{embedded:true})",
        )
        check(
            'letter preparation falls back to exact api.hh.ru vacancy data',
            fallback.get('vacancyId') == '784'
            and fallback.get('descriptionCoverage') == 'full-fetch'
            and 'Телефонные звонки не требуются' in fallback.get('description', ''),
        )

        analysis = call(
            'eval',
            code="cpQuickListCallAnalysis({url:'https://hh.ru/vacancy/784',vacancyId:'784',title:'Специалист технической поддержки / Support L1',description:'snippet',descriptionCoverage:'snippet'},{tab:{id:7},frameId:0,url:'https://hh.ru/search/vacancy'})",
        )
        check(
            'Analysis uses HH API fallback and returns confirmed no-calls state',
            analysis.get('source') == 'hh-api'
            and analysis.get('status') == 'no-calls'
            and analysis.get('canApply') is True,
        )
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()

    print(f'{len(passed)} focused 3.9.10 HH reader assertions passed.', flush=True)


if __name__ == '__main__':
    main()
