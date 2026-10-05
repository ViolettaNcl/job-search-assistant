# Backup / Recovery

## Export

Product Center → Резервные копии → пароль не менее 12 символов → Скачать .vja.

Included: known permanent profile/CV/application/questionnaire/vacancy/learning/preferences/model families. Unknown keys, session storage, writing-provider credentials, cookies and pending execution commands are omitted. Known structured secret keys are recursively stripped, but free-form text is not guaranteed PII-free.

Encryption: random 16-byte salt, PBKDF2-SHA256 310000 iterations, AES-256-GCM, fresh 12-byte nonce. Passwords are not stored by the application. Keep password and export separately. There is no password recovery.

## Local checkpoints

«Сохранить в локальный vault» stores only an encrypted envelope in extension-origin IndexedDB. These are not external backups and may disappear on extension uninstall/profile deletion. Download important checkpoints as .vja.

## Restore

Choose file and password, press «Проверить файл», review the key/conflict counts, then confirm. A changed local state invalidates the preview. A pre-restore encrypted checkpoint is created first. Imported data is parsed/allowlisted/size-checked. Unknown schema versions and dangerous object keys are rejected.

Restored jobs are review-only with no tab binding and automatic=false. Active models are cleared. External AI consent is reset. No final submit is sent. Unknown unrelated local keys are preserved; restore is a merge of listed known keys, not a wipe of the browser.

## Limits

32 MiB plaintext / 48 MiB encoded file limit. Active Chrome local storage, backend files and credentials outside the known extension families are not part of a complete system-image backup. This is encrypted backup storage, not encryption of all live operational data.

Native IndexedDB/extension lifecycle must be verified on the user's Chrome; sandbox tests cannot certify it.
