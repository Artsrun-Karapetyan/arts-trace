export type IngestEventInput = {
  apiKey: string;
  release?: string;
  message: string;
  stack?: string;
  filePath?: string;
  fileName?: string;
  line?: number;
  column?: number;
  url: string;
  userAgent: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  breadcrumbs?: Array<{
    type: string;
    message: string;
    data?: Record<string, unknown>;
    createdAt: string;
  }>;
  networkRequests?: Array<{
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
  }>;
  replayEvents?: Array<Record<string, unknown>>;
};

export type InitOptions = {
  apiKey: string;
  endpoint?: string;
  userId?: string;
  release?: string;
  replayPreErrorMs?: number;
  replayPostErrorMs?: number;
};

export type UserContext = {
  id: string;
  name?: string;
  fullName?: string;
  role?: string;
};

export type Breadcrumb = NonNullable<IngestEventInput["breadcrumbs"]>[number];
export type NetworkRequest = NonNullable<IngestEventInput["networkRequests"]>[number];
