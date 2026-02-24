
const mode = process.env.SITE_MODE || 'oss';
const base = process.env.BASE_URL || 'http://localhost:3000';

const expectedByMode = {
  oss: ['/', '/docs', '/gallery', '/download'],
  enterprise: ['/', '/enterprise', '/contact'],
};

const expected = expectedByMode[mode];
if (!expected) {
  console.error(`Unknown SITE_MODE '${mode}'. Expected one of: ${Object.keys(expectedByMode).join(', ')}`);
  process.exit(1);
}

async function checkRoute(route) {
  const url = `${base}${route}`;
  const res = await fetch(url, { redirect: 'manual' });
  if (res.status >= 400) {
    throw new Error(`${route} returned ${res.status}`);
  }
}

async function checkMetadata() {
  const robotsUrl = `${base}/robots.txt`;
  const sitemapUrl = `${base}/sitemap.xml`;
  const [robotsRes, sitemapRes] = await Promise.all([fetch(robotsUrl), fetch(sitemapUrl)]);
  const robotsText = await robotsRes.text();
  const sitemapText = await sitemapRes.text();

  const expectedHost = mode === 'enterprise' ? 'ready-layer.com' : 'reach-cli.com';
  const otherHost = mode === 'enterprise' ? 'reach-cli.com' : 'ready-layer.com';

  if (!robotsText.includes(expectedHost) || robotsText.includes(otherHost)) {
    throw new Error(`robots.txt host mismatch for mode=${mode}`);
  }
  if (!sitemapText.includes(expectedHost) || sitemapText.includes(otherHost)) {
    throw new Error(`sitemap.xml host mismatch for mode=${mode}`);
  }
}

(async () => {
  for (const route of expected) {
    await checkRoute(route);
  }
  await checkMetadata();
  console.log(`check-mode-links: ${mode} mode routes + metadata OK (${expected.length} routes).`);
})();
