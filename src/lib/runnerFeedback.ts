import type { RunnerLiveItem } from '../types';

const RESPONSE_CODE_REASONS: Record<number, string> = {
  100: 'Continue',
  101: 'Switching Protocols',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  207: 'Multi-Status',
  208: 'Already Reported',
  226: 'IM Used',
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  306: 'Switch Proxy',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Payload Too Large',
  414: 'URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable',
  417: 'Expectation Failed',
  418: "I'm a Teapot",
  421: 'Misdirected Request',
  422: 'Unprocessable Entity',
  423: 'Locked',
  424: 'Failed Dependency',
  425: 'Too Early',
  426: 'Upgrade Required',
  428: 'Precondition Required',
  429: 'Too Many Requests',
  431: 'Request Header Fields Too Large',
  451: 'Unavailable For Legal Reasons',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
  506: 'Variant Also Negotiates',
  507: 'Insufficient Storage',
  508: 'Loop Detected',
  509: 'Bandwidth Limit Exceeded',
  510: 'Not Extended',
  511: 'Network Authentication Required',
  598: 'Network read timeout error',
  599: 'Network Connect Timeout Error',
};

export type RunnerStatusTone = 'pending' | 'running' | 'canceled' | 'skipped' | 'http-success' | 'http-warning' | 'http-error';

const describeRunnerByteSize = (bytes: number) => {
  const roundedBytes = Math.round(bytes * 10) / 10;
  let size = roundedBytes;
  let unit = 'bytes';
  if (roundedBytes >= 1024 * 1024 * 1024 * 2) {
    size = roundedBytes / 1024 / 1024 / 1024;
    unit = 'gigabytes';
  } else if (roundedBytes >= 1024 * 1024 * 2) {
    size = roundedBytes / 1024 / 1024;
    unit = 'megabytes';
  } else if (roundedBytes >= 1024 * 2) {
    size = roundedBytes / 1024;
    unit = 'kilobytes';
  }
  return `${Math.round(size * 10) / 10} ${unit}`;
};

export const formatRunnerStatusLabel = ({ statusCode, statusMessage }: Pick<RunnerLiveItem, 'statusCode' | 'statusMessage'>) => {
  if (statusCode && statusCode > 0) {
    const reason = statusMessage || RESPONSE_CODE_REASONS[statusCode] || '';
    return reason ? `${statusCode} ${reason}` : `${statusCode}`;
  }
  return statusMessage || '';
};

export const formatRunnerResponseStats = ({ responseTime, responseSize }: Pick<RunnerLiveItem, 'responseTime' | 'responseSize'>) => [
  typeof responseTime === 'number' && responseTime >= 0 ? `${Math.round(responseTime)}ms` : null,
  typeof responseSize === 'number' && responseSize >= 0 ? describeRunnerByteSize(responseSize) : null,
].filter(Boolean).join(' - ');

const FIXED_STATUS_TAGS: Partial<Record<RunnerLiveItem['status'], { label: string; tone: RunnerStatusTone }>> = {
  pending: { label: 'PENDING', tone: 'pending' },
  running: { label: 'RUNNING', tone: 'running' },
  canceled: { label: 'CANCELED', tone: 'canceled' },
  skipped: { label: 'SKIPPED', tone: 'skipped' },
};

export const getRunnerStatusTag = (item: Pick<RunnerLiveItem, 'status' | 'statusCode' | 'statusMessage'>): { label: string; tone: RunnerStatusTone } => {
  const fixed = FIXED_STATUS_TAGS[item.status];
  if (fixed) return fixed;
  const label = formatRunnerStatusLabel(item);
  if (!label) return { label: 'ERROR', tone: 'http-error' };
  const code = item.statusCode ?? 0;
  const tone = code >= 200 && code < 300 ? 'http-success' : code >= 300 && code < 400 ? 'http-warning' : 'http-error';
  return { label, tone };
};

export const isRunnerItemFinished = (status: RunnerLiveItem['status']) => status === 'completed' || status === 'failed' || status === 'canceled' || status === 'skipped';

export const summarizeRunnerLiveProgress = (items: RunnerLiveItem[], isRunning: boolean) => {
  const total = items.length;
  const skipped = items.filter((item) => item.status === 'skipped').length;
  const canceled = items.filter((item) => item.status === 'canceled').length;
  const finished = items.filter((item) => isRunnerItemFinished(item.status)).length - skipped - canceled;
  return { total, finished, skipped, canceled, label: `${isRunning ? 'Running' : 'Finished'} ${finished} / ${total} requests (${skipped} skipped, ${canceled} canceled)` };
};
