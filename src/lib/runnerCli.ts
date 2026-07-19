export type RunnerCliCommandOptions = {
  workspacePath: string;
  collectionId: string;
  environmentId: string;
  requestIds: string[];
  iterations: number;
  retries: number;
  delayMs: number;
  dataPath?: string;
  bail: boolean;
};

const shellSafeToken = /^[A-Za-z0-9_@%+=:,./-]+$/;

export const quotePosixShellArgument = (value: string) => {
  if (value && shellSafeToken.test(value)) return value;
  return `'${value.replace(/'/g, `'"'"'`)}'`;
};

export const applyRunnerEnvironmentOverrides = (rows: Record<string, string>[], values: string[]) => {
  if (!values.length) return rows;
  const overrides = values.reduce<Record<string, string>>((current, value) => ({
    ...current,
    ...Object.fromEntries(new URLSearchParams(value).entries()),
  }), {});
  return (rows.length ? rows : [{}]).map((row) => ({ ...row, ...overrides }));
};

const boundedInteger = (value: number, minimum: number, maximum: number) => {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
};

export const buildRunnerCliCommand = (options: RunnerCliCommandOptions) => {
  const command = [
    'brunomnia',
    'run',
    'collection',
    options.workspacePath,
    options.collectionId,
    '--env',
    options.environmentId,
  ];
  options.requestIds.forEach((requestId) => command.push('--request', requestId));
  const iterations = boundedInteger(options.iterations, 1, 1_000);
  const retries = boundedInteger(options.retries, 0, 10);
  const delayMs = boundedInteger(options.delayMs, 0, 30_000);
  if (iterations > 1) command.push('--iterations', String(iterations));
  if (retries > 0) command.push('--retries', String(retries));
  if (delayMs > 0) command.push('--delay-request', String(delayMs));
  if (options.dataPath) command.push('--data', options.dataPath);
  if (options.bail) command.push('--bail');
  return command.map(quotePosixShellArgument).join(' ');
};
