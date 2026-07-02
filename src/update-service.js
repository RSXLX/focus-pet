const DEFAULT_UPDATE_REPO = 'RSXLX/focus-pet';
const DEFAULT_UPDATE_FEED_URL = `https://api.github.com/repos/${DEFAULT_UPDATE_REPO}/releases/latest`;
const DEFAULT_UPDATE_PAGE_URL = `https://github.com/${DEFAULT_UPDATE_REPO}/releases/latest`;

function safeHttpUrl(value) {
  const text = String(value || '').trim();
  if (!/^https?:\/\//i.test(text)) return '';
  try {
    return new URL(text).toString();
  } catch {
    return '';
  }
}

function normalizeUpdateFeedUrl(value, fallback = DEFAULT_UPDATE_FEED_URL) {
  return safeHttpUrl(value) || fallback;
}

function normalizeVersion(value) {
  const text = String(value || '').trim().replace(/^v/i, '');
  const match = text.match(/\d+(?:\.\d+){0,3}(?:-[0-9A-Za-z.-]+)?/);
  return match ? match[0] : '';
}

function versionParts(value) {
  const normalized = normalizeVersion(value) || '0.0.0';
  const [numericText, prerelease = ''] = normalized.split('-', 2);
  const numeric = numericText.split('.').map(part => Number.parseInt(part, 10)).map(part => (Number.isFinite(part) ? part : 0));
  return { numeric, prerelease };
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < Math.max(a.numeric.length, b.numeric.length, 3); index += 1) {
    const diff = (a.numeric[index] || 0) - (b.numeric[index] || 0);
    if (diff) return diff > 0 ? 1 : -1;
  }
  if (a.prerelease && !b.prerelease) return -1;
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease === b.prerelease) return 0;
  return a.prerelease > b.prerelease ? 1 : -1;
}

function releaseVersion(payload = {}) {
  return normalizeVersion(payload.version || payload.latestVersion || payload.tag_name || payload.name);
}

function releaseNotes(payload = {}) {
  return String(payload.notes || payload.body || payload.description || '').trim().slice(0, 1000);
}

function assetScore(asset = {}, platform = process.platform, arch = process.arch) {
  const name = String(asset.name || asset.label || '').toLowerCase();
  const url = safeHttpUrl(asset.browser_download_url || asset.downloadUrl || asset.url);
  if (!url) return -1;
  let score = 0;
  if (platform === 'darwin') {
    if (name.endsWith('.dmg')) score += 80;
    if (name.endsWith('.zip')) score += 35;
    if (/(^|[-_.])(mac|macos|darwin|osx)([-_.]|$)/.test(name)) score += 30;
    if (arch === 'arm64' && /(arm64|aarch64|apple[-_.]?silicon)/.test(name)) score += 24;
    if (arch === 'x64' && /(x64|x86_64|intel)/.test(name)) score += 24;
    if (arch === 'arm64' && /(x64|x86_64|intel)/.test(name)) score -= 40;
  } else if (platform === 'win32') {
    if (name.endsWith('.exe') || name.endsWith('.msi')) score += 80;
    if (name.endsWith('.zip')) score += 35;
    if (/(win|windows)/.test(name)) score += 30;
  } else {
    if (name.endsWith('.zip') || name.endsWith('.tar.gz')) score += 30;
  }
  return score;
}

function selectDownloadAsset(assets = [], platform = process.platform, arch = process.arch) {
  return (Array.isArray(assets) ? assets : [])
    .map(asset => ({ asset, score: assetScore(asset, platform, arch) }))
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score)[0]?.asset || null;
}

