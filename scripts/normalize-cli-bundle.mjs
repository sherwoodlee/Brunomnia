import { readFile, writeFile } from 'node:fs/promises';

const bundlePath = new URL('../bin/brunomnia.cjs', import.meta.url);
const source = await readFile(bundlePath, 'utf8');
const licenseMarker = '\n/*! Bundled license information:\n';
const licenseIndex = source.lastIndexOf(licenseMarker);
const normalized = licenseIndex < 0
  ? source
  : `${source.slice(0, licenseIndex)}${source.slice(licenseIndex).replace(/[ \t]+$/gm, '')}`;

if (normalized !== source) await writeFile(bundlePath, normalized);
