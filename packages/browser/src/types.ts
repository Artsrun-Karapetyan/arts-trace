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

export type ManualReportAnnotation = {
  kind: "highlight" | "arrow" | "circle" | "note";
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color?: string;
};

export type ReportBugInput = {
  title: string;
  description?: string;
  screenshotData?: string;
  annotations?: ManualReportAnnotation[];
  url?: string;
  userAgent?: string;
  createdByUserId?: string;
};

export type OpenReportDialogOptions = {
  defaultTitle?: string;
  defaultDescription?: string;
  defaultScreenshotData?: string;
  defaultAnnotations?: ManualReportAnnotation[];
  onSubmit?: (input: ReportBugInput) => void | Promise<void>;
  onClose?: () => void;
};

export type MountReportBugButtonOptions = {
  label?: string;
  title?: string;
  description?: string;
  defaultScreenshotData?: string;
  defaultAnnotations?: ManualReportAnnotation[];
  onSubmit?: (input: ReportBugInput) => void | Promise<void>;
  onOpen?: () => void;
  onClose?: () => void;
  target?: HTMLElement | string;
};

export type ManualReportResponse = {
  success: boolean;
  issueId?: string;
  manualReportId?: string;
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
