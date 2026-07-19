import {
  GRPC_PROTO_MAX_FILE_BYTES,
  GRPC_PROTO_MAX_FILES,
  GRPC_PROTO_MAX_TOTAL_BYTES,
  normalizeGrpcProtoPath,
  normalizeGrpcProtoTree,
  type GrpcProtoTree,
} from './grpcProto';

const relativeFilePath = (file: File) => file.webkitRelativePath || file.name;

export const importGrpcProtoFiles = async (input: FileList | File[]): Promise<GrpcProtoTree> => {
  const selected = Array.from(input);
  if (!selected.length) throw new Error('Choose at least one .proto file.');
  if (selected.length > GRPC_PROTO_MAX_FILES) throw new Error(`Proto trees cannot exceed ${GRPC_PROTO_MAX_FILES} files.`);
  if (selected.some((file) => file.size > GRPC_PROTO_MAX_FILE_BYTES)) throw new Error('Each proto file must be 1 MiB or smaller.');
  if (selected.reduce((total, file) => total + file.size, 0) > GRPC_PROTO_MAX_TOTAL_BYTES) throw new Error('Proto trees cannot exceed 10 MiB.');

  const rawPaths = selected.map(relativeFilePath);
  const firstSegments = rawPaths.map((path) => path.replaceAll('\\', '/').split('/'));
  const stripRoot = firstSegments.every((segments) => segments.length > 1 && segments[0] === firstSegments[0][0]);
  const records = await Promise.all(selected.map(async (file, index) => ({
    id: crypto.randomUUID(),
    path: stripRoot ? firstSegments[index].slice(1).join('/') : rawPaths[index],
    text: await file.text(),
  })));
  for (const record of records) normalizeGrpcProtoPath(record.path);
  const normalized = normalizeGrpcProtoTree(records);
  if (normalized.protoFiles.length !== records.length) throw new Error('Proto trees cannot contain duplicate file paths.');
  return normalized;
};
