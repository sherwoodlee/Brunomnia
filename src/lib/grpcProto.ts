import type { GrpcProtoFile } from '../types';

export const GRPC_PROTO_MAX_FILES = 500;
export const GRPC_PROTO_MAX_FILE_BYTES = 1_048_576;
export const GRPC_PROTO_MAX_TOTAL_BYTES = 10_485_760;
export const GRPC_PROTO_MAX_PATH_LENGTH = 512;

export type GrpcProtoTree = {
  protoFiles: GrpcProtoFile[];
  protoEntryPath: string;
  protoActivePath: string;
  protoText: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const byteLength = (value: string) => encoder.encode(value).byteLength;
const truncateBytes = (value: string, limit: number) => {
  const bytes = encoder.encode(value);
  if (bytes.byteLength <= limit) return value;
  let end = limit;
  let truncated = decoder.decode(bytes.slice(0, end));
  while (byteLength(truncated) > limit && end > 0) truncated = decoder.decode(bytes.slice(0, --end));
  return truncated;
};

export const normalizeGrpcProtoPath = (value: string): string => {
  const path = value.trim().replaceAll('\\', '/').replace(/\/+/g, '/');
  if (!path || path.startsWith('/') || /^[a-z]:\//i.test(path)) throw new Error('Proto paths must be relative.');
  const segments = path.split('/').filter((segment) => segment !== '.');
  if (!segments.length || segments.some((segment) => !segment || segment === '..')) throw new Error('Proto paths cannot traverse parent folders.');
  const normalized = segments.join('/');
  if (normalized.length > GRPC_PROTO_MAX_PATH_LENGTH) throw new Error(`Proto paths cannot exceed ${GRPC_PROTO_MAX_PATH_LENGTH} characters.`);
  if (!normalized.toLowerCase().endsWith('.proto')) throw new Error('Only .proto files can be imported.');
  return normalized;
};

const entryPath = (files: GrpcProtoFile[], preferred = '') => {
  if (files.some((file) => file.path === preferred)) return preferred;
  return [...files].sort((left, right) => {
    const serviceDifference = Number(!/\bservice\s+[A-Za-z_]\w*/.test(left.text)) - Number(!/\bservice\s+[A-Za-z_]\w*/.test(right.text));
    return serviceDifference || left.path.length - right.path.length || left.path.localeCompare(right.path);
  })[0]?.path ?? '';
};

export const normalizeGrpcProtoTree = (
  value: unknown,
  legacyProtoText = '',
  preferredEntryPath = '',
  preferredActivePath = '',
): GrpcProtoTree => {
  const files: GrpcProtoFile[] = [];
  const paths = new Set<string>();
  let totalBytes = 0;
  for (const [index, candidate] of (Array.isArray(value) ? value : []).slice(0, GRPC_PROTO_MAX_FILES).entries()) {
    if (!candidate || typeof candidate !== 'object') continue;
    const record = candidate as Record<string, unknown>;
    if (typeof record.path !== 'string' || typeof record.text !== 'string') continue;
    let path: string;
    try {
      path = normalizeGrpcProtoPath(record.path);
    } catch {
      continue;
    }
    const identity = path.toLowerCase();
    if (paths.has(identity) || totalBytes >= GRPC_PROTO_MAX_TOTAL_BYTES) continue;
    const text = truncateBytes(record.text, Math.min(GRPC_PROTO_MAX_FILE_BYTES, GRPC_PROTO_MAX_TOTAL_BYTES - totalBytes));
    paths.add(identity);
    totalBytes += byteLength(text);
    files.push({
      id: typeof record.id === 'string' && record.id.trim() ? record.id.slice(0, 256) : `grpc-proto-file-${index}`,
      path,
      text,
    });
  }
  if (!files.length && legacyProtoText) {
    files.push({ id: 'grpc-proto-file-0', path: 'schema.proto', text: truncateBytes(legacyProtoText, GRPC_PROTO_MAX_FILE_BYTES) });
  }
  const protoEntryPath = entryPath(files, preferredEntryPath);
  const protoActivePath = files.some((file) => file.path === preferredActivePath) ? preferredActivePath : protoEntryPath;
  return {
    protoFiles: files,
    protoEntryPath,
    protoActivePath,
    protoText: files.find((file) => file.path === protoEntryPath)?.text ?? truncateBytes(legacyProtoText, GRPC_PROTO_MAX_FILE_BYTES),
  };
};

export const grpcProtoSource = (tree: Pick<GrpcProtoTree, 'protoFiles' | 'protoText'>) => (
  tree.protoFiles.length ? tree.protoFiles.map((file) => file.text).join('\n\n') : tree.protoText
);
