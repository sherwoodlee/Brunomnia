import { useState } from 'react';
import type { ApiRequest, CookieRecord, Environment, StoredResponse } from '../types';
import { createOAuth2AuthorizationUrl, generateCodeVerifier } from '../lib/auth';
import { fetchOAuth2Token } from '../lib/http';
import { environmentMap } from '../lib/request';

type AuthEditorProps = {
  request: ApiRequest;
  environment: Environment;
  cookies: CookieRecord[];
  responses: StoredResponse[];
  onChange: (patch: Partial<ApiRequest>) => void;
};

type AuthFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  secret?: boolean;
};

function AuthField({ label, value, onChange, placeholder, secret = false }: AuthFieldProps) {
  return <label>{label}<input autoComplete="off" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} spellCheck={false} type={secret ? 'password' : 'text'} value={value} /></label>;
}

export function AuthEditor({ request, environment, cookies, responses, onChange }: AuthEditorProps) {
  const auth = request.auth;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const update = (patch: Partial<ApiRequest['auth']>) => onChange({ auth: { ...auth, ...patch } });
  const field = (key: keyof ApiRequest['auth'], label: string, options: Pick<AuthFieldProps, 'placeholder' | 'secret'> = {}) => (
    <AuthField key={key} label={label} value={String(auth[key])} onChange={(value) => update({ [key]: value })} {...options} />
  );

  const copyAuthorizationUrl = async () => {
    setBusy(true); setMessage('');
    try {
      const url = await createOAuth2AuthorizationUrl(request, environmentMap(environment));
      await navigator.clipboard.writeText(url);
      setMessage('Authorization URL copied. Complete the provider flow, then paste the returned code or token here.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught));
    } finally { setBusy(false); }
  };

  const acquireToken = async () => {
    setBusy(true); setMessage('');
    try {
      const result = await fetchOAuth2Token(request, environment, { cookies, responses });
      update({ accessToken: result.accessToken, refreshToken: result.refreshToken, tokenPrefix: result.tokenType });
      setMessage(`Token acquired${result.expiresIn ? ` · expires in ${result.expiresIn}s` : ''}.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught));
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-editor">
      <label>Auth type
        <select value={auth.type} onChange={(event) => update({ type: event.target.value as ApiRequest['auth']['type'] })}>
          <option value="none">No auth</option>
          <option value="basic">Basic auth</option>
          <option value="digest">Digest auth</option>
          <option value="oauth1">OAuth 1.0</option>
          <option value="oauth2">OAuth 2.0</option>
          <option value="ntlm">Microsoft NTLM</option>
          <option value="iam">AWS IAM v4</option>
          <option value="bearer">Bearer token</option>
          <option value="api-key">API key</option>
          <option value="hawk">Hawk</option>
          <option value="asap">Atlassian ASAP</option>
          <option value="netrc">Netrc file</option>
        </select>
      </label>
      <label className="auth-toggle"><input checked={!auth.disabled} onChange={(event) => update({ disabled: !event.target.checked })} type="checkbox" /><span>Enable authentication</span></label>

      {auth.type === 'none' ? <p>This request does not add authentication.</p> : null}
      {auth.type === 'bearer' ? <>{field('prefix', 'Prefix')}{field('token', 'Token', { placeholder: '{{ token }}', secret: true })}</> : null}
      {auth.type === 'basic' || auth.type === 'digest' ? <>{field('username', 'Username')}{field('password', 'Password', { secret: true })}</> : null}
      {auth.type === 'api-key' ? <>
        {field('apiKeyName', 'Key')}{field('apiKeyValue', 'Value', { secret: true })}
        <label>Add to<select onChange={(event) => update({ apiKeyLocation: event.target.value as 'header' | 'query' })} value={auth.apiKeyLocation}><option value="header">Header</option><option value="query">Query string</option></select></label>
      </> : null}
      {auth.type === 'oauth1' ? <>
        <label>Signature method<select value={auth.oauth1SignatureMethod} onChange={(event) => update({ oauth1SignatureMethod: event.target.value as ApiRequest['auth']['oauth1SignatureMethod'] })}><option>HMAC-SHA1</option><option>HMAC-SHA256</option><option>RSA-SHA1</option><option>PLAINTEXT</option></select></label>
        {field('consumerKey', 'Consumer key')}{field('consumerSecret', 'Consumer secret', { secret: true })}{field('tokenKey', 'Token key')}{field('tokenSecret', 'Token secret', { secret: true })}
        {field('realm', 'Realm')}{field('callback', 'Callback URL')}{field('verifier', 'Verifier')}{field('nonce', 'Nonce', { placeholder: 'Generated when blank' })}{field('timestamp', 'Timestamp', { placeholder: 'Generated when blank' })}
        <label className="auth-toggle"><input checked={auth.includeBodyHash} onChange={(event) => update({ includeBodyHash: event.target.checked })} type="checkbox" /><span>Include body hash</span></label>
        {auth.oauth1SignatureMethod === 'RSA-SHA1' ? <label className="auth-wide">PKCS#8 private key<textarea value={auth.privateKey} onChange={(event) => update({ privateKey: event.target.value })} placeholder="-----BEGIN PRIVATE KEY-----" /></label> : null}
      </> : null}
      {auth.type === 'oauth2' ? <>
        <label>Grant type<select value={auth.oauth2GrantType} onChange={(event) => update({ oauth2GrantType: event.target.value as ApiRequest['auth']['oauth2GrantType'] })}><option value="authorization_code">Authorization code</option><option value="client_credentials">Client credentials</option><option value="implicit">Implicit</option><option value="password">Resource owner password</option><option value="refresh_token">Refresh token</option></select></label>
        {field('authorizationUrl', 'Authorization URL', { placeholder: 'https://identity.example.com/authorize' })}{field('accessTokenUrl', 'Access token URL', { placeholder: 'https://identity.example.com/token' })}
        {field('clientId', 'Client ID')}{field('clientSecret', 'Client secret', { secret: true })}{field('redirectUrl', 'Redirect URL')}{field('scope', 'Scope')}{field('audience', 'Audience')}{field('resource', 'Resource')}{field('state', 'State')}
        {auth.oauth2GrantType === 'password' ? <>{field('username', 'Username')}{field('password', 'Password', { secret: true })}</> : null}
        {auth.oauth2GrantType === 'authorization_code' ? field('code', 'Authorization code', { secret: true }) : null}
        {auth.oauth2GrantType === 'refresh_token' ? field('refreshToken', 'Refresh token', { secret: true }) : null}
        {(auth.oauth2GrantType === 'authorization_code' || auth.oauth2GrantType === 'implicit') ? <button className="auth-action" disabled={busy || !auth.authorizationUrl} onClick={() => void copyAuthorizationUrl()} type="button">Copy authorization URL</button> : null}
        {auth.oauth2GrantType === 'authorization_code' ? <>
          <label className="auth-toggle"><input checked={auth.usePkce} onChange={(event) => update({ usePkce: event.target.checked })} type="checkbox" /><span>Use PKCE</span></label>
          {auth.usePkce ? <><label>PKCE method<select value={auth.pkceMethod} onChange={(event) => update({ pkceMethod: event.target.value as 'S256' | 'plain' })}><option value="S256">S256</option><option value="plain">Plain</option></select></label>{field('codeVerifier', 'Code verifier')}<button className="auth-action" onClick={() => update({ codeVerifier: generateCodeVerifier() })} type="button">Generate verifier</button></> : null}
        </> : null}
        <label className="auth-toggle"><input checked={auth.credentialsInBody} onChange={(event) => update({ credentialsInBody: event.target.checked })} type="checkbox" /><span>Send client credentials in body</span></label>
        {field('tokenPrefix', 'Token prefix')}{field('accessToken', 'Access token', { secret: true })}
        {auth.oauth2GrantType !== 'implicit' ? <button className="auth-action primary" disabled={busy || !auth.accessTokenUrl} onClick={() => void acquireToken()} type="button">{busy ? 'Requesting token…' : 'Fetch token'}</button> : null}
      </> : null}
      {auth.type === 'ntlm' ? <>{field('username', 'Username')}{field('password', 'Password', { secret: true })}{field('ntlmDomain', 'Domain')}{field('ntlmWorkstation', 'Workstation')}</> : null}
      {auth.type === 'iam' ? <>{field('awsAccessKeyId', 'Access key ID')}{field('awsSecretAccessKey', 'Secret access key', { secret: true })}{field('awsSessionToken', 'Session token', { secret: true })}{field('awsRegion', 'Region')}{field('awsService', 'Service')}</> : null}
      {auth.type === 'hawk' ? <>{field('hawkId', 'ID')}{field('hawkKey', 'Key', { secret: true })}{field('hawkExt', 'Ext')}
        <label>Algorithm<select value={auth.hawkAlgorithm} onChange={(event) => update({ hawkAlgorithm: event.target.value as 'sha1' | 'sha256' })}><option value="sha256">SHA-256</option><option value="sha1">SHA-1</option></select></label>
        <label className="auth-toggle"><input checked={auth.hawkValidatePayload} onChange={(event) => update({ hawkValidatePayload: event.target.checked })} type="checkbox" /><span>Sign payload hash</span></label>
      </> : null}
      {auth.type === 'asap' ? <>{field('asapIssuer', 'Issuer')}{field('asapSubject', 'Subject')}{field('asapAudience', 'Audience')}{field('asapKeyId', 'Key ID')}
        <label className="auth-wide">Additional claims (JSON)<textarea value={auth.asapAdditionalClaims} onChange={(event) => update({ asapAdditionalClaims: event.target.value })} /></label>
        <label className="auth-wide">PKCS#8 private key<textarea value={auth.asapPrivateKey} onChange={(event) => update({ asapPrivateKey: event.target.value })} placeholder="-----BEGIN PRIVATE KEY-----" /></label>
      </> : null}
      {auth.type === 'netrc' ? <label className="auth-wide auth-file">Netrc contents<textarea value={auth.netrc} onChange={(event) => update({ netrc: event.target.value })} placeholder="machine api.example.com login user password secret" /><span>Parsed locally and matched to the request hostname.</span><input aria-label="Choose Netrc file" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then((netrc) => update({ netrc })); }} /></label> : null}
      {message ? <div className="auth-message" role="status">{message}</div> : null}
    </div>
  );
}
