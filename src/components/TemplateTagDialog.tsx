import { useMemo, useState } from 'react';
import type { ApiRequest, CookieRecord, StoredResponse } from '../types';
import { fakerFunctionNames } from '../lib/faker';
import { buildTemplateTag, insertTemplateTag, templateTagDestinations, type TemplateTagInsertMode, type TemplateTagKind } from '../lib/templateTagBuilder';
import { Icon } from './Icon';

type TemplateTagDialogProps = {
  cookies: CookieRecord[];
  request: ApiRequest;
  responses: StoredResponse[];
  variableNames: string[];
  onApply: (request: ApiRequest) => void;
  onClose: () => void;
};

const kinds: Array<{ id: TemplateTagKind; label: string }> = [
  { id: 'environment', label: 'Environment variable' },
  { id: 'faker', label: 'Faker value' },
  { id: 'uuid', label: 'UUID' },
  { id: 'now', label: 'Timestamp' },
  { id: 'base64', label: 'Base64' },
  { id: 'hash', label: 'Hash' },
  { id: 'jsonpath', label: 'JSONPath' },
  { id: 'cookie', label: 'Cookie jar value' },
  { id: 'response', label: 'Stored response' },
  { id: 'request', label: 'Current request' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'file', label: 'Local file' },
  { id: 'external', label: 'External vault' },
];

const defaultsForKind = (kind: TemplateTagKind): Record<string, string> => {
  if (kind === 'environment') return { name: '' };
  if (kind === 'faker') return { name: 'randomUUID' };
  if (kind === 'uuid') return { version: 'v4' };
  if (kind === 'now') return { format: 'iso-8601' };
  if (kind === 'base64') return { encoding: 'normal', operation: 'encode', value: '' };
  if (kind === 'hash') return { algorithm: 'sha256', output: 'hex', value: '' };
  if (kind === 'jsonpath') return { path: '$', value: '' };
  if (kind === 'cookie') return { name: '', url: '' };
  if (kind === 'response') return { attribute: 'body', path: '', request: '' };
  if (kind === 'request') return { attribute: 'url' };
  if (kind === 'prompt') return { message: '', value: '' };
  if (kind === 'file') return { path: '' };
  return { field: '', provider: 'aws', reference: '', scope: '', version: '' };
};

