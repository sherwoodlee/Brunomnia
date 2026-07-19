import type { ApiRequest, KeyValue } from '../types';
import { resolveTemplate } from './request';

export type AuthApplication = { url: string; headers: KeyValue[]; body: string };
export type AuthClock = { now?: Date; nonce?: string };

const utf8 = (value: string) => new TextEncoder().encode(value);
const arrayBuffer = (value: Uint8Array) => Uint8Array.from(value).buffer;
const hex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const oauthEncode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

const hash = async (algorithm: 'SHA-1' | 'SHA-256', value: string) => new Uint8Array(await crypto.subtle.digest(algorithm, utf8(value)));
const hmac = async (algorithm: 'SHA-1' | 'SHA-256', key: string | Uint8Array, value: string) => {
  const material = typeof key === 'string' ? utf8(key) : key;
  const cryptoKey = await crypto.subtle.importKey('raw', arrayBuffer(material), { name: 'HMAC', hash: algorithm }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, utf8(value)));
};

const privateKeyBytes = (pem: string) => {
  const encoded = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, '');
  if (!encoded) throw new Error('A PKCS#8 private key is required for this authentication method.');
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
};

const rsaSign = async (algorithm: 'SHA-1' | 'SHA-256', privateKey: string, value: string) => {
  const key = await crypto.subtle.importKey('pkcs8', arrayBuffer(privateKeyBytes(privateKey)), { name: 'RSASSA-PKCS1-v1_5', hash: algorithm }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, utf8(value)));
};

const resolved = (value: string, variables: Record<string, string>) => resolveTemplate(value, variables);
const appendHeader = (headers: KeyValue[], name: string, value: string, id: string) => [
  ...headers.filter((header) => header.name.toLowerCase() !== name.toLowerCase()),
  { id, name, value, enabled: true },
];

const oauth1 = async (request: ApiRequest, variables: Record<string, string>, application: AuthApplication, clock: AuthClock) => {
  const auth = request.auth;
  const timestamp = resolved(auth.timestamp, variables) || String(Math.floor((clock.now ?? new Date()).getTime() / 1000));
  const nonce = resolved(auth.nonce, variables) || clock.nonce || crypto.randomUUID().replace(/-/g, '');
  const signatureMethod = auth.oauth1SignatureMethod;
  const parameters: Array<[string, string]> = [
    ['oauth_consumer_key', resolved(auth.consumerKey, variables)],
    ['oauth_nonce', nonce],
    ['oauth_signature_method', signatureMethod],
    ['oauth_timestamp', timestamp],
    ['oauth_version', resolved(auth.version, variables) || '1.0'],
  ];
  const token = resolved(auth.tokenKey, variables);
  if (token) parameters.push(['oauth_token', token]);
  const callback = resolved(auth.callback, variables);
  if (callback) parameters.push(['oauth_callback', callback]);
  const verifier = resolved(auth.verifier, variables);
  if (verifier) parameters.push(['oauth_verifier', verifier]);
  if (auth.includeBodyHash && request.bodyMode !== 'form-urlencoded') parameters.push(['oauth_body_hash', base64(await hash('SHA-1', application.body))]);

  const url = new URL(application.url);
  url.searchParams.forEach((value, key) => parameters.push([key, value]));
  if (request.bodyMode === 'form-urlencoded') request.formBody.filter((field) => field.enabled && field.name).forEach((field) => parameters.push([resolved(field.name, variables), resolved(field.value, variables)]));
  const normalized = parameters.map(([key, value]) => [oauthEncode(key), oauthEncode(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue))
    .map(([key, value]) => `${key}=${value}`).join('&');
  const baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
  const signatureBase = `${request.method.toUpperCase()}&${oauthEncode(baseUrl)}&${oauthEncode(normalized)}`;
  const signingKey = `${oauthEncode(resolved(auth.consumerSecret, variables))}&${oauthEncode(resolved(auth.tokenSecret, variables))}`;
  let signature = signingKey;
  if (signatureMethod === 'HMAC-SHA1') signature = base64(await hmac('SHA-1', signingKey, signatureBase));
  else if (signatureMethod === 'HMAC-SHA256') signature = base64(await hmac('SHA-256', signingKey, signatureBase));
  else if (signatureMethod === 'RSA-SHA1') signature = base64(await rsaSign('SHA-1', resolved(auth.privateKey, variables), signatureBase));
  const headerParameters = [...parameters.filter(([name]) => name.startsWith('oauth_')), ['oauth_signature', signature] as [string, string]];
  const realm = resolved(auth.realm, variables);
  if (realm) headerParameters.unshift(['realm', realm]);
  const header = `OAuth ${headerParameters.map(([key, value]) => `${oauthEncode(key)}="${oauthEncode(value)}"`).join(', ')}`;
  return { ...application, headers: appendHeader(application.headers, 'Authorization', header, 'auth-oauth1') };
};

const canonicalQuery = (url: URL) => [...url.searchParams.entries()]
  .map(([key, value]) => [oauthEncode(key), oauthEncode(value)] as const)
  .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue))
  .map(([key, value]) => `${key}=${value}`).join('&');

