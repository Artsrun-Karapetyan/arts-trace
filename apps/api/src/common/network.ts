import type { Prisma } from "@artstrace/database";
import { prisma } from "@artstrace/database";

let networkInspectorColumnsAvailable: boolean | null = null;

export async function hasNetworkInspectorColumns(): Promise<boolean> {
  if (networkInspectorColumnsAvailable != null)
    return networkInspectorColumnsAvailable;

  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'NetworkRequest'
        AND column_name = 'requestHeaders'
    ) AS "exists"
    `,
  );

  networkInspectorColumnsAvailable = rows[0]?.exists === true;
  return networkInspectorColumnsAvailable;
}

export async function persistNetworkRequestsCompat(
  database: Pick<typeof prisma, "networkRequest">,
  eventId: string,
  items: Array<{
    method: string;
    url: string;
    status?: number;
    requestHeaders?: Record<string, string>;
    requestBody?: string;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
    error?: string;
    duration?: number;
    createdAt: string;
  }>,
  hasExtendedColumns: boolean,
): Promise<void> {
  if (hasExtendedColumns) {
    await database.networkRequest.createMany({
      data: items.map((item) => ({
        eventId,
        method: item.method,
        url: item.url,
        status: item.status,
        requestHeaders: item.requestHeaders as
          | Prisma.InputJsonValue
          | undefined,
        requestBody: item.requestBody,
        responseHeaders: item.responseHeaders as
          | Prisma.InputJsonValue
          | undefined,
        responseBody: item.responseBody,
        error: item.error,
        duration: item.duration,
        createdAt: new Date(item.createdAt),
      })),
    });
    return;
  }

  await database.networkRequest.createMany({
    data: items.map((item) => ({
      eventId,
      method: item.method,
      url: item.url,
      status: item.status,
      duration: item.duration,
      createdAt: new Date(item.createdAt),
    })),
  });
}

export async function getNetworkRequestsCompat(eventId: string): Promise<
  Array<{
    id: string;
    method: string;
    url: string;
    status: number | null;
    requestHeaders: Record<string, string> | null;
    requestBody: string | null;
    responseHeaders: Record<string, string> | null;
    responseBody: string | null;
    error: string | null;
    duration: number | null;
    createdAt: Date;
  }>
> {
  const hasExtendedColumns = await hasNetworkInspectorColumns();
  if (hasExtendedColumns) {
    return await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        method: string;
        url: string;
        status: number | null;
        requestHeaders: Record<string, string> | null;
        requestBody: string | null;
        responseHeaders: Record<string, string> | null;
        responseBody: string | null;
        error: string | null;
        duration: number | null;
        createdAt: Date;
      }>
    >(
      `
      SELECT
        id,
        method,
        url,
        status,
        "requestHeaders",
        "requestBody",
        "responseHeaders",
        "responseBody",
        error,
        duration,
        "createdAt"
      FROM "NetworkRequest"
      WHERE "eventId" = $1
      ORDER BY "createdAt" ASC
      `,
      eventId,
    );
  }

  const legacy = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      method: string;
      url: string;
      status: number | null;
      duration: number | null;
      createdAt: Date;
    }>
  >(
    `
    SELECT
      id,
      method,
      url,
      status,
      duration,
      "createdAt"
    FROM "NetworkRequest"
    WHERE "eventId" = $1
    ORDER BY "createdAt" ASC
    `,
    eventId,
  );

  return legacy.map((item) => ({
    ...item,
    requestHeaders: null,
    requestBody: null,
    responseHeaders: null,
    responseBody: null,
    error: null,
  }));
}
