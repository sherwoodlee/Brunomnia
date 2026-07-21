import {
  AJV_PLUGIN_MODULE_FACTORY,
  AJV_PLUGIN_MODULE_VERSION,
  UUID_PLUGIN_MODULE_FACTORY,
  UUID_PLUGIN_MODULE_VERSION,
} from './pluginVendored.generated';
import type { PluginRecord, Workspace } from '../types';

export const pluginBaselineModules = ['buffer', 'path', 'crypto'] as const;
export const pluginCuratedModules = ['events', 'uuid', 'ajv'] as const;
export const pluginModuleVersions = { uuid: UUID_PLUGIN_MODULE_VERSION, ajv: AJV_PLUGIN_MODULE_VERSION };

const aliases: Record<string, string> = {
  'node:buffer': 'buffer',
  'node:path': 'path',
  'node:crypto': 'crypto',
  'node:events': 'events',
};

export const canonicalPluginModule = (name: string) => aliases[name] ?? name;

export const pluginDependencyPackageName = (specifier: string) => {
  const value = canonicalPluginModule(String(specifier).trim());
  if (!value || value.length > 214 || value.startsWith('.') || value.startsWith('/') || value.includes('\\') || value.includes('\0')) return undefined;
  const parts = value.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return undefined;
  const packageName = value.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  if (!packageName || (value.startsWith('@') && parts.length < 2)) return undefined;
  const segments = packageName.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || !/^@?[a-zA-Z0-9_.~-]+$/.test(segment))) return undefined;
  return packageName;
};

