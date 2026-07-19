import { useEffect, useRef, useState } from 'react';
import type { ApiRequest } from '../types';
import { clientCodeFamilies, generateClientCode, generateClientCodeWithAuth, resolveClientCodeSelection } from '../lib/codegen';
import type { ClientCodeSnippet, ClientCodeTarget } from '../lib/codegen';
import { Icon } from './Icon';

type CodeGenerationDialogProps = {
  request: ApiRequest;
  variables: Record<string, string>;
  generate?: (target: ClientCodeTarget, request: ApiRequest, variables: Record<string, string>) => Promise<ClientCodeSnippet>;
  onClose: () => void;
};

export function CodeGenerationDialog({ request, variables, generate, onClose }: CodeGenerationDialogProps) {
  const [selection, setSelection] = useState(() => {
    try {
      return resolveClientCodeSelection(
        JSON.parse(window.localStorage.getItem('brunomnia::generateCode::target') || 'null'),
        JSON.parse(window.localStorage.getItem('brunomnia::generateCode::client') || 'null'),
      );
    } catch {
      return resolveClientCodeSelection();
    }
  });
  const [copied, setCopied] = useState(false);
  const family = clientCodeFamilies.find((candidate) => candidate.id === selection.familyId)!;
  const [snippet, setSnippet] = useState(() => generateClientCode(selection.target, request, variables));
  const generateRef = useRef(generate ?? generateClientCodeWithAuth);

  useEffect(() => { generateRef.current = generate ?? generateClientCodeWithAuth; }, [generate]);

  useEffect(() => {
    let active = true;
    const fallback = generateClientCode(selection.target, request, variables);
    setSnippet(fallback);
    void generateRef.current(selection.target, request, variables)
      .then((generated) => { if (active) setSnippet(generated); })
      .catch((error: unknown) => {
        if (active) setSnippet({
          ...fallback,
          warnings: [...fallback.warnings, `Generated request could not be prepared: ${error instanceof Error ? error.message : String(error)}`],
        });
      });
    return () => { active = false; };
  }, [request, selection.target, variables]);

  useEffect(() => {
    try {
      window.localStorage.setItem('brunomnia::generateCode::target', JSON.stringify(selection.familyId));
      window.localStorage.setItem('brunomnia::generateCode::client', JSON.stringify(selection.clientKey));
    } catch {}
  }, [selection.clientKey, selection.familyId]);

  const select = (familyId: string, clientKey?: string) => {
    setSelection(resolveClientCodeSelection(familyId, clientKey));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  };

  return <div className="modal-backdrop" onMouseDown={onClose} role="presentation">
    <section aria-labelledby="codegen-title" aria-modal="true" className="modal codegen-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
      <header>
        <div><small>Local request conversion</small><h2 id="codegen-title">Generate client code</h2></div>
        <button aria-label="Close" className="icon-button subtle" onClick={onClose} type="button"><Icon name="x" /></button>
      </header>
      <div className="codegen-toolbar">
        <label>Target<select aria-label="Code generation target" onChange={(event) => select(event.target.value)} value={selection.familyId}>{clientCodeFamilies.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</select></label>
        <label>Client<select aria-label="Code generation client" onChange={(event) => select(selection.familyId, event.target.value)} value={selection.clientKey}>{family.clients.map((candidate) => <option key={candidate.key} value={candidate.key}>{candidate.label}</option>)}</select></label>
        <button className="secondary-button" onClick={() => void copy()} type="button"><Icon name={copied ? 'check' : 'copy'} size={14} /> {copied ? 'Copied' : 'Copy'}</button>
      </div>
      <p>Generated on this device from the effective request and active environment. The generated request is never sent; enabled plugin hooks and template tags run with their existing explicit permissions.</p>
      {snippet.warnings.length ? <div className="codegen-warnings" role="status"><strong>Review before running</strong><ul>{snippet.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
      <pre className="codegen-output"><code>{snippet.code}</code></pre>
      <footer><button className="primary-button" onClick={onClose} type="button">Done</button></footer>
    </section>
  </div>;
}
