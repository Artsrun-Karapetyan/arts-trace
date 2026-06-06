export function buildEnvironmentAnalytics(userAgents: Array<string | null>): {
  browsers: Array<{ name: string; count: number; percent: number }>;
  os: Array<{ name: string; count: number; percent: number }>;
  devices: Array<{ name: string; count: number; percent: number }>;
} {
  const browserCounts = new Map<string, number>();
  const osCounts = new Map<string, number>();
  const deviceCounts = new Map<string, number>();

  let total = 0;
  for (const raw of userAgents) {
    if (!raw) continue;
    total += 1;
    const browser = detectBrowser(raw);
    const os = detectOs(raw);
    const device = detectDevice(raw);
    browserCounts.set(browser, (browserCounts.get(browser) ?? 0) + 1);
    osCounts.set(os, (osCounts.get(os) ?? 0) + 1);
    deviceCounts.set(device, (deviceCounts.get(device) ?? 0) + 1);
  }

  return {
    browsers: toSortedPercentList(browserCounts, total),
    os: toSortedPercentList(osCounts, total),
    devices: toSortedPercentList(deviceCounts, total),
  };
}

export function toSortedPercentList(
  counts: Map<string, number>,
  total: number,
): Array<{ name: string; count: number; percent: number }> {
  if (total === 0) return [];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      percent: Math.round((count / total) * 100),
    }));
}

export function detectBrowser(ua: string): string {
  const s = ua.toLowerCase();
  if (s.includes("edg/")) return "Edge";
  if (s.includes("opr/") || s.includes("opera")) return "Opera";
  if (s.includes("firefox/")) return "Firefox";
  if (s.includes("chrome/") && !s.includes("edg/") && !s.includes("opr/"))
    return "Chrome";
  if (s.includes("safari/") && !s.includes("chrome/")) return "Safari";
  return "Other";
}

export function detectOs(ua: string): string {
  const s = ua.toLowerCase();
  if (s.includes("windows")) return "Windows";
  if (s.includes("mac os") || s.includes("macintosh")) return "macOS";
  if (s.includes("android")) return "Android";
  if (s.includes("iphone") || s.includes("ipad") || s.includes("ios"))
    return "iOS";
  if (s.includes("linux")) return "Linux";
  return "Other";
}

export function detectDevice(ua: string): string {
  const s = ua.toLowerCase();
  if (s.includes("ipad") || s.includes("tablet")) return "Tablet";
  if (s.includes("mobi") || s.includes("iphone") || s.includes("android"))
    return "Mobile";
  return "Desktop";
}
