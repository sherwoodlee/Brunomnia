export type GitCommitPlanGroup = { message: string; files: string[] };

export const validateGitCommitPlan = (groups: GitCommitPlanGroup[], currentFiles: string[]) => {
  if (!groups.length) throw new Error('Generate at least one commit group first.');
  if (groups.length > 8) throw new Error('A grouped commit plan can contain at most 8 commits.');
  const allowed = new Set(currentFiles);
  const assigned = new Set<string>();
  return groups.map((group, index) => {
    const message = group.message.trim();
    if (!message) throw new Error(`Commit group ${index + 1} needs a message.`);
    if (message.length > 200) throw new Error(`Commit group ${index + 1} exceeds the 200-character message limit.`);
    if (!group.files.length) throw new Error(`Commit group ${index + 1} needs at least one file.`);
    const files = group.files.map((file) => {
      if (!allowed.has(file)) throw new Error(`Commit group ${index + 1} contains stale or conflicted file '${file}'.`);
      if (assigned.has(file)) throw new Error(`File '${file}' appears in more than one commit group.`);
      assigned.add(file);
      return file;
    });
    return { message, files };
  });
};
