import { useEffect, useMemo, useState } from 'react';
import type { ApiRequest, HttpMethod, HttpResponse, MockServer, StoredResponse } from '../types';
import { applyResponseToMockTarget, createMockRouteFromResponse, type AppliedResponseMockTarget } from '../lib/mockRouteFromResponse';
import { updateMockServer } from '../lib/mock';
import { Icon } from './Icon';

const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'];

type MockResponseSelection = {
  serverId?: string;
  routeId?: string;
  path?: string;
  method?: HttpMethod;
};

type MockResponseExtractorProps = {
  mockServers: MockServer[];
  response?: StoredResponse;
  liveResponse: HttpResponse;
  request: ApiRequest;
  environmentId: string;
  onApply: (result: AppliedResponseMockTarget) => void;
  onOpenMock: (serverId: string, routeId: string) => void;
  isServerRunning: (serverId: string) => boolean;
};

const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export function MockResponseExtractor({ mockServers, response: savedResponse, liveResponse, request, environmentId, onApply, onOpenMock, isServerRunning }: MockResponseExtractorProps) {
  const [selectedServerId, setSelectedServerId] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [path, setPath] = useState('/new-route');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const response = useMemo<StoredResponse | undefined>(() => savedResponse ?? (
    (request.protocol === 'http' || request.protocol === 'graphql') && liveResponse.requestUrl && liveResponse.status > 0
      ? { ...liveResponse, id: 'live-response', requestId: request.id, requestName: request.name, requestUrl: liveResponse.requestUrl, environmentId, receivedAt: '1970-01-01T00:00:00.000Z', requestSnapshot: request }
      : undefined
  ), [environmentId, liveResponse, request, savedResponse]);
  const suggestion = useMemo(() => {
    if (!response) return undefined;
    try { return { route: createMockRouteFromResponse(response, 'response-mock-suggestion') }; }
    catch (caught) { return { error: caught instanceof Error ? caught.message : String(caught) }; }
  }, [response]);
  const selectedServer = mockServers.find((server) => server.id === selectedServerId);

  useEffect(() => {
    if (!suggestion?.route) return;
    setPath(suggestion.route.path);
    setMethod(suggestion.route.method);
    setMessage('');
    setError('');
  }, [response?.id, suggestion]);

  useEffect(() => {
    if (selectedServerId && !selectedServer) {
      setSelectedServerId('');
      setSelectedRouteId('');
    } else if (selectedRouteId && !selectedServer?.routes.some((route) => route.id === selectedRouteId)) {
      setSelectedRouteId('');
    }
  }, [selectedRouteId, selectedServer, selectedServerId]);

  if (!response) return <div className="empty-state mock-response-empty"><Icon name="cube" size={42} /><strong>No response to transform</strong><span>Send an HTTP or GraphQL request, or select a saved response.</span></div>;
  if (suggestion?.error) return <div className="empty-state mock-response-empty"><Icon name="cube" size={42} /><strong>This response cannot become a mock route</strong><span>{suggestion.error}</span></div>;

  const apply = () => {
    setError('');
    setMessage('');
    try {
      const selection: MockResponseSelection = {
        serverId: selectedServerId || undefined, routeId: selectedRouteId || undefined,
        path: selectedRouteId ? undefined : path, method: selectedRouteId ? undefined : method,
      };
      const result = applyResponseToMockTarget(mockServers, response, {
        ...selection,
        newServerId: uid('mock'),
        newRouteId: uid('route'),
        newServerName: response.requestName ? `${response.requestName} mock` : 'Response mock',
      });
      onApply(result);
      const updatedServer = result.mockServers.find((server) => server.id === result.serverId);
      if (updatedServer && isServerRunning(result.serverId)) void updateMockServer(updatedServer).catch((caught) => { setMessage(''); setError(`Live mock update failed: ${caught instanceof Error ? caught.message : String(caught)}`); });
      setSelectedServerId(result.serverId);
      setSelectedRouteId(result.routeId);
      setMessage(result.action === 'overwritten-route' ? 'Mock route overwritten from this response.' : result.action === 'created-server' ? 'Local mock server and route created.' : 'Mock route created from this response.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  return (
    <section className="mock-response-extractor">
      <Icon name="cube" size={42} />
      <div className="mock-response-intro"><h3>Transform this response into a mock route</h3><p>Choose an existing local server and route to overwrite, or create either one without an account or paid plan.</p></div>
      <div className="mock-response-form">
        <label>Mock server<select aria-label="Mock response server" value={selectedServerId} onChange={(event) => { setSelectedServerId(event.target.value); setSelectedRouteId(''); setMessage(''); setError(''); }}><option value="">Create new local server</option>{mockServers.map((server) => <option key={server.id} value={server.id}>{server.name} · {server.host}:{server.port}</option>)}</select></label>
        <label>Mock route<select aria-label="Mock response route" disabled={!selectedServerId} value={selectedRouteId} onChange={(event) => { setSelectedRouteId(event.target.value); setMessage(''); setError(''); }}><option value="">Create new route</option>{selectedServer?.routes.map((route) => <option key={route.id} value={route.id}>{route.method} {route.path} · {route.name}</option>)}</select></label>
        {!selectedRouteId ? <><label>Path<input aria-label="New mock route path" value={path} onChange={(event) => setPath(event.target.value)} /></label><label>HTTP method<select aria-label="New mock route method" value={method} onChange={(event) => setMethod(event.target.value as HttpMethod)}>{methods.map((candidate) => <option key={candidate}>{candidate}</option>)}</select></label></> : null}
        <div className="mock-response-actions"><button className="primary-button" onClick={apply} type="button">{selectedRouteId ? 'Overwrite' : 'Create'}</button><button disabled={!selectedServerId || !selectedRouteId} onClick={() => onOpenMock(selectedServerId, selectedRouteId)} type="button"><Icon name="chevron-right" size={14} /> Go to mock</button></div>
      </div>
      {message ? <div className="mock-response-message" role="status">{message}</div> : null}
      {error ? <div className="mock-response-message error" role="alert">{error}</div> : null}
    </section>
  );
}
