import { useMemo, useState } from 'react';
import type { ApiRequest } from '../types';
import { clientCodeTargets, generateClientCode, type ClientCodeTarget } from '../lib/codegen';
import { Icon } from './Icon';

type CodeGenerationDialogProps = {
  request: ApiRequest;
  variables: Record<string, string>;
  onClose: () => void;
};

export function CodeGenerationDialog({ request, variables, onClose }: CodeGenerationDialogProps) {
  const [target, setTarget] = useState<ClientCodeTarget>('curl');
  const [copied, setCopied] = useState(false);
  const snippet = useMemo(() => generateClientCode(target, request, variables), [request, target, variables]);

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
        <label>Target<select aria-label="Code generation target" onChange={(event) => setTarget(event.target.value as ClientCodeTarget)} value={target}>{clientCodeTargets.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</select></label>
        <button className="secondary-button" onClick={() => void copy()} type="button"><Icon name={copied ? 'check' : 'copy'} size={14} /> {copied ? 'Copied' : 'Copy'}</button>
      </div>
      <p>Generated on this device from the effective request and active environment. The preview never sends a request.</p>
      {snippet.warnings.length ? <div className="codegen-warnings" role="status"><strong>Review before running</strong><ul>{snippet.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
      <pre className="codegen-output"><code>{snippet.code}</code></pre>
      <footer><button className="primary-button" onClick={onClose} type="button">Done</button></footer>
    </section>
  </div>;
}
