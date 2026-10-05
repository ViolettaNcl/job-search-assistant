"""Explicit label provenance attestation, not automatic verification of user history."""
def require_real_labels(rows, confirmed=False, test_only=False):
    if test_only:
        return False
    if not confirmed:
        raise SystemExit('Real-label provenance must be reviewed: supply --confirm-real-labels, or use test-only mode.')
    for row in rows:
        if row.get('synthetic') is True or row.get('testOnly') is True or any(
            token in str(row.get(key, '')).lower()
            for key in ('source', 'provenance', 'labelSource')
            for token in ('synthetic', 'fixture', 'test-only')
        ):
            raise SystemExit('Synthetic/test labels cannot be attested as production training data.')
    return True
