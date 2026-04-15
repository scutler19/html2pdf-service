import { lookup } from 'node:dns/promises';
import net from 'node:net';

function isBlockedIpv4(address: string): boolean {
  const parts = address.split('.');
  if (parts.length !== 4) {
    return true;
  }
  const [a0, b0, c0, d0] = parts.map((p) => Number(p));
  if ([a0, b0, c0, d0].some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const a = a0;
  const b = b0;
  if (a === 127) {
    return true;
  }
  if (a === 10) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  return false;
}

function isBlockedIpv6(address: string): boolean {
  const addr = address.toLowerCase();
  if (addr === '::1' || addr === '0:0:0:0:0:0:0:1') {
    return true;
  }
  const m = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (m && net.isIPv4(m[1])) {
    return isBlockedIpv4(m[1]);
  }
  return false;
}

function isBlockedResolvedAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    return isBlockedIpv4(address);
  }
  if (net.isIPv6(address)) {
    return isBlockedIpv6(address);
  }
  return true;
}

export async function assertSafeUrl(url: string): Promise<string> {
  const parsed = new URL(url);
  const hostname = parsed.hostname;

  const results = await lookup(hostname, { all: true, verbatim: true });
  for (const { address } of results) {
    if (isBlockedResolvedAddress(address)) {
      throw { status: 403, message: 'URL not allowed' };
    }
  }

  return url;
}
