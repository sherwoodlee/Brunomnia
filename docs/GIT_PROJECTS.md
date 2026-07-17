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
2. Save editor state to YAML, inspect the working or staged diff, and select files to stage or unstage.
3. Commit with the repository identity or optional per-commit author name/email.
4. Create and switch local branches, configure a remote, pull, push, or merge another local branch.

Brunomnia invokes the installed `git` executable directly with an argument array; it never constructs a shell command from repository values. Remote credentials remain the responsibility of Git's configured credential helper or SSH agent.

## Conflicts and recovery

Text conflicts show the base, ours, and theirs versions next to an editable resolution. Binary conflicts offer complete **Use ours** and **Use theirs** choices, including deleted-side conflicts. A resolved file is staged explicitly. **Abort merge** delegates to `git merge --abort` and does not invent a replacement workspace.

Pulls, branch switches, clean merges, and final conflict resolutions reload managed YAML into the editor. Autosave is debounced and reports failures in the status bar. Project writes reject managed symlinks, use unique create-only temporary files, flush before replacement, and refuse paths that canonicalize outside the chosen project root.

The `.git` directory is standard and remains usable from a terminal or another Git client. Commit history browsing, rebase/cherry-pick, provider-specific onboarding, automatic project discovery, and cross-device collaboration are still tracked in [the parity ledger](PARITY.md).
