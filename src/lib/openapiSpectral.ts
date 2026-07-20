import { stringify } from 'yaml';
import type { ApiDesign, ApiDesignSourceFile, OpenApiIssue } from '../types';
import { analyzeOpenApi, type OpenApiAnalysis } from './openapi';
import { lintOpenApiWithSpectral } from './spectral';
import type { RemoteSourceReader } from './apiDesignSources';

const mergeIssues = (...groups: OpenApiIssue[][]) => {
  const seen = new Set<string>();
  return groups.flat().filter((issue) => {
    const key = `${issue.severity}\0${issue.code ?? ''}\0${issue.source ?? ''}\0${issue.path}\0${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const analyzeOpenApiDesign = async (design: Pick<ApiDesign, 'contents' | 'ruleset' | 'sourceFiles'> & { rulesetFiles?: ApiDesignSourceFile[] }, fetchRemote?: RemoteSourceReader): Promise<OpenApiAnalysis> => {
  const structural = analyzeOpenApi(design.contents);
  try {
    const lint = await lintOpenApiWithSpectral({ ...design, fetchRemote });
    if (!lint.document) return { ...structural, issues: mergeIssues(lint.issues, structural.issues) };
    const resolved = analyzeOpenApi(stringify(lint.document));
    return { ...resolved, document: lint.document, issues: mergeIssues(lint.issues, resolved.issues) };
  } catch (error) {
    return {
      ...structural,
      issues: mergeIssues([{
        severity: 'error',
        path: design.ruleset?.trim() ? '$ruleset' : '$references',
        code: design.ruleset?.trim() ? 'invalid-ruleset' : 'invalid-reference',
        message: error instanceof Error ? error.message : String(error),
      }], structural.issues),
    };
  }
};
