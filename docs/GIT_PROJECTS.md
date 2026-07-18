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
2. Save editor state to YAML, inspect all or one working/staged diff, and select files to stage or unstage.
3. Commit with the repository identity or optional per-commit author name/email.
4. Browse the 35 most recent commits, including message, author, date, parent IDs, local decorations, file statistics, and the bounded patch for a selected commit.
5. Create, switch, or safely delete local branches; fetch/prune configured remotes; turn a remote-only branch into a local tracking branch; pull, push, or merge another local branch.

Brunomnia invokes the installed `git` executable directly with an argument array; it never constructs a shell command from repository values. Remote credentials remain the responsibility of Git's configured credential helper or SSH agent.

The diff file selector follows the active **Unstaged** or **Staged** mode. Tracked files use Git's index-aware unified diff. Untracked UTF-8 text receives a bounded direct preview; binary/symlink/unreadable files fail explicitly, and files above the 2 MB text cap show a size notice. Every selected path must be a safe current repository change.

**Discard selected unstaged** and **Discard all unstaged** permanently restore tracked working-tree files to their index versions and remove selected untracked files. Staged changes remain staged. Discard refuses staged-only paths, paths outside the repository, and every file while a merge/rebase/conflict is active. When **Confirm destructive actions** is enabled, Brunomnia asks for confirmation before invoking Git, then reloads managed YAML after success.

History reads the current local `HEAD`; opening it never fetches or changes the repository. A history request is capped at 100 entries and the UI requests 35. Selected patches retain the native 2 MB text-output cap. Patch lookup accepts only the full hexadecimal identifier returned by the history command, so branch names and arbitrary revision expressions cannot cross that boundary.

## Remote branches

**Fetch and prune branches** refreshes the configured remote's branch refs without downloading tags. Remote-only branches then appear separately from local branches. **Fetch + checkout** refreshes the selected branch again, verifies the exact remote-tracking ref, creates a same-named local branch with upstream tracking, and reloads the project YAML from that checkout. Existing local branches remain in the local selector instead of being duplicated in the remote list.

Fetch and checkout use the installed Git client's credential helper or SSH agent. Brunomnia does not store a provider token in the project and does not place an account or subscription gate in front of the workflow. Git itself blocks a checkout that would overwrite uncommitted work, and the error is shown in the workbench.

Local branch deletion never targets the current branch and uses `git branch -d`, so Git refuses to discard an unmerged branch. When **Confirm destructive actions** is enabled, Brunomnia also asks for confirmation before invoking Git. This baseline deliberately does not expose force deletion.

## Conflicts and recovery

Text conflicts show the base, ours, and theirs versions next to an editable resolution. Binary conflicts offer complete **Use ours** and **Use theirs** choices, including deleted-side conflicts. A resolved file is staged explicitly. **Abort merge** delegates to `git merge --abort` and does not invent a replacement workspace.

Pulls, branch switches, clean merges, and final conflict resolutions reload managed YAML into the editor. Autosave is debounced and reports failures in the status bar. Project writes reject managed symlinks, use unique create-only temporary files, flush before replacement, and refuse paths that canonicalize outside the chosen project root.

The `.git` directory is standard and remains usable from a terminal or another Git client. Force/local-remote branch deletion, rebase/cherry-pick, provider-specific onboarding, automatic project discovery, un-checked-out remote history, and cross-device collaboration are still tracked in [the parity ledger](PARITY.md).
