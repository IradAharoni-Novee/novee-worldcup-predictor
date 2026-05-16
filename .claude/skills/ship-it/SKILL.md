---
name: ship-it
description: Commit all current changes, push the branch to remote, open a pull request with `gh`, and enable auto-merge on the new PR. Use when the user says "ship it", "ship this", or otherwise asks to commit + push + PR + automerge in one shot.
---

# ship-it

Goes from a dirty working tree to a PR with auto-merge enabled in a single flow. Use only when the user explicitly asks to ship / commit+push+PR+automerge. Do not invoke for partial requests (e.g. "just commit", "open a PR for this existing branch").

## Preconditions

Before running any commands, confirm:

1. The current branch is **not** `main` (or whatever the repo's default branch is). If it is, stop and ask the user for a feature branch name; create it with `git checkout -b <name>` before continuing.
2. `gh auth status` succeeds. If not, stop and tell the user to run `gh auth login`.
3. There is something to ship — either uncommitted changes, or unpushed commits ahead of the base branch. If both are empty, stop and report "nothing to ship".

## Steps

Run these in order. Stop and surface any failure to the user — do not paper over errors.

### 1. Inspect state

Run in parallel:

- `git status` (no `-uall`) — see untracked + modified files
- `git diff` and `git diff --staged` — see what will be committed
- `git log <base>..HEAD` and `git diff <base>...HEAD` — see what's already on this branch vs. the base branch (use `main` unless the repo says otherwise)
- `git rev-parse --abbrev-ref HEAD` — current branch name
- `git remote -v` — confirm a remote exists

Review the diff before drafting any commit message. Skip files that look like secrets (`.env`, `*.pem`, credentials) — warn the user if any are staged.

### 2. Commit

If there are uncommitted changes:

- Stage the relevant files **by name** (avoid `git add -A` / `git add .`).
- Write a commit message that follows the repo's existing style (look at `git log` output). Default to conventional-commit style (`type: subject`) if the repo has no clear convention.
- Subject ≤72 chars, imperative mood, focused on the *why*. Add a body only if the change needs justification beyond the subject.
- Use a HEREDOC so formatting is preserved:

  ```bash
  git commit -m "$(cat <<'EOF'
  subject line here

  optional body
  EOF
  )"
  ```

- If a pre-commit hook fails, fix the underlying issue and create a **new** commit. Never `--amend` to bypass and never pass `--no-verify`.

If there are no uncommitted changes but unpushed commits exist, skip to step 3.

### 3. Push

- If the branch has no upstream, push with `-u`: `git push -u origin <branch>`.
- Otherwise: `git push`.
- Never force-push unless the user explicitly asks.

### 4. Open the PR

Check first whether a PR already exists for this branch: `gh pr view --json number,url,state`.

- If a PR exists and is open, skip creation and reuse it for step 5.
- If no PR exists, create one:

  ```bash
  gh pr create --title "<subject>" --body "$(cat <<'EOF'
  ## Summary
  - <1-3 bullets describing what changed and why>

  ## Test plan
  - [ ] <how to verify>
  EOF
  )"
  ```

  Title ≤70 chars. Summary should describe what's in the diff — no discarded approaches, no superlatives ("critical", "comprehensive", "robust"). Base branch defaults to the repo default; pass `--base` only if the user specified one.

### 5. Enable auto-merge

```bash
gh pr merge --auto --squash
```

- Default to `--squash`. If the repo's `.github/` config or recent merge history shows a different strategy (merge commit or rebase), match it instead.
- If the command fails because auto-merge is not enabled on the repo, surface the exact `gh` error to the user and stop — do not attempt to enable repo settings on their behalf.
- If the PR is already mergeable and auto-merge would merge immediately, that's expected; let it happen.

### 6. Report

Print a one-line summary with the PR URL and the merge strategy used. Example:

> Shipped: <PR URL> — auto-merge (squash) enabled.

## Guardrails

- Never push to `main`/`master` directly.
- Never `git commit --amend` on a commit that has already been pushed.
- Never use `--no-verify` or `--no-gpg-sign` to bypass hooks/signing.
- Never run `git add -A`, `git add .`, or commit files that look like secrets.
- If anything in steps 2–5 fails, stop and report the error verbatim. Do not retry destructively.
