import { UAParser } from 'ua-parser-js';

/**
 * Parses user agent string and extracts structured device metadata
 */
export function parseDevice(userAgentString = '') {
  const parser = new UAParser(userAgentString);
  const result = parser.getResult();

  const browserName = result.browser.name || 'Unknown Browser';
  const browserVersion = result.browser.version ? ` ${result.browser.version.split('.')[0]}` : '';
  const osName = result.os.name || 'Unknown OS';
  const osVersion = result.os.version ? ` ${result.os.version}` : '';

  let deviceType = 'desktop';
  if (result.device.type === 'mobile') {
    deviceType = 'mobile';
  } else if (result.device.type === 'tablet') {
    deviceType = 'tablet';
  }

  return {
    raw: userAgentString,
    browser: `${browserName}${browserVersion}`.trim(),
    os: `${osName}${osVersion}`.trim(),
    deviceType,
    model: result.device.model || undefined,
    vendor: result.device.vendor || undefined,
  };
}
