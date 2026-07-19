const http = require('node:http');

const host = '127.0.0.1';
const port = Number(process.env.BRUNOMNIA_CLI_SMOKE_PORT ?? 43_199);

const json = (response, status, value, headers = {}) => {
  response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  response.end(JSON.stringify(value));
};

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/seed') {
    json(response, 200, { token: 'dependency-token' }, { 'Set-Cookie': 'session=cli-cookie; Path=/; HttpOnly; SameSite=Lax' });
    return;
  }
  if (request.method === 'POST' && request.url === '/verify') {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { json(response, 400, { error: 'invalid JSON' }); return; }
      json(response, 200, {
        file: body.file,
        os: request.headers['x-template-os'],
        hash: request.headers['x-template-hash'],
        date: request.headers['x-template-date'],
        chain: request.headers['x-template-chain'],
        cookie: request.headers.cookie ?? '',
      });
      setImmediate(() => server.close());
    });
    return;
  }
  json(response, 404, { error: 'not found' });
});

server.listen(port, host, () => {
  const address = server.address();
  process.stdout.write(`READY http://${host}:${typeof address === 'object' && address ? address.port : port}\n`);
});
server.on('error', (error) => { process.stderr.write(`${error.stack ?? error.message}\n`); process.exitCode = 1; });
setTimeout(() => server.close(), 60_000).unref();
