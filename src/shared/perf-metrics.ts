type MetricStat = {
  count: number;
  sumMs: number;
  maxMs: number;
};

type SeriesPoint = {
  t: number; // unix epoch seconds
  count: number;
  avgMs: number;
  maxMs: number;
};

type SummaryRow = {
  metric: string;
  count: number;
  avgMs: number;
  maxMs: number;
};

export type PerfMetricsReport = {
  enabled: boolean;
  now: number; // unix epoch ms
  retentionSec: number;
  windowSec: number;
  seriesMetric: string;
  series: SeriesPoint[];
  summary: SummaryRow[];
};

const isDebug = process.env.NODE_ENV !== "production";

const isPerfMetricsEnabled = (() => {
  const raw = String(process.env.BOT_METRICS ?? "")
    .toLowerCase()
    .trim();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;

  // Default: on in production, off in dev unless explicitly enabled.
  return !isDebug;
})();

const RETENTION_SEC = 10 * 60;

// buckets[epochSecond][metric] -> stats
const buckets = new Map<number, Map<string, MetricStat>>();

const toSafeMetricName = (value: string) => {
  const v = value.trim();
  if (v.length === 0) return null;
  if (v.length > 128) return null;
  return v;
};

const getOrCreateBucket = (t: number) => {
  const existing = buckets.get(t);
  if (existing) return existing;

  const created = new Map<string, MetricStat>();
  buckets.set(t, created);

  // Prune old buckets on new-second creation.
  const cutoff = t - RETENTION_SEC;
  for (const key of buckets.keys()) {
    if (key >= cutoff) break;
    buckets.delete(key);
  }

  return created;
};

const record = (metricRaw: string, durationMs: number) => {
  if (!isPerfMetricsEnabled) return;

  const metric = toSafeMetricName(metricRaw);
  if (!metric) return;

  if (!Number.isFinite(durationMs) || durationMs < 0) return;

  const nowSec = Math.floor(Date.now() / 1000);
  const bucket = getOrCreateBucket(nowSec);
  const stat = bucket.get(metric) ?? { count: 0, sumMs: 0, maxMs: 0 };

  stat.count += 1;
  stat.sumMs += durationMs;
  if (durationMs > stat.maxMs) stat.maxMs = durationMs;

  bucket.set(metric, stat);
};

const span = (metric: string) => {
  if (!isPerfMetricsEnabled) return () => {};

  const startNs = process.hrtime.bigint();
  let ended = false;

  return () => {
    if (ended) return;
    ended = true;
    const endNs = process.hrtime.bigint();
    const durationMs = Number(endNs - startNs) / 1_000_000;
    record(metric, durationMs);
  };
};

const clampInt = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) => {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : NaN;

  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
};

const buildSeries = (metric: string, nowSec: number, windowSec: number) => {
  const points: SeriesPoint[] = [];

  const start = nowSec - windowSec + 1;
  for (let t = start; t <= nowSec; t++) {
    const stat = buckets.get(t)?.get(metric);
    const count = stat?.count ?? 0;
    const sumMs = stat?.sumMs ?? 0;
    const maxMs = stat?.maxMs ?? 0;
    points.push({
      t,
      count,
      avgMs: count > 0 ? sumMs / count : 0,
      maxMs,
    });
  }

  return points;
};

const buildSummary = (nowSec: number, windowSec: number) => {
  const acc = new Map<string, MetricStat>();

  const start = nowSec - windowSec + 1;
  for (let t = start; t <= nowSec; t++) {
    const bucket = buckets.get(t);
    if (!bucket) continue;

    for (const [metric, s] of bucket.entries()) {
      const current = acc.get(metric) ?? { count: 0, sumMs: 0, maxMs: 0 };
      current.count += s.count;
      current.sumMs += s.sumMs;
      if (s.maxMs > current.maxMs) current.maxMs = s.maxMs;
      acc.set(metric, current);
    }
  }

  const rows: SummaryRow[] = [];
  for (const [metric, s] of acc.entries()) {
    if (s.count <= 0) continue;
    rows.push({
      metric,
      count: s.count,
      avgMs: s.sumMs / s.count,
      maxMs: s.maxMs,
    });
  }

  rows.sort((a, b) => {
    if (b.maxMs !== a.maxMs) return b.maxMs - a.maxMs;
    if (b.avgMs !== a.avgMs) return b.avgMs - a.avgMs;
    return b.count - a.count;
  });

  return rows;
};

export const perfMetrics = {
  enabled: () => isPerfMetricsEnabled,

  record,
  span,

  getReport: (params?: { windowSec?: unknown; seriesMetric?: unknown }) => {
    const windowSec = clampInt(params?.windowSec, 60, 10, RETENTION_SEC);
    const seriesMetric =
      typeof params?.seriesMetric === "string" &&
      params.seriesMetric.trim().length > 0
        ? params.seriesMetric.trim()
        : "telegram.update.total";

    const now = Date.now();
    const nowSec = Math.floor(now / 1000);

    if (!isPerfMetricsEnabled) {
      return {
        enabled: false,
        now,
        retentionSec: RETENTION_SEC,
        windowSec,
        seriesMetric,
        series: buildSeries(seriesMetric, nowSec, windowSec),
        summary: [],
      } satisfies PerfMetricsReport;
    }

    return {
      enabled: true,
      now,
      retentionSec: RETENTION_SEC,
      windowSec,
      seriesMetric,
      series: buildSeries(seriesMetric, nowSec, windowSec),
      summary: buildSummary(nowSec, windowSec).slice(0, 50),
    } satisfies PerfMetricsReport;
  },
};
