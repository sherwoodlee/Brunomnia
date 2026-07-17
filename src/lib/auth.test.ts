import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { applyAdvancedAuth, createOAuth2AuthorizationUrl } from './auth';

const request = () => structuredClone(cloneSeedWorkspace().collections[0].requests[0]);

describe('advanced request authentication', () => {
  it('creates a deterministic OAuth 1 HMAC-SHA1 Authorization header', async () => {
    const value = request();
    value.method = 'GET';
    value.url = 'http://photos.example.net/photos?file=vacation.jpg&size=original';
    value.auth = { ...value.auth, type: 'oauth1', consumerKey: 'dpf43f3p2l4k3l03', consumerSecret: 'kd94hf93k423kf44', tokenKey: 'nnch734d00sl2jdk', tokenSecret: 'pfkkdhi9sl3r4s00', nonce: 'kllo9940pd9333jh', timestamp: '1191242096' };
    const output = await applyAdvancedAuth(value, {}, { url: value.url, headers: [], body: '' });
    const header = output.headers[0].value;
    expect(header).toContain('oauth_signature_method="HMAC-SHA1"');
    expect(header).toContain('oauth_signature="tR3%2BTy81lMeYAr%2FFid0kMTYa%2FWM%3D"');
  });

  it('creates deterministic AWS IAM v4 signing headers', async () => {
    const value = request();
    value.method = 'GET';
    value.url = 'https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08';
    value.auth = { ...value.auth, type: 'iam', awsAccessKeyId: 'AKIDEXAMPLE', awsSecretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', awsRegion: 'us-east-1', awsService: 'iam' };
    const output = await applyAdvancedAuth(value, {}, { url: value.url, headers: [], body: '' }, { now: new Date('2015-08-30T12:36:00Z') });
    expect(output.headers.find((header) => header.name === 'X-Amz-Date')?.value).toBe('20150830T123600Z');
    expect(output.headers.find((header) => header.name === 'Authorization')?.value).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20150830\/us-east-1\/iam\/aws4_request, SignedHeaders=host;x-amz-date, Signature=[a-f0-9]{64}$/);
  });

  it('creates Hawk headers with a signed payload hash', async () => {
    const value = request();
    value.method = 'POST';
    value.url = 'https://api.example.com/resource?a=1';
    value.auth = { ...value.auth, type: 'hawk', hawkId: 'dh37fgj492je', hawkKey: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn', hawkAlgorithm: 'sha256', hawkValidatePayload: true };
    const output = await applyAdvancedAuth(value, {}, { url: value.url, headers: [{ id: 'ct', name: 'Content-Type', value: 'text/plain', enabled: true }], body: 'hello' }, { now: new Date('2026-07-16T12:00:00Z'), nonce: 'abcdef12' });
    const header = output.headers.find((item) => item.name === 'Authorization')?.value ?? '';
    expect(header).toContain('Hawk id="dh37fgj492je"');
    expect(header).toContain('nonce="abcdef12"');
    expect(header).toMatch(/hash="[A-Za-z0-9+/=]+"/);
    expect(header).toMatch(/mac="[A-Za-z0-9+/=]+"/);
  });

  it('builds OAuth 2 authorization-code URLs with PKCE', async () => {
    const value = request();
    value.auth = { ...value.auth, type: 'oauth2', authorizationUrl: 'https://identity.example.com/authorize', clientId: 'client', redirectUrl: 'http://localhost/callback', scope: 'openid profile', state: 'state-1', usePkce: true, codeVerifier: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~abc' };
    const output = new URL(await createOAuth2AuthorizationUrl(value, {}));
    expect(output.searchParams.get('client_id')).toBe('client');
    expect(output.searchParams.get('code_challenge_method')).toBe('S256');
    expect(output.searchParams.get('code_challenge')).toBeTruthy();
  });
});
