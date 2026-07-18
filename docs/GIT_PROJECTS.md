# Filesystem and Git projects

Brunomnia desktop can keep the shareable parts of a workspace in an ordinary folder or Git repository. There is no hosted account, proprietary repository service, or paid sync gate.

## Project layout

```text
project/
├── .brunomnia/
│   ├── project.yaml
│   └── manifest.yaml
├── collections/
├── environments/
├── designs/
└── mocks/
```

Resource file names combine a readable slug with a stable ID hash. The manifest records only files Brunomnia owns. Saving may update or remove those managed files, but it does not delete README files, source code, CI configuration, custom tests, or other unrelated repository content.

History, response bodies, cookies, runner reports, installed plugin source/data, and UI state remain in local application storage rather than the shareable project. Environment values are currently ordinary YAML project data: do not commit secrets. OS credential storage and external-vault adapters are a later parity milestone.

## Workflow

Open **Git Sync** in the desktop app to:

1. Open or create a split-YAML folder, initialize Git, or clone an existing repository.
2. Save editor state to YAML, inspect all or one working/staged diff, and stage or unstage selected files or every eligible file.
3. Commit with the repository identity or optional per-commit author name/email, with an optional immediate push.
4. Browse the 35 most recent commits, including message, author, date, parent IDs, local decorations, file statistics, and the bounded patch for a selected commit.
5. Create, switch, or safely delete local branches; fetch/prune configured remotes; turn a remote-only branch into a local tracking branch; pull, push, or merge another local branch.

Brunomnia invokes the installed `git` executable directly with an argument array; it never constructs a shell command from repository values. Remote credentials remain the responsibility of Git's configured credential helper or SSH agent.

The diff file selector follows the active **Unstaged** or **Staged** mode. Tracked files use Git's index-aware unified diff. Untracked UTF-8 text receives a bounded direct preview; binary/symlink/unreadable files fail explicitly, and files above the 2 MB text cap show a size notice. Every selected path must be a safe current repository change.

**Stage selected**, **Unstage selected**, **Stage all**, and **Unstage all** operate only on the eligible, non-conflicted files shown by current status. Staging remains subject to the plaintext-secret policy; conflicts continue through the dedicated resolution workflow. **Commit and push** first asks the installed Git client to read the configured remote refs, then creates the local commit, refreshes status, and pushes the new branch tip. An inaccessible or unauthenticated remote therefore stops before commit. If a later push race or write-side policy rejects the push, Brunomnia reports that the commit exists locally and does not claim or attempt a rollback.

AI commit suggestions remain reviewable file/message cards. **Commit AI groups** first validates at most eight non-empty groups against current, non-conflicted status and rejects stale or duplicate file assignment. It then unstages the current index and creates the groups in displayed order by staging only that group's files. **Commit groups + push** performs the same remote-access preflight first and pushes only after every group succeeds. Files omitted by the reviewed plan remain unstaged.

Grouped commits are intentionally sequential rather than transactional. If a later stage or commit fails, Brunomnia refreshes status and reports exactly how many earlier groups became commits; it does not rewrite those commits. A later push failure likewise leaves every completed local commit available for retry.

**Discard selected unstaged** and **Discard all unstaged** permanently restore tracked working-tree files to their index versions and remove selected untracked files. Staged changes remain staged. Discard refuses staged-only paths, paths outside the repository, and every file while a merge/rebase/conflict is active. When **Confirm destructive actions** is enabled, Brunomnia asks for confirmation before invoking Git, then reloads managed YAML after success.

History reads the current local `HEAD`; opening it never fetches or changes the repository. A history request is capped at 100 entries and the UI requests 35. Selected patches retain the native 2 MB text-output cap. Patch lookup accepts only the full hexadecimal identifier returned by the history command, so branch names and arbitrary revision expressions cannot cross that boundary.

Git status also reports whether the current branch has a tip ready to push. A tracked branch is ready when it is ahead of its upstream; a committed branch without an upstream is shown as **Unpublished branch** when at least one remote exists. The standalone **Push** action is disabled for detached/unborn heads, missing configured remotes, equal/behind-only tracked branches, and otherwise empty push state. Commit-and-push controls remain available because their commit step creates new work before push.

Push failures classify common native Git evidence before reaching the workbench. Non-fast-forward/fetch-first rejection tells the user to pull and resolve remote changes; authentication, SSH key, HTTP 401/403, and write-access failures point to the installed credential helper or SSH agent; missing repositories distinguish absent/inaccessible remotes. Unknown failures retain bounded Git details. No classifier retries, force-pushes, rewrites the local tip, or hides a successfully created commit.

## Remote branches

**Fetch and prune branches** refreshes the configured remote's branch refs without downloading tags. Remote-only branches then appear separately from local branches. **Fetch + checkout** refreshes the selected branch again, verifies the exact remote-tracking ref, creates a same-named local branch with upstream tracking, and reloads the project YAML from that checkout. Existing local branches remain in the local selector instead of being duplicated in the remote list.

Fetch and checkout use the installed Git client's credential helper or SSH agent. Brunomnia does not store a provider token in the project and does not place an account or subscription gate in front of the workflow. Git itself blocks a checkout that would overwrite uncommitted work, and the error is shown in the workbench.

The commit-and-push preflight runs `git ls-remote --heads` through the same installed credential path without changing refs or files. This proves that the named remote is reachable and that any access required to list its heads works. A public remote may allow that query anonymously, so it does not prove a stored token is valid; nor can it prove write permission, branch-protection acceptance, fast-forward eligibility, or that the remote will remain available between preflight and push. Those later failures preserve the new local commit for retry.

Local branch deletion never targets the current branch and uses `git branch -d`, so Git refuses to discard an unmerged branch. When **Confirm destructive actions** is enabled, Brunomnia also asks for confirmation before invoking Git. This baseline deliberately does not expose force deletion.

## Conflicts and recovery

Text conflicts show the base, ours, and theirs versions next to an editable resolution. Binary conflicts offer complete **Use ours** and **Use theirs** choices, including deleted-side conflicts. A resolved file is staged explicitly. **Abort merge** delegates to `git merge --abort` and does not invent a replacement workspace.

Starting a branch merge requires a clean index and working tree. Brunomnia checks status before invoking `git merge`, refuses staged, unstaged, untracked, merge-in-progress, and rebase-in-progress states, and leaves those files untouched. Commit or discard the existing work first; ahead/behind commits alone do not block a merge.

Pulls, branch switches, clean merges, and final conflict resolutions reload managed YAML into the editor. Autosave is debounced and reports failures in the status bar. Project writes reject managed symlinks, use unique create-only temporary files, flush before replacement, and refuse paths that canonicalize outside the chosen project root.

The `.git` directory is standard and remains usable from a terminal or another Git client. Force/local-remote branch deletion, rebase/cherry-pick, provider-specific onboarding, automatic project discovery, un-checked-out remote history, and cross-device collaboration are still tracked in [the parity ledger](PARITY.md).