export function TemplateTagDialog({ cookies, request, responses, variableNames, onApply, onClose }: TemplateTagDialogProps) {
  const destinations = useMemo(() => templateTagDestinations(request), [request]);
  const [destination, setDestination] = useState(destinations[0]?.id ?? 'url');
  const [kind, setKind] = useState<TemplateTagKind>('environment');
  const [values, setValues] = useState<Record<string, string>>(() => defaultsForKind('environment'));
  const snippet = buildTemplateTag(kind, values);
  const valid = (kind !== 'environment' || Boolean(values.name.trim()))
    && (kind !== 'cookie' || Boolean(values.name.trim()))
    && (kind !== 'response' || Boolean(values.request?.trim()))
    && (kind !== 'file' || Boolean(values.path.trim()))
    && (kind !== 'external' || Boolean(values.reference?.trim()));
  const update = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }));
  const apply = (mode: TemplateTagInsertMode) => {
    onApply(insertTemplateTag(request, destination, snippet, mode));
    onClose();
  };
  const text = (label: string, name: string, placeholder = '') => <label>{label}<input onChange={(event) => update(name, event.target.value)} placeholder={placeholder} value={values[name] ?? ''} /></label>;
  const select = (label: string, name: string, options: Array<[string, string]>) => <label>{label}<select onChange={(event) => update(name, event.target.value)} value={values[name] ?? options[0]?.[0] ?? ''}>{options.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>;

  return <div className="modal-backdrop" onMouseDown={onClose} role="presentation">
    <section aria-labelledby="template-tag-title" aria-modal="true" className="modal template-tag-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
      <header><div><small>Local dynamic values</small><h2 id="template-tag-title">Insert template tag</h2></div><button aria-label="Close" className="icon-button subtle" onClick={onClose} type="button"><Icon name="x" /></button></header>
      <div className="template-tag-grid">
        <label>Destination<select onChange={(event) => setDestination(event.target.value)} value={destination}>{destinations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>Tag<select onChange={(event) => { const next = event.target.value as TemplateTagKind; setKind(next); setValues(defaultsForKind(next)); }} value={kind}>{kinds.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        {kind === 'environment' ? <label>Variable<select onChange={(event) => update('name', event.target.value)} value={values.name}>{<option value="">Choose variable</option>}{variableNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label> : null}
        {kind === 'faker' ? <label>Function<select onChange={(event) => update('name', event.target.value)} value={values.name || 'randomUUID'}>{fakerFunctionNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label> : null}
        {kind === 'uuid' ? select('Version', 'version', [['v4', 'Version 4'], ['v1', 'Version 1']]) : null}
        {kind === 'now' ? select('Format', 'format', [['iso-8601', 'ISO-8601'], ['millis', 'Milliseconds'], ['unix', 'Unix seconds']]) : null}
        {kind === 'base64' ? <>{select('Action', 'operation', [['encode', 'Encode'], ['decode', 'Decode']])}{select('Kind', 'encoding', [['normal', 'Normal'], ['url', 'URL safe'], ['hex', 'Hex']])}{text('Value', 'value', 'Text or encoded value')}</> : null}
        {kind === 'hash' ? <>{select('Algorithm', 'algorithm', [['sha1', 'SHA-1'], ['sha256', 'SHA-256'], ['sha384', 'SHA-384'], ['sha512', 'SHA-512']])}{select('Output', 'output', [['hex', 'Hex'], ['base64', 'Base64']])}{text('Value', 'value', 'Value to hash')}</> : null}
        {kind === 'jsonpath' ? <>{text('JSON', 'value', '{"items":[]}')}{text('JSONPath', 'path', '$.items[0]')}</> : null}
        {kind === 'cookie' ? <>{text('URL (optional)', 'url', 'Defaults to request URL')}<label>Cookie<select onChange={(event) => update('name', event.target.value)} value={values.name}><option value="">Choose cookie</option>{cookies.map((cookie) => <option key={cookie.id} value={cookie.name}>{cookie.name} · {cookie.domain}{cookie.path}</option>)}</select></label></> : null}
        {kind === 'response' ? <><label>Request<select onChange={(event) => update('request', event.target.value)} value={values.request ?? ''}><option value="">Choose stored response</option>{responses.map((response) => <option key={response.id} value={response.requestId}>{response.requestName} · {response.status}</option>)}</select></label>{select('Attribute', 'attribute', [['body', 'Body'], ['statusCode', 'Status code'], ['header', 'Header'], ['url', 'Request URL']])}{text(values.attribute === 'header' ? 'Header name' : 'JSONPath (optional)', 'path', values.attribute === 'header' ? 'Location' : '$.id')}</> : null}
        {kind === 'request' ? select('Attribute', 'attribute', [['url', 'URL'], ['name', 'Name'], ['method', 'Method'], ['body', 'Body']]) : null}
        {kind === 'prompt' ? <>{text('Message', 'message', 'Enter a value')}{text('Default value', 'value')}</> : null}
        {kind === 'file' ? <>{text('Approved file path', 'path', '/absolute/path/to/file.txt')}<p>File tags require the desktop file grant and a path inside an allowed data folder.</p></> : null}
        {kind === 'external' ? <>{select('Provider', 'provider', [['aws', 'AWS Secrets Manager'], ['gcp', 'Google Secret Manager'], ['azure', 'Azure Key Vault'], ['hashicorp', 'HashiCorp Vault']])}{text('Reference', 'reference')}{text('Scope', 'scope', 'Region, project, vault URL, or vault name')}{text('Field', 'field')}{text('Version', 'version')}</> : null}
      </div>
      <div className="template-tag-preview"><small>Preview</small><code>{snippet}</code></div>
      <footer><button className="modal-cancel" onClick={onClose} type="button">Cancel</button><button className="secondary-button" disabled={!destination || !valid} onClick={() => apply('replace')} type="button">Replace value</button><button className="primary-button" disabled={!destination || !valid} onClick={() => apply('append')} type="button">Append tag</button></footer>
    </section>
  </div>;
}