export const validateRegistryPluginName = (pluginName: string) => {
  const suffix = pluginName.replace(/^insomnia-plugin-/, '');
  if (!suffix.trim() || suffix.length > 214) throw new Error('Plugin name must not be empty or too long.');
  if (suffix.includes('..') || suffix.includes('/') || suffix.includes('\\')) throw new Error('Plugin name must not contain path traversal characters.');
  if (/[|;&$`\\]/.test(suffix)) throw new Error('Plugin name must not contain shell metacharacters.');
  if (suffix.trim() === '-') throw new Error('Plugin name must not be a single dash.');
  if (suffix.startsWith('-')) throw new Error('Plugin name must not start with a dash.');
  if (suffix.endsWith('-')) throw new Error('Plugin name must not end with a dash.');
  if (suffix.includes('--')) throw new Error('Plugin name must not contain consecutive dashes.');
  if (suffix.startsWith('.')) throw new Error('Plugin name cannot start with a period.');
  if (suffix.startsWith('_')) throw new Error('Plugin name cannot start with an underscore.');
  if (suffix.trim() !== suffix) throw new Error('Plugin name cannot contain leading or trailing spaces.');
  if (!/^[a-zA-Z0-9_.-]+$/.test(suffix)) throw new Error('Plugin name must be alphanumeric and dash-separated.');
  if (['con', 'prn', 'aux', 'nul'].includes(suffix.toLowerCase())) throw new Error('Plugin name is not allowed.');
  if (!pluginName.startsWith('insomnia-plugin-')) throw new Error('Plugin name must start with "insomnia-plugin-".');
};

export const isRegistryPluginName = (pluginName: string) => {
  try { validateRegistryPluginName(pluginName); return true; }
  catch { return false; }
};

export const normalizePluginModules = (...values: Array<Iterable<string> | undefined>) => {
  const modules = new Set<string>();
  for (const value of values) {
    for (const entry of value ?? []) {
      const module = canonicalPluginModule(String(entry).trim());
      if (module && module.length <= 200 && !module.includes('\0')) modules.add(module);
      if (modules.size >= 100) return [...modules];
    }
  }
  return [...modules];
};

export const inferPluginModules = (source: string) => {
  const modules: string[] = [];
  for (const match of source.matchAll(/\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g)) {
    const name = canonicalPluginModule(match[2]);
    if (!name.startsWith('.') && !(pluginBaselineModules as readonly string[]).includes(name)) modules.push(name);
  }
  return normalizePluginModules(modules);
};

export const requestedPluginModules = (source: string, manifestModules: Iterable<string> = []) => normalizePluginModules(manifestModules, inferPluginModules(source))
  .filter((module) => !(pluginBaselineModules as readonly string[]).includes(module));

type PluginPackageIdentity = {
  source: string;
  moduleFiles?: Record<string, string>;
  entryModuleKey?: string;
  dependencyModuleFiles?: Record<string, string>;
  dependencyPackages?: PluginRecord['dependencyPackages'];
  requestedModules?: string[];
};

export const pluginPackageChanged = (previous: PluginPackageIdentity, next: PluginPackageIdentity) => previous.source !== next.source
  || previous.entryModuleKey !== next.entryModuleKey
  || JSON.stringify(previous.moduleFiles ?? {}) !== JSON.stringify(next.moduleFiles ?? {})
  || JSON.stringify(previous.dependencyModuleFiles ?? {}) !== JSON.stringify(next.dependencyModuleFiles ?? {})
  || JSON.stringify(previous.dependencyPackages ?? {}) !== JSON.stringify(next.dependencyPackages ?? {})
  || JSON.stringify(previous.requestedModules ?? []) !== JSON.stringify(next.requestedModules ?? []);

export const retainedPluginModuleGrants = (grantedModules: Iterable<string> = [], requestedModules: Iterable<string> = []) => {
  const requested = new Set(normalizePluginModules(requestedModules));
  return normalizePluginModules(grantedModules).filter((module) => requested.has(module));
};

export type ReviewedPluginInstallResult = {
  workspace: Workspace;
  plugin: PluginRecord;
  replaced: boolean;
  changed: boolean;
};

export const installReviewedPlugin = (workspace: Workspace, candidate: PluginRecord): ReviewedPluginInstallResult => {
  const index = candidate.registryPackageName
    ? workspace.plugins.findIndex((plugin) => plugin.registryPackageName === candidate.registryPackageName)
    : -1;
  if (index < 0) {
    return { workspace: { ...workspace, plugins: [...workspace.plugins, candidate] }, plugin: candidate, replaced: false, changed: true };
  }
  const previous = workspace.plugins[index];
  const changed = pluginPackageChanged(previous, candidate);
  const plugin: PluginRecord = changed
    ? { ...candidate, id: previous.id }
    : {
        ...candidate,
        id: previous.id,
        enabled: previous.enabled,
        grantedModules: retainedPluginModuleGrants(previous.grantedModules, candidate.requestedModules),
        grantedPermissions: [...previous.grantedPermissions],
        installedAt: previous.installedAt,
      };
  const plugins = [...workspace.plugins];
  plugins[index] = plugin;
  if (!changed) return { workspace: { ...workspace, plugins }, plugin, replaced: true, changed: false };
  const pluginData = { ...workspace.pluginData };
  delete pluginData[previous.id];
  return {
    workspace: {
      ...workspace,
      plugins,
      pluginData,
      activePluginTheme: workspace.activePluginTheme.startsWith(`${previous.id}::`) ? '' : workspace.activePluginTheme,
    },
    plugin,
    replaced: true,
    changed: true,
  };
};

const pathFactory = `function () {
  return {
    sep: '/',
    basename: function (value) { var parts = String(value).split('/'); return parts[parts.length - 1]; },
    extname: function (value) { var name = String(value).split('/').pop(); var index = name.lastIndexOf('.'); return index > 0 ? name.slice(index) : ''; },
    join: function () { return Array.prototype.slice.call(arguments).join('/').replace(/\\/+/g, '/'); }
  };
}`;

const eventsFactory = `function () {
  function EventEmitter() { this._events = Object.create(null); }
  EventEmitter.prototype.on = function (type, fn) { (this._events[type] = this._events[type] || []).push(fn); return this; };
  EventEmitter.prototype.addListener = EventEmitter.prototype.on;
  EventEmitter.prototype.once = function (type, fn) { var self = this; function once() { self.removeListener(type, once); fn.apply(this, arguments); } once.listener = fn; return this.on(type, once); };
  EventEmitter.prototype.removeListener = function (type, fn) { var list = this._events[type]; if (!list) return this; for (var i = list.length - 1; i >= 0; i--) if (list[i] === fn || list[i].listener === fn) list.splice(i, 1); return this; };
  EventEmitter.prototype.removeAllListeners = function (type) { if (type === undefined) this._events = Object.create(null); else delete this._events[type]; return this; };
  EventEmitter.prototype.listeners = function (type) { return (this._events[type] || []).slice(); };
  EventEmitter.prototype.emit = function (type) { var list = this._events[type]; if (!list || !list.length) return false; var args = Array.prototype.slice.call(arguments, 1); list.slice().forEach(function (fn) { fn.apply(this, args); }, this); return true; };
  return { EventEmitter: EventEmitter };
}`;

const cryptoFactory = `function () {
  var inputBytes = function (value, encoding) {
    if (value instanceof Uint8Array) return new Uint8Array(value);
    var text = String(value == null ? '' : value); if (text.length > 5000000) throw new Error('Plugin crypto input exceeds 5 MB.');
    if (encoding === 'hex') { var hex = text.replace(/[^0-9a-f]/gi, ''); return new Uint8Array((hex.match(/.{1,2}/g) || []).map(function (part) { return parseInt(part, 16); })); }
    if (encoding === 'base64') return new Uint8Array(Array.from(atob(text), function (character) { return character.charCodeAt(0); }));
    if (encoding === 'latin1' || encoding === 'binary') return new Uint8Array(Array.from(text, function (character) { return character.charCodeAt(0) & 255; }));
    return new TextEncoder().encode(text);
  };
  var concat = function (parts) { var length = parts.reduce(function (sum, part) { return sum + part.length; }, 0); if (length > 5000000) throw new Error('Plugin crypto input exceeds 5 MB.'); var output = new Uint8Array(length); var offset = 0; parts.forEach(function (part) { output.set(part, offset); offset += part.length; }); return output; };
  var sha256 = function (bytes) {
    var constants = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
    var paddedLength = Math.ceil((bytes.length + 9) / 64) * 64; var padded = new Uint8Array(paddedLength); padded.set(bytes); padded[bytes.length] = 128; var bits = bytes.length * 8; for (var bi = 0; bi < 8; bi++) padded[paddedLength - 1 - bi] = Math.floor(bits / Math.pow(2, bi * 8)) & 255;
    var hash = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]); var rotate = function (value, amount) { return value >>> amount | value << 32 - amount; };
    for (var offset = 0; offset < padded.length; offset += 64) { var words = new Uint32Array(64); for (var wi = 0; wi < 16; wi++) words[wi] = padded[offset+wi*4]<<24|padded[offset+wi*4+1]<<16|padded[offset+wi*4+2]<<8|padded[offset+wi*4+3]; for (wi=16;wi<64;wi++){var x=rotate(words[wi-15],7)^rotate(words[wi-15],18)^words[wi-15]>>>3;var y=rotate(words[wi-2],17)^rotate(words[wi-2],19)^words[wi-2]>>>10;words[wi]=(words[wi-16]+x+words[wi-7]+y)>>>0;} var a=hash[0],b=hash[1],c=hash[2],d=hash[3],e=hash[4],f=hash[5],g=hash[6],h=hash[7]; for(wi=0;wi<64;wi++){var s1=rotate(e,6)^rotate(e,11)^rotate(e,25);var choice=e&f^~e&g;var t1=(h+s1+choice+constants[wi]+words[wi])>>>0;var s0=rotate(a,2)^rotate(a,13)^rotate(a,22);var majority=a&b^a&c^b&c;var t2=(s0+majority)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;} [a,b,c,d,e,f,g,h].forEach(function(value,index){hash[index]=(hash[index]+value)>>>0;}); }
    var output = new Uint8Array(32); hash.forEach(function (value, index) { output[index*4]=value>>>24; output[index*4+1]=value>>>16; output[index*4+2]=value>>>8; output[index*4+3]=value; }); return output;
  };
  var sha1 = function (bytes) {
    var paddedLength = Math.ceil((bytes.length + 9) / 64) * 64; var padded = new Uint8Array(paddedLength); padded.set(bytes); padded[bytes.length] = 128; var bits = bytes.length * 8; for (var bi=0;bi<8;bi++) padded[paddedLength-1-bi]=Math.floor(bits/Math.pow(2,bi*8))&255;
    var hash = new Uint32Array([0x67452301,0xefcdab89,0x98badcfe,0x10325476,0xc3d2e1f0]); var rotate=function(value,amount){return value<<amount|value>>>32-amount;};
    for(var offset=0;offset<padded.length;offset+=64){var words=new Uint32Array(80);for(var wi=0;wi<16;wi++)words[wi]=padded[offset+wi*4]<<24|padded[offset+wi*4+1]<<16|padded[offset+wi*4+2]<<8|padded[offset+wi*4+3];for(wi=16;wi<80;wi++)words[wi]=rotate(words[wi-3]^words[wi-8]^words[wi-14]^words[wi-16],1);var a=hash[0],b=hash[1],c=hash[2],d=hash[3],e=hash[4];for(wi=0;wi<80;wi++){var f,k;if(wi<20){f=b&c|~b&d;k=0x5a827999;}else if(wi<40){f=b^c^d;k=0x6ed9eba1;}else if(wi<60){f=b&c|b&d|c&d;k=0x8f1bbcdc;}else{f=b^c^d;k=0xca62c1d6;}var temporary=(rotate(a,5)+f+e+k+words[wi])>>>0;e=d;d=c;c=rotate(b,30)>>>0;b=a;a=temporary;}hash[0]=(hash[0]+a)>>>0;hash[1]=(hash[1]+b)>>>0;hash[2]=(hash[2]+c)>>>0;hash[3]=(hash[3]+d)>>>0;hash[4]=(hash[4]+e)>>>0;}
    var output=new Uint8Array(20);hash.forEach(function(value,index){output[index*4]=value>>>24;output[index*4+1]=value>>>16;output[index*4+2]=value>>>8;output[index*4+3]=value;});return output;
  };
  var md5 = function (bytes) {
    var paddedLength=Math.ceil((bytes.length+9)/64)*64;var padded=new Uint8Array(paddedLength);padded.set(bytes);padded[bytes.length]=128;var bits=bytes.length*8;for(var bi=0;bi<8;bi++)padded[paddedLength-8+bi]=Math.floor(bits/Math.pow(2,bi*8))&255;
    var shifts=[7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];var constants=new Uint32Array(64);for(var ci=0;ci<64;ci++)constants[ci]=Math.floor(Math.abs(Math.sin(ci+1))*4294967296)>>>0;var hash=new Uint32Array([0x67452301,0xefcdab89,0x98badcfe,0x10325476]);var rotate=function(value,amount){return value<<amount|value>>>32-amount;};
    for(var offset=0;offset<padded.length;offset+=64){var words=new Uint32Array(16);for(var wi=0;wi<16;wi++)words[wi]=padded[offset+wi*4]|padded[offset+wi*4+1]<<8|padded[offset+wi*4+2]<<16|padded[offset+wi*4+3]<<24;var a=hash[0],b=hash[1],c=hash[2],d=hash[3];for(var i=0;i<64;i++){var f,g;if(i<16){f=b&c|~b&d;g=i;}else if(i<32){f=d&b|~d&c;g=(5*i+1)%16;}else if(i<48){f=b^c^d;g=(3*i+5)%16;}else{f=c^(b|~d);g=7*i%16;}var previous=d;d=c;c=b;b=(b+rotate((a+f+constants[i]+words[g])>>>0,shifts[i]))>>>0;a=previous;}hash[0]=(hash[0]+a)>>>0;hash[1]=(hash[1]+b)>>>0;hash[2]=(hash[2]+c)>>>0;hash[3]=(hash[3]+d)>>>0;}
    var output=new Uint8Array(16);hash.forEach(function(value,index){output[index*4]=value;output[index*4+1]=value>>>8;output[index*4+2]=value>>>16;output[index*4+3]=value>>>24;});return output;
  };
  var sha512 = function (bytes, short) {
    var mask=(1n<<64n)-1n;var rotate=function(value,amount){var shift=BigInt(amount);return(value>>shift|value<<(64n-shift))&mask;};
    var constants=['428a2f98d728ae22','7137449123ef65cd','b5c0fbcfec4d3b2f','e9b5dba58189dbbc','3956c25bf348b538','59f111f1b605d019','923f82a4af194f9b','ab1c5ed5da6d8118','d807aa98a3030242','12835b0145706fbe','243185be4ee4b28c','550c7dc3d5ffb4e2','72be5d74f27b896f','80deb1fe3b1696b1','9bdc06a725c71235','c19bf174cf692694','e49b69c19ef14ad2','efbe4786384f25e3','0fc19dc68b8cd5b5','240ca1cc77ac9c65','2de92c6f592b0275','4a7484aa6ea6e483','5cb0a9dcbd41fbd4','76f988da831153b5','983e5152ee66dfab','a831c66d2db43210','b00327c898fb213f','bf597fc7beef0ee4','c6e00bf33da88fc2','d5a79147930aa725','06ca6351e003826f','142929670a0e6e70','27b70a8546d22ffc','2e1b21385c26c926','4d2c6dfc5ac42aed','53380d139d95b3df','650a73548baf63de','766a0abb3c77b2a8','81c2c92e47edaee6','92722c851482353b','a2bfe8a14cf10364','a81a664bbc423001','c24b8b70d0f89791','c76c51a30654be30','d192e819d6ef5218','d69906245565a910','f40e35855771202a','106aa07032bbd1b8','19a4c116b8d2d0c8','1e376c085141ab53','2748774cdf8eeb99','34b0bcb5e19b48a8','391c0cb3c5c95a63','4ed8aa4ae3418acb','5b9cca4f7763e373','682e6ff3d6b2b8a3','748f82ee5defb2fc','78a5636f43172f60','84c87814a1f0ab72','8cc702081a6439ec','90befffa23631e28','a4506cebde82bde9','bef9a3f7b2c67915','c67178f2e372532b','ca273eceea26619c','d186b8c721c0c207','eada7dd6cde0eb1e','f57d4f7fee6ed178','06f067aa72176fba','0a637dc5a2c898a6','113f9804bef90dae','1b710b35131c471b','28db77f523047d84','32caab7b40c72493','3c9ebe0a15c9bebc','431d67c49c100d4c','4cc5d4becb3e42b6','597f299cfc657e2a','5fcb6fab3ad6faec','6c44198c4a475817'].map(function(value){return BigInt('0x'+value);});
    var initial=short?['cbbb9d5dc1059ed8','629a292a367cd507','9159015a3070dd17','152fecd8f70e5939','67332667ffc00b31','8eb44a8768581511','db0c2e0d64f98fa7','47b5481dbefa4fa4']:['6a09e667f3bcc908','bb67ae8584caa73b','3c6ef372fe94f82b','a54ff53a5f1d36f1','510e527fade682d1','9b05688c2b3e6c1f','1f83d9abfb41bd6b','5be0cd19137e2179'];var hash=initial.map(function(value){return BigInt('0x'+value);});
    var paddedLength=Math.ceil((bytes.length+17)/128)*128;var padded=new Uint8Array(paddedLength);padded.set(bytes);padded[bytes.length]=128;var bits=BigInt(bytes.length)*8n;for(var bi=0;bi<8;bi++)padded[paddedLength-1-bi]=Number(bits>>BigInt(bi*8)&255n);
    for(var offset=0;offset<padded.length;offset+=128){var words=new Array(80);for(var wi=0;wi<16;wi++){var word=0n;for(var byte=0;byte<8;byte++)word=word<<8n|BigInt(padded[offset+wi*8+byte]);words[wi]=word;}for(wi=16;wi<80;wi++){var x=rotate(words[wi-15],1)^rotate(words[wi-15],8)^words[wi-15]>>7n;var y=rotate(words[wi-2],19)^rotate(words[wi-2],61)^words[wi-2]>>6n;words[wi]=(words[wi-16]+x+words[wi-7]+y)&mask;}var a=hash[0],b=hash[1],c=hash[2],d=hash[3],e=hash[4],f=hash[5],g=hash[6],h=hash[7];for(wi=0;wi<80;wi++){var s1=rotate(e,14)^rotate(e,18)^rotate(e,41);var choice=e&f^~e&g;var t1=(h+s1+choice+constants[wi]+words[wi])&mask;var s0=rotate(a,28)^rotate(a,34)^rotate(a,39);var majority=a&b^a&c^b&c;var t2=(s0+majority)&mask;h=g;g=f;f=e;e=(d+t1)&mask;d=c;c=b;b=a;a=(t1+t2)&mask;}hash[0]=(hash[0]+a)&mask;hash[1]=(hash[1]+b)&mask;hash[2]=(hash[2]+c)&mask;hash[3]=(hash[3]+d)&mask;hash[4]=(hash[4]+e)&mask;hash[5]=(hash[5]+f)&mask;hash[6]=(hash[6]+g)&mask;hash[7]=(hash[7]+h)&mask;}
    var wordsOut=short?6:8;var output=new Uint8Array(wordsOut*8);for(var oi=0;oi<wordsOut;oi++)for(var byte=0;byte<8;byte++)output[oi*8+byte]=Number(hash[oi]>>BigInt((7-byte)*8)&255n);return output;
  };
  var digestOutput = function (bytes, encoding) { var buffer = SafeBuffer.from(bytes); return encoding === undefined ? buffer : buffer.toString(encoding); };
  var digest = function (algorithm, bytes) { var normalized = String(algorithm).toLowerCase().replace(/-/g, ''); if(normalized==='md5')return md5(bytes);if(normalized==='sha1')return sha1(bytes);if(normalized==='sha256')return sha256(bytes);if(normalized==='sha384')return sha512(bytes,true);if(normalized==='sha512')return sha512(bytes,false);throw new Error("Plugin crypto algorithm '" + algorithm + "' is not available."); };
  var digester = function (algorithm, key) { var parts = []; var api = { update: function (value, encoding) { parts.push(inputBytes(value, encoding)); return api; }, digest: function (encoding) { var bytes = concat(parts); if (key) { var normalized=String(algorithm).toLowerCase().replace(/-/g,'');var blockSize=normalized==='sha384'||normalized==='sha512'?128:64;var block = new Uint8Array(blockSize); var keyBytes = key.length > blockSize ? digest(algorithm, key) : key; block.set(keyBytes); var outer = new Uint8Array(blockSize), inner = new Uint8Array(blockSize); for (var i=0;i<blockSize;i++){outer[i]=block[i]^92;inner[i]=block[i]^54;} bytes = digest(algorithm, concat([outer, digest(algorithm, concat([inner, bytes]))])); } else bytes = digest(algorithm, bytes); return digestOutput(bytes, encoding); } }; return api; };
  return {
    createHash: function (algorithm) { return digester(algorithm); },
    createHmac: function (algorithm, key) { return digester(algorithm, inputBytes(key)); },
    randomBytes: function (size) { size = Math.max(0, Math.min(Math.floor(Number(size)) || 0, 65536)); var bytes = new Uint8Array(size); if(size)crypto.getRandomValues(bytes); return SafeBuffer.from(bytes); },
    randomUUID: function () { return crypto.randomUUID(); }
  };
}`;

const definitions = [
  { name: 'buffer', aliases: ['node:buffer'], factory: `function () { return { Buffer: SafeBuffer }; }` },
  { name: 'path', aliases: ['node:path'], factory: pathFactory },
  { name: 'crypto', aliases: ['node:crypto'], factory: cryptoFactory },
  { name: 'events', aliases: ['node:events'], factory: eventsFactory },
  { name: 'uuid', aliases: [], factory: UUID_PLUGIN_MODULE_FACTORY, heavy: true },
  { name: 'ajv', aliases: [], factory: AJV_PLUGIN_MODULE_FACTORY, heavy: true },
];

export const buildPluginModuleRegistrySource = (grantedModules: string[], identifier: string) => {
  const effective = new Set<string>([...pluginBaselineModules, ...grantedModules.map(canonicalPluginModule)]);
  const factories = `${identifier}_moduleFactories`;
  const moduleAliases = `${identifier}_moduleAliases`;
  const moduleCache = `${identifier}_moduleCache`;
  const grants = `${identifier}_moduleGrants`;
  const safeRequire = `${identifier}_safeRequire`;
  const registrations = definitions
    .filter((definition) => !definition.heavy || effective.has(definition.name))
    .map((definition) => `${factories}.set(${JSON.stringify(definition.name)}, ${definition.factory}); ${[definition.name, ...definition.aliases].map((name) => `${moduleAliases}.set(${JSON.stringify(name)}, ${JSON.stringify(definition.name)});`).join(' ')}`)
    .join('\n');
  return {
    safeRequire,
    source: `
  const ${factories} = new Map();
  const ${moduleAliases} = new Map();
  const ${moduleCache} = new Map();
  const ${grants} = new Set(${JSON.stringify([...effective])});
  ${registrations}
  const ${safeRequire} = name => {
    const requested = String(name); const canonical = ${moduleAliases}.get(requested) || requested;
    if (!${grants}.has(canonical)) throw new Error("Module '" + requested + "' not permitted by manifest");
    if (${moduleCache}.has(canonical)) return ${moduleCache}.get(canonical);
    const factory = ${factories}.get(canonical);
    if (!factory) throw new Error("Module '" + requested + "' not available in sandbox");
    const value = factory(); ${moduleCache}.set(canonical, value); return value;
  };
`,
  };
};
