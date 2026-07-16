# Contributing

Thank you for helping PocketTrainer make movement coaching safer and more accessible.

## Before opening a change

1. Keep the Android-first MVP scope focused on movement coaching and course progression.
2. Discuss changes to exercise thresholds with a qualified fitness reviewer.
3. Never add raw-frame or raw-landmark uploads.
4. Do not place product data in Supabase; it owns identity only.

## Development workflow

```bash
pnpm install
pnpm check
```

Use Conventional Commits:

```text
feat(mobile): add assessment calibration flow
fix(domain): prevent unlock after low-confidence session
docs(demo): update offline sync walkthrough
```

Open a focused pull request and complete the template. UI changes require a screenshot or screen recording, accessibility notes, and the page-review checklist. Movement-rule changes require golden-test evidence and fitness-review status.

## Definition of done

- Type checks, tests, lint, and affected builds pass.
- User-owned data remains tenant-isolated.
- Offline mutations remain idempotent.
- No raw workout media or landmarks enter logs, analytics, or network payloads.
- New UI has 48dp targets, TalkBack labels, scalable text, and non-color state cues.
- Documentation and `CHANGELOG.md` reflect notable behavior changes.