const canonicalPath = (url: URL) => url.pathname.split('/').map((part) => {
  try { return oauthEncode(decodeURIComponent(part)); } catch { return oauthEncode(part); }
}).join('/') || '/';

const awsIam = async (request: ApiRequest, variables: Record<string, string>, application: AuthApplication, clock: AuthClock) => {
  const auth = request.auth;
  const accessKey = resolved(auth.awsAccessKeyId, variables);
  const secret = resolved(auth.awsSecretAccessKey, variables);
  const region = resolved(auth.awsRegion, variables) || 'us-east-1';
  const service = resolved(auth.awsService, variables) || 'execute-api';
  if (!accessKey || !secret) throw new Error('AWS IAM v4 requires an access key ID and secret access key.');
  const now = clock.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const shortDate = amzDate.slice(0, 8);
  const url = new URL(application.url);
  const payloadHash = hex(await hash('SHA-256', application.body));
  const headerMap = new Map<string, string>();
  application.headers.filter((header) => header.enabled && header.name.toLowerCase() !== 'authorization').forEach((header) => {
    const name = header.name.trim().toLowerCase();
    const value = header.value.trim().replace(/\s+/g, ' ');
    headerMap.set(name, headerMap.has(name) ? `${headerMap.get(name)},${value}` : value);
  });
  headerMap.set('host', url.host);
  headerMap.set('x-amz-date', amzDate);
  const sessionToken = resolved(auth.awsSessionToken, variables);
  if (sessionToken) headerMap.set('x-amz-security-token', sessionToken);
  const sortedHeaders = [...headerMap.entries()].sort(([left], [right]) => left.localeCompare(right));
  const canonicalHeaders = `${sortedHeaders.map(([name, value]) => `${name}:${value}`).join('\n')}\n`;
  const signedHeaders = sortedHeaders.map(([name]) => name).join(';');
  const canonicalRequest = [request.method, canonicalPath(url), canonicalQuery(url), canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${shortDate}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hex(await hash('SHA-256', canonicalRequest))}`;
  const dateKey = await hmac('SHA-256', `AWS4${secret}`, shortDate);
  const regionKey = await hmac('SHA-256', dateKey, region);
  const serviceKey = await hmac('SHA-256', regionKey, service);
  const signingKey = await hmac('SHA-256', serviceKey, 'aws4_request');
  const signature = hex(await hmac('SHA-256', signingKey, stringToSign));
  let headers = application.headers;
  headers = appendHeader(headers, 'X-Amz-Date', amzDate, 'auth-aws-date');
  if (sessionToken) headers = appendHeader(headers, 'X-Amz-Security-Token', sessionToken, 'auth-aws-token');
  headers = appendHeader(headers, 'Authorization', `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`, 'auth-aws');
  return { ...application, headers };
};

const hawk = async (request: ApiRequest, variables: Record<string, string>, application: AuthApplication, clock: AuthClock) => {
  const auth = request.auth;
  const id = resolved(auth.hawkId, variables);
  const key = resolved(auth.hawkKey, variables);
  if (!id || !key) throw new Error('Hawk requires an ID and key.');
  const algorithm = auth.hawkAlgorithm === 'sha1' ? 'SHA-1' : 'SHA-256';
  const now = clock.now ?? new Date();
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const nonce = clock.nonce || crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  const url = new URL(application.url);
  const contentType = application.headers.find((header) => header.enabled && header.name.toLowerCase() === 'content-type')?.value.split(';')[0].trim().toLowerCase() ?? '';
  const payloadHash = auth.hawkValidatePayload ? base64(await hash(algorithm, `hawk.1.payload\n${contentType}\n${application.body}\n`)) : '';
  const ext = resolved(auth.hawkExt, variables).replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
  const resource = `${url.pathname}${url.search}`;
  const normalized = `hawk.1.header\n${timestamp}\n${nonce}\n${request.method}\n${resource}\n${url.hostname}\n${url.port || (url.protocol === 'https:' ? '443' : '80')}\n${payloadHash}\n${ext}\n\n\n`;
  const mac = base64(await hmac(algorithm, key, normalized));
  const attributes = [`id="${id}"`, `ts="${timestamp}"`, `nonce="${nonce}"`, `mac="${mac}"`];
  if (payloadHash) attributes.push(`hash="${payloadHash}"`);
  if (ext) attributes.push(`ext="${ext}"`);
  return { ...application, headers: appendHeader(application.headers, 'Authorization', `Hawk ${attributes.join(', ')}`, 'auth-hawk') };
};

const base64Url = (bytes: Uint8Array) => base64(bytes).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const asap = async (request: ApiRequest, variables: Record<string, string>, application: AuthApplication, clock: AuthClock) => {
  const auth = request.auth;
  const now = Math.floor((clock.now ?? new Date()).getTime() / 1000);
  const issuer = resolved(auth.asapIssuer, variables);
  const audience = resolved(auth.asapAudience, variables);
  if (!issuer || !audience) throw new Error('Atlassian ASAP requires issuer and audience values.');
  let additional: Record<string, unknown> = {};
  const additionalSource = resolved(auth.asapAdditionalClaims, variables).trim();
  if (additionalSource) additional = JSON.parse(additionalSource);
  const header = { alg: 'RS256', typ: 'JWT', ...(auth.asapKeyId ? { kid: resolved(auth.asapKeyId, variables) } : {}) };
  const payload = { ...additional, iss: issuer, aud: audience, sub: resolved(auth.asapSubject, variables) || issuer, iat: now, exp: now + 60, jti: clock.nonce || crypto.randomUUID() };
  const encoded = `${base64Url(utf8(JSON.stringify(header)))}.${base64Url(utf8(JSON.stringify(payload)))}`;
  const signature = base64Url(await rsaSign('SHA-256', resolved(auth.asapPrivateKey, variables), encoded));
  return { ...application, headers: appendHeader(application.headers, 'Authorization', `Bearer ${encoded}.${signature}`, 'auth-asap') };
};

export const applyAdvancedAuth = async (
  request: ApiRequest,
  variables: Record<string, string>,
  application: AuthApplication,
  clock: AuthClock = {},
): Promise<AuthApplication> => {
  const auth = request.auth;
  if (auth.disabled || auth.type === 'none' || auth.type === 'basic' || auth.type === 'bearer' || auth.type === 'api-key' || auth.type === 'digest' || auth.type === 'ntlm' || auth.type === 'netrc') return application;
  if (auth.type === 'oauth2') {
    const token = resolved(auth.accessToken, variables);
    if (!token) return application;
    const prefix = resolved(auth.tokenPrefix, variables) || 'Bearer';
    return { ...application, headers: appendHeader(application.headers, 'Authorization', prefix === 'NO_PREFIX' ? token : `${prefix} ${token}`.trim(), 'auth-oauth2') };
  }
  if (auth.type === 'oauth1') return oauth1(request, variables, application, clock);
  if (auth.type === 'iam') return awsIam(request, variables, application, clock);
  if (auth.type === 'hawk') return hawk(request, variables, application, clock);
  if (auth.type === 'asap') return asap(request, variables, application, clock);
  return application;
};

export const createOAuth2AuthorizationUrl = async (request: ApiRequest, variables: Record<string, string>) => {
  const auth = request.auth;
  const url = new URL(resolved(auth.authorizationUrl, variables));
  url.searchParams.set('client_id', resolved(auth.clientId, variables));
  url.searchParams.set('redirect_uri', resolved(auth.redirectUrl, variables));
  url.searchParams.set('response_type', auth.oauth2GrantType === 'authorization_code' ? 'code' : auth.responseType || 'token');
  if (auth.oauth2GrantType === 'implicit' && auth.responseType.includes('id_token') && !url.searchParams.has('nonce')) {
    url.searchParams.set('nonce', generateOAuth2State());
  }
  if (auth.scope) url.searchParams.set('scope', resolved(auth.scope, variables));
  if (auth.state) url.searchParams.set('state', resolved(auth.state, variables));
  if (auth.audience) url.searchParams.set('audience', resolved(auth.audience, variables));
  if (auth.resource) url.searchParams.set('resource', resolved(auth.resource, variables));
  if (auth.usePkce) {
    const verifier = resolved(auth.codeVerifier, variables);
    if (!verifier) throw new Error('Generate or enter a PKCE code verifier first.');
    const challenge = auth.pkceMethod === 'plain' ? verifier : base64Url(await hash('SHA-256', verifier));
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', auth.pkceMethod);
  }
  return url.toString();
};

export const generateCodeVerifier = () => base64Url(crypto.getRandomValues(new Uint8Array(48)));

export const generateOAuth2State = () => base64Url(crypto.getRandomValues(new Uint8Array(32)));
