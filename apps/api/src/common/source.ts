import { prisma } from "@artstrace/database";
import type { RawSourceMap } from "source-map-js";
import { SourceMapConsumer } from "source-map-js";

export const sourceMapCache = new Map<string, string>();

export type ResolvedSource = {
  fileName: string;
  line: number;
  column: number;
  sourceContext?: SourceContext | null;
};

export type SourceContext = {
  fileName: string;
  line: number;
  column: number;
  lines: Array<{
    number: number;
    text: string;
    highlight: boolean;
  }>;
};

export async function getSource({
  projectId,
  release,
  filePath,
  fileName,
  line,
  column,
  stack,
}: {
  projectId: string;
  release: string | undefined;
  filePath?: string;
  fileName?: string;
  line?: number;
  column?: number;
  stack?: string;
}): Promise<ResolvedSource | null> {
  if (!release) {
    if (filePath && line && column) {
      const mapped = await mapWithInlineSourceMap(filePath, line, column);
      if (mapped) return mapped;
    }
    if (fileName && line && column) {
      return { fileName, line, column };
    }
    return extractSourceFromStack(stack);
  }

  if (projectId && release && filePath && line && column) {
    const mapped = await mapWithSourceMap(
      projectId,
      release,
      filePath,
      line,
      column,
    );
    if (mapped) return mapped;
  }

  // Prod fallback when sourcemap was not found.
  const fromStack = extractSourceFromStack(stack);
  if (fromStack) return fromStack;

  if (fileName && line && column) {
    return { fileName, line, column };
  }

  return null;
}

export function extractSourceFromStack(stack?: string): ResolvedSource | null {
  if (!stack) return null;

  const frames = stack
    .split("\n")
    .map((item) => item.trim())
    .map(parseStackFrame)
    .filter(
      (item): item is { filePath: string; line: number; column: number } =>
        item !== null,
    );

  if (frames.length === 0) return null;

  const preferred = frames.find((frame) => isPreferredFrame(frame.filePath));
  const selected = preferred ?? frames[0];
  const fileName = selected.filePath.split("/").pop() ?? selected.filePath;

  return {
    fileName,
    line: selected.line,
    column: selected.column,
  };
}

export function parseStackFrame(
  line: string,
): { filePath: string; line: number; column: number } | null {
  const match = line.match(/((?:https?:\/\/|\/)[^)\s]+):(\d+):(\d+)/);
  if (!match) return null;

  const filePath = match[1];
  const lineNumber = Number(match[2]);
  const columnNumber = Number(match[3]);

  if (Number.isNaN(lineNumber) || Number.isNaN(columnNumber)) return null;

  return {
    filePath,
    line: lineNumber,
    column: columnNumber,
  };
}

export function isPreferredFrame(filePath: string): boolean {
  const lowered = filePath.toLowerCase();
  const blockedTokens = [
    "/node_modules/",
    "react-dom",
    "scheduler",
    "@vite",
    "/vite/",
    "chunk-",
    "internal/",
    "webpack",
  ];

  return !blockedTokens.some((token) => lowered.includes(token));
}

export async function mapWithInlineSourceMap(
  filePath: string,
  line: number,
  column: number,
): Promise<ResolvedSource | null> {
  try {
    const mapRaw = await loadInlineSourceMap(filePath);
    if (!mapRaw) return null;
    return getOriginalPosition(mapRaw, line, column);
  } catch {
    return null;
  }
}

export async function mapWithSourceMap(
  projectId: string,
  release: string,
  filePath: string,
  line: number,
  column: number,
): Promise<ResolvedSource | null> {
  try {
    const mapRaw = await loadSourceMapFromDb(projectId, release, filePath);
    if (!mapRaw) return null;
    return getOriginalPosition(mapRaw, line, column);
  } catch {
    return null;
  }
}

export function getOriginalPosition(
  mapRaw: string,
  line: number,
  column: number,
): ResolvedSource | null {
  const map = JSON.parse(mapRaw) as RawSourceMap;
  const consumer = new SourceMapConsumer(map);
  const original = consumer.originalPositionFor({ line, column });
  if (!original.source || !original.line || original.column == null)
    return null;

  const fileName = original.source.split("/").pop() ?? original.source;
  const sourceContent = getSourceContent(map, original.source);

  return {
    fileName,
    line: original.line,
    column: original.column,
    sourceContext: sourceContent
      ? buildSourceContext(
          fileName,
          original.line,
          original.column,
          sourceContent,
        )
      : null,
  };
}

export function getSourceContent(
  map: RawSourceMap,
  source: string,
): string | null {
  const index = map.sources?.findIndex((item) => item === source) ?? -1;
  if (index < 0) return null;
  return map.sourcesContent?.[index] ?? null;
}

export function buildSourceContext(
  fileName: string,
  line: number,
  column: number,
  sourceContent: string,
): SourceContext | null {
  const sourceLines = sourceContent.split(/\r?\n/);
  if (line < 1 || line > sourceLines.length) return null;

  const start = Math.max(1, line - 5);
  const end = Math.min(sourceLines.length, line + 5);
  const lines = [];

  for (let number = start; number <= end; number += 1) {
    lines.push({
      number,
      text: truncateSourceLine(sourceLines[number - 1] ?? ""),
      highlight: number === line,
    });
  }

  return {
    fileName,
    line,
    column,
    lines,
  };
}

export function truncateSourceLine(value: string): string {
  return value.length > 500 ? `${value.slice(0, 500)}...` : value;
}

export async function loadInlineSourceMap(
  filePath: string,
): Promise<string | null> {
  const normalized = filePath.trim();
  const response = await fetch(normalized);
  if (!response.ok) return null;
  const code = await response.text();
  const match = code.match(
    /sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)/,
  );
  if (!match) return null;

  return Buffer.from(match[1], "base64").toString("utf8");
}

export async function loadSourceMapFromDb(
  projectId: string,
  release: string,
  filePath: string,
): Promise<string | null> {
  const normalized = normalizeFileName(filePath);
  const cacheKey = getSourceMapCacheKey(projectId, release, normalized);
  if (sourceMapCache.has(cacheKey)) return sourceMapCache.get(cacheKey) ?? null;

  const sourceMap = await prisma.sourceMap.findUnique({
    where: {
      projectId_release_fileName: {
        projectId,
        release,
        fileName: normalized,
      },
    },
    select: { content: true },
  });
  if (!sourceMap) return null;

  sourceMapCache.set(cacheKey, sourceMap.content);
  return sourceMap.content;
}

export function normalizeFileName(filePathOrName: string): string {
  const noQuery = filePathOrName.split("?")[0]?.split("#")[0] ?? filePathOrName;
  return noQuery.split("/").pop() ?? noQuery;
}

export function getSourceMapCacheKey(
  projectId: string,
  release: string,
  fileName: string,
): string {
  return `${projectId}:${release}:${normalizeFileName(fileName)}`;
}
