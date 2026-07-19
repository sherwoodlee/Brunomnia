# Milestone 221 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: correct the Git parity ledger against the pinned standard Insomnia Git surface, removing operations that the reference does not expose while retaining confirmed provider and repository-discovery gaps. This milestone changes documentation only; it adds no product behavior and closes no parity row.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/src/main/git-service.ts` defines the standard Git route/actions. `pushToGitRemoteAction` marks its `force` input as never used and calls `GitVCS.push(credentialsId)` without forwarding it. The standard Git UI calls the action only with `force: false`, so force push is not a user-facing requirement.
- `deleteGitBranchAction` accepts a local branch name and delegates to `GitVCS.deleteBranch`. `packages/insomnia/src/sync/git/git-vcs.ts` implements that call with local `git.deleteBranch`; there is no forced-local or remote-branch deletion action.
- The production source has no cherry-pick operation. Its only rebase references read Git metadata so an externally started rebase can retain the original branch identity; no rebase route or action is exposed.
- `gitLogLoader` accepts only project/workspace identity and calls `GitVCS.log({ depth: 35 })`. That method performs a bounded single-branch fetch and `git.log` without a caller-supplied ref, so arbitrary un-checked-out remote-history browsing is not exposed.
- Confirmed upstream capabilities still absent from Brunomnia are provider-specific OAuth/PAT onboarding, provider credential validation, guided provider-repository listing/selection, and automatic repository discovery. The pinned service exposes provider sign-in/completion, credential validation, and provider repository fetching for those flows.

## Reproducible evidence

Set `INSOMNIA_PIN` to a clean checkout of the pinned commit, then run:

```sh
git -C "$INSOMNIA_PIN" rev-parse HEAD
rg -n "pushToGitRemoteAction|Force is never used|GitVCS\.push|deleteGitBranchAction|GitVCS\.deleteBranch|gitLogLoader|GitVCS\.log" "$INSOMNIA_PIN/packages/insomnia/src/main/git-service.ts"
rg -n "async push|async deleteBranch|async log|git\.deleteBranch|git\.log|singleBranch" "$INSOMNIA_PIN/packages/insomnia/src/sync/git/git-vcs.ts"
rg -n "handlePush\(\{ force:" "$INSOMNIA_PIN/packages/insomnia/src/ui/components/dropdowns/git-project-sync-dropdown.tsx"
rg -n "rebase|cherry-pick|cherryPick" "$INSOMNIA_PIN/packages/insomnia/src" --glob '!**/*.test.*' --glob '!**/*.spec.*'
rg -n "validateGitCredentials|validateGitCredentialById|initSignInToGitProvider|completeSignInToGitProvider|getGitProviderRepositories" "$INSOMNIA_PIN/packages/insomnia/src/main/git-service.ts"
```

Expected evidence is the exact pinned hash; a never-forwarded force parameter and only `force: false` UI calls; local-only deletion; a project-scoped, bounded single-branch log; rebase metadata reads but no rebase/cherry-pick action; and concrete provider authentication, validation, and repository-listing handlers.

## Validation

| Gate | Result |
| --- | --- |
| Pinned checkout identity | Passed: exact commit `5143b4103030f45293c67b96f4a780398c511d75` |
| Standard Git production-source scan | Passed: no user-facing force push, forced/remote deletion, rebase, cherry-pick, or arbitrary-ref history route |
| Confirmed-gap source scan | Passed: provider sign-in/completion, credential validation, and provider repository listing remain upstream capabilities |
| Parity-row count | Passed: exactly 19 rows remain incomplete |
| Changed-path whitespace check | Passed |

No application test/build gate was repeated because no executable, dependency, fixture, or configuration file changed. The previous Milestone 220 full validation remains the latest product-code gate.

## Acceptance boundary

Milestone 221 corrects false requirements; it does not implement a feature or claim a row complete. Git Sync stays `Baseline`, exactly 19 parity rows remain incomplete, and Brunomnia is not feature-complete. Provider-specific authentication, guided repository onboarding/listing, credential validation, and automatic repository discovery remain open.
