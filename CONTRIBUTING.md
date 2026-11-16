# Contributing to pikvm_mcp_server

Thanks for your interest. This server gives an MCP client keyboard, mouse and screen access to a physical machine via PiKVM, so changes are reviewed with security in mind.

## Before you start

- **Small fix or docs change:** open a PR directly.
- **New tool, behaviour change, or anything over ~200 lines:** open an issue first so we can agree on scope before you spend time on it.
- **Security vulnerability:** do not open a public issue or PR. See [SECURITY.md](SECURITY.md).

## Workflow

1. Fork the repo and branch from `main` (`fix/short-description` or `feat/short-description`).
2. Keep PRs to one purpose. Unrelated cleanups go in a separate PR.
3. Build and test locally (Node.js 18 or later):

   ```bash
   npm ci              # install exact dependency versions from package-lock.json
   npm run typecheck   # tsc --noEmit
   npm run build       # compiles src/ to dist/
   ```

   `npm run dev` runs the server from source with `tsx watch`. To try it against a PiKVM, copy `.env.example` to `.env` and fill in your own device's details. Never commit `.env`; it's gitignored.

   There's no automated test suite yet, so test changes to the tools by hand against a real PiKVM and say in the PR what you checked. If you add tests, add an `npm test` script for them.
4. If you add or change a tool or skill, keep these in sync:
   - the tool definition in `src/index.ts`, or the prompt in `src/prompts/`
   - the matching guide in `docs/skills/`
   - the tool and skill lists in `README.md` and `AGENTS.md`, including the totals
5. Open the PR against `main` and fill in the template.

## Sign-off (DCO)

Contributions are licensed under GPL-3.0, the same as the project. Sign off every commit to certify the [Developer Certificate of Origin](https://developercertificate.org/):

```
git commit -s -m "your message"
```

PRs with unsigned commits will be asked to amend.

## Review expectations

- First response within a few days. Ping the PR if it has been a week.
- `main` is protected: every change goes through a PR and needs one approving review before it's merged.
- Changes touching input handling, authentication, TLS verification, credential storage, the calibration path, `AGENTS.md` or any skill files get line-by-line security review and may take longer.
- Commits are kept with their original authorship (merge or rebase, not hand-copied).
- We may decline a PR that doesn't fit the project's direction. We'll say why.
- Please keep "Allow edits from maintainers" enabled so we can make small fixes.

## Code of conduct

Be respectful and assume good faith. Critique the code, not the person. Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
