import type { ApiRequest, Collection, ImportWarning } from '../../types';
import { fileStem, requestFrom, sourceId, sourceMetadata } from './common';
import { emptyResources, type ArtifactImport } from './types';

const attribute = (source: string, name: string) => {
  const match = source.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match?.[2] ?? '';
};

const blocks = (source: string, tag: string) => [...source.matchAll(new RegExp(`<(?:(?:[\\w.-]+):)?${tag}\\b([^>]*)>([\\s\\S]*?)<\\/(?:(?:[\\w.-]+):)?${tag}>`, 'gi'))]
  .map((match) => ({ attributes: match[1], body: match[2] }));

export const isWsdl = (contents: string) => /<(?:(?:[\w.-]+):)?definitions\b/i.test(contents)
  && /http:\/\/schemas\.xmlsoap\.org\/wsdl\//i.test(contents);

const envelope = (operation: string, namespace: string) => `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="${namespace}">
  <soap:Header />
  <soap:Body>
    <tns:${operation}>
      <!-- Add operation parameters -->
    </tns:${operation}>
  </soap:Body>
</soap:Envelope>`;

export const importWsdl = (contents: string, sourceName: string): ArtifactImport => {
  const warnings: ImportWarning[] = [];
  const definitionsTag = contents.match(/<(?:(?:[\w.-]+):)?definitions\b([^>]*)>/i)?.[1] ?? '';
  const targetNamespace = attribute(definitionsTag, 'targetNamespace') || 'urn:brunomnia:imported';
  const serviceBlocks = blocks(contents, 'service');
  const bindingBlocks = blocks(contents, 'binding');
  const portTypeBlocks = blocks(contents, 'portType');
  const bindingOperations = new Map<string, Array<{ name: string; action: string }>>();

  for (const binding of bindingBlocks) {
    const bindingName = attribute(binding.attributes, 'name');
    const operations = blocks(binding.body, 'operation').map((operation) => {
      const actionTag = operation.body.match(/<(?:(?:[\w.-]+):)?operation\b([^>]*)\/?\s*>/i)?.[1] ?? '';
      return { name: attribute(operation.attributes, 'name'), action: attribute(actionTag, 'soapAction') };
    }).filter((operation) => operation.name);
    bindingOperations.set(bindingName, operations);
  }

  const fallbackOperations = portTypeBlocks.flatMap((portType) => blocks(portType.body, 'operation').map((operation) => ({ name: attribute(operation.attributes, 'name'), action: '' }))).filter((operation) => operation.name);
  const services = serviceBlocks.length ? serviceBlocks : [{ attributes: `name="${fileStem(sourceName)}"`, body: '' }];
  const collections: Collection[] = services.map((service, serviceIndex) => {
    const serviceName = attribute(service.attributes, 'name') || `${fileStem(sourceName)} service`;
    const port = blocks(service.body, 'port')[0];
    const bindingReference = attribute(port?.attributes ?? '', 'binding').split(':').pop() ?? '';
    const addressTag = port?.body.match(/<(?:(?:[\w.-]+):)?address\b([^>]*)\/?\s*>/i)?.[1] ?? '';
    const address = attribute(addressTag, 'location') || '{{ baseUrl }}';
    const operations = bindingOperations.get(bindingReference)
      ?? [...bindingOperations.values()].find((items) => items.length)
      ?? fallbackOperations;
    const requests: ApiRequest[] = operations.map((operation, operationIndex) => {
      const request = requestFrom('wsdl', `${serviceName}:${operation.name}`, operationIndex);
      request.name = operation.name;
      request.method = 'POST';
      request.url = address;
      request.bodyMode = 'text';
      request.body = envelope(operation.name, targetNamespace);
      request.headers = [
        { id: `${request.id}-content-type`, name: 'Content-Type', value: 'text/xml; charset=utf-8', enabled: true },
        { id: `${request.id}-soap-action`, name: 'SOAPAction', value: operation.action, enabled: Boolean(operation.action) },
        { id: `${request.id}-accept`, name: 'Accept', value: 'text/xml', enabled: true },
      ];
      request.source = sourceMetadata('wsdl', `${serviceName}:${operation.name}`, { targetNamespace, binding: bindingReference });
      return request;
    });
    if (!requests.length) warnings.push({ code: 'no-operations', message: `WSDL service '${serviceName}' had no discoverable operations.`, resource: serviceName });
    return { id: sourceId('collection', 'wsdl', serviceName, serviceIndex), name: serviceName, expanded: true, requests, source: sourceMetadata('wsdl', serviceName, { targetNamespace }) };
  });
  if (/<(?:(?:[\w.-]+):)?(?:import|include)\b/i.test(contents)) {
    warnings.push({ code: 'external-schema', message: 'Referenced WSDL/XSD imports were not loaded; generated envelopes contain parameter placeholders.' });
  }
  warnings.push({ code: 'soap-template', message: 'SOAP envelopes were generated from operations; schema-derived parameter examples require review.' });
  return { ...emptyResources(), format: 'wsdl', sourceName, warnings, metadata: { targetNamespace, services: String(collections.length) }, collections };
};