function normalizeReleasePayload(payload = {}, options = {}) {
  const platform = options.platform || process.platform;
  const arch = options.arch || process.arch;
  const latestVersion = releaseVersion(payload);
  const asset = selectDownloadAsset(payload.assets, platform, arch);
  const assetUrl = safeHttpUrl(asset?.browser_download_url || asset?.downloadUrl || asset?.url);
  const directUrl = safeHttpUrl(payload.downloadUrl || payload.url);
  const pageUrl = safeHttpUrl(payload.html_url || payload.pageUrl || payload.releaseUrl);
  const fallbackPage = DEFAULT_UPDATE_PAGE_URL;
  const downloadUrl = assetUrl || directUrl;

  return {
    latestVersion,
    url: pageUrl || downloadUrl || fallbackPage,
    pageUrl: pageUrl || fallbackPage,
    downloadUrl,
    assetName: asset?.name || '',
    notes: releaseNotes(payload)
  };
}

function githubLatestPageUrl(feedUrl = '') {
  const match = String(feedUrl || '').match(/^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/releases\/latest(?:[?#].*)?$/i);
  if (!match) return '';
  return `https://github.com/${match[1]}/${match[2]}/releases/latest`;
}

function releaseTagUrlFromLocation(location = '') {
  const url = safeHttpUrl(location);
  if (!url) return '';
  const match = url.match(/\/releases\/tag\/([^/?#]+)/);
  if (!match) return '';
  return url;
}

async function checkGithubLatestRedirect(options = {}) {
  const pageUrl = githubLatestPageUrl(options.feedUrl);
  if (!pageUrl) return null;
  const response = await options.fetchImpl(pageUrl, {
    method: 'HEAD',
    redirect: 'manual',
    cache: 'no-store',
    headers: {
      'user-agent': `FocusPetUpdater/${options.currentVersion || 'unknown'}`
    }
  });
  const location = response?.headers?.get?.('location') || response?.headers?.location || response?.url || '';
  const url = releaseTagUrlFromLocation(location);
  const latestVersion = normalizeVersion(url.match(/\/releases\/tag\/([^/?#]+)/)?.[1] || '');
  if (!latestVersion) return null;
  return {
    ok: true,
    currentVersion: options.currentVersion,
    latestVersion,
    available: compareVersions(latestVersion, options.currentVersion) > 0,
    url,
    pageUrl: url,
    downloadUrl: '',
    assetName: '',
    notes: '',
    checkedAt: new Date().toISOString(),
    feedUrl: options.feedUrl
  };
}

async function checkLatestVersion(options = {}) {
  const currentVersion = normalizeVersion(options.currentVersion) || '0.0.0';
  const feedUrl = normalizeUpdateFeedUrl(options.feedUrl);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('当前运行环境不支持 fetch，无法检查更新。');

  const response = await fetchImpl(feedUrl, {
    cache: 'no-store',
    headers: {
      accept: 'application/vnd.github+json, application/json',
      'user-agent': `FocusPetUpdater/${currentVersion}`
    }
  });
  if (!response?.ok) {
    const fallback = await checkGithubLatestRedirect({ currentVersion, feedUrl, fetchImpl });
    if (fallback) return fallback;
    throw new Error(`更新源请求失败：${response?.status || 'unknown'}`);
  }

  const payload = await response.json();
  const release = normalizeReleasePayload(payload, options);
  if (!release.latestVersion) {
    return {
      ok: false,
      reason: '更新源缺少版本号',
      currentVersion,
      latestVersion: '',
      available: false,
      url: '',
      downloadUrl: '',
      checkedAt: new Date().toISOString(),
      feedUrl
    };
  }

  return {
    ok: true,
    currentVersion,
    latestVersion: release.latestVersion,
    available: compareVersions(release.latestVersion, currentVersion) > 0,
    url: release.url,
    pageUrl: release.pageUrl,
    downloadUrl: release.downloadUrl,
    assetName: release.assetName,
    notes: release.notes,
    checkedAt: new Date().toISOString(),
    feedUrl
  };
}

module.exports = {
  DEFAULT_UPDATE_FEED_URL,
  DEFAULT_UPDATE_PAGE_URL,
  checkLatestVersion,
  compareVersions,
  normalizeReleasePayload,
  normalizeUpdateFeedUrl,
  normalizeVersion,
  selectDownloadAsset
};
