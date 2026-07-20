import { expect, it } from 'vitest';
import { loadKonnectControlPlaneResources, loadKonnectControlPlanesForRegion } from './konnect';

const token = process.env.BRUNOMNIA_KONNECT_TOKEN ?? '';
const liveTest = process.env.BRUNOMNIA_KONNECT_LIVE === '1' && token ? it : it.skip;

liveTest('discovers a live Konnect tenant and reads its first control plane', async () => {
  const region = (process.env.BRUNOMNIA_KONNECT_REGION ?? 'us').trim();
  const config = {
    enabled: true,
    baseUrl: 'https://us.api.konghq.com',
    token: '{{ vault.konnect_live }}',
    controlPlaneId: '',
    controlPlanes: [],
  };
  const requestContext = {
    requestTimeoutMs: 30_000,
    vault: { 'vault.konnect_live': token },
  };

  const controlPlanes = await loadKonnectControlPlanesForRegion(config, region, undefined, requestContext);
  expect(Array.isArray(controlPlanes)).toBe(true);
  if (!controlPlanes.length) return;
  const resources = await loadKonnectControlPlaneResources(config, controlPlanes[0], undefined, requestContext);
  expect(Array.isArray(resources.services)).toBe(true);
  expect(Array.isArray(resources.routes)).toBe(true);
}, 120_000);
