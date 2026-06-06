import { config as loadEnv } from "dotenv";
import { createRequire } from "node:module";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

loadEnv({ path: new URL("../../../.env", import.meta.url) });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client/index") as {
  PrismaClient: new (options: { adapter: PrismaPg }) => PrismaClientLike;
};

export const prisma = new PrismaClient({ adapter });

export namespace Prisma {
  export type InputJsonValue =
    | string
    | number
    | boolean
    | null
    | { [key: string]: InputJsonValue }
    | InputJsonValue[];
}

type Project = {
  id: string;
  ownerId: string | null;
  name: string;
  apiKey: string;
  createdAt: Date;
};

type ProjectWithCounts = Project & {
  _count: {
    events: number;
  };
};

type Issue = {
  id: string;
  projectId: string;
  fingerprint: string;
  message: string;
  type: "AUTOMATIC" | "MANUAL";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "IGNORED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
  assignee: string | null;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
};

type IssueWithUsersCount = Issue & {
  usersCount: number;
};

type Event = {
  id: string;
  projectId: string;
  issueId: string | null;
  message: string;
  stack: string | null;
  fileName: string | null;
  line: number | null;
  column: number | null;
  sourceContext: Prisma.InputJsonValue | null;
  url: string;
  userAgent: string | null;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  createdAt: Date;
  project: Project;
  breadcrumbs?: Breadcrumb[];
  replays?: ReplayChunk[];
};

type Breadcrumb = {
  id: string;
  eventId: string;
  type: string;
  message: string;
  data: Prisma.InputJsonValue | null;
  createdAt: Date;
};

type NetworkRequest = {
  id: string;
  eventId: string;
  method: string;
  url: string;
  status: number | null;
  requestHeaders: Prisma.InputJsonValue | null;
  requestBody: string | null;
  responseHeaders: Prisma.InputJsonValue | null;
  responseBody: string | null;
  error: string | null;
  duration: number | null;
  createdAt: Date;
};

type ReplayChunk = {
  id: string;
  eventId: string;
  events: Prisma.InputJsonValue;
  createdAt: Date;
};

type SourceMap = {
  id: string;
  projectId: string;
  release: string;
  fileName: string;
  content: string;
  createdAt: Date;
};

type ProjectMember = {
  id: string;
  projectId: string;
  userId: string | null;
  email: string | null;
  name: string;
  role: string | null;
  createdAt: Date;
};

type ProjectInvite = {
  id: string;
  projectId: string;
  token: string;
  email: string;
  role: string | null;
  acceptedByUserId: string | null;
  acceptedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  project?: Project;
};

type IssueComment = {
  id: string;
  issueId: string;
  authorId: string | null;
  body: string;
  createdAt: Date;
};

type ManualReport = {
  id: string;
  issueId: string;
  title: string;
  description: string | null;
  screenshotData: string | null;
  annotations: Prisma.InputJsonValue | null;
  url: string;
  userAgent: string | null;
  createdByUserId: string | null;
  createdAt: Date;
};

type ProjectCreateInput = {
  data: {
    ownerId: string;
    name: string;
    apiKey: string;
  };
};

type ProjectMemberFindManyInput =
  | { where: { projectId: string }; orderBy?: { createdAt: "asc" | "desc" } }
  | { where: { userId: string }; orderBy?: { createdAt: "asc" | "desc" } };

type ProjectFindUniqueInput =
  | { where: { id: string } }
  | { where: { apiKey: string } };

type ProjectFindManyInput = {
  where?: { ownerId?: string; id?: { in: string[] } };
  orderBy?: { createdAt: "asc" | "desc" };
  include?: { _count: { select: { events: true } } };
};

type IssueFindUniqueInput = { where: { id: string } };

type IssueFindManyInput = {
  where?: { projectId?: string; issueId?: { in: string[] } };
  orderBy?: { lastSeen?: "asc" | "desc"; createdAt?: "asc" | "desc" };
  select?: {
    id?: true;
  };
};

type IssueUpsertInput = {
  where: { projectId_fingerprint: { projectId: string; fingerprint: string } };
  create: {
    projectId: string;
    fingerprint: string;
    message: string;
    type?: "AUTOMATIC" | "MANUAL";
    count: number;
    firstSeen: Date;
    lastSeen: Date;
  };
  update: {
    count?: { increment: number };
    message?: string;
    type?: "AUTOMATIC" | "MANUAL";
    lastSeen?: Date;
    status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "IGNORED";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
    assignee?: string | null;
  };
};

type IssueUpdateInput = {
  where: { id: string };
  data: {
    status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "IGNORED";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "HIGHEST";
    assignee?: string | null;
  };
};

type EventCreateInput = {
  data: {
    projectId: string;
    issueId: string;
    message: string;
    stack?: string | null;
    fileName?: string | null;
    line?: number | null;
    column?: number | null;
    sourceContext?: Prisma.InputJsonValue | null;
    url: string;
    userAgent?: string | null;
    userId?: string | null;
    userName?: string | null;
    userRole?: string | null;
    createdAt: Date;
  };
};

type EventFindUniqueInput =
  | { where: { id: string } }
  | { where: { apiKey?: string }; include?: Record<string, unknown> }
  | { where: { id: string }; include?: Record<string, unknown> };

type EventFindManyInput = {
  where?: {
    projectId?: string;
    issueId?: string | { in: string[] };
    createdAt?: { gte?: Date };
  };
  orderBy?: { createdAt: "asc" | "desc" };
  take?: number;
  select?: {
    id?: true;
    issueId?: true;
    userId?: true;
    userAgent?: true;
  };
};

type CountInput = {
  where?: {
    projectId?: string;
    createdAt?: { gte?: Date };
  };
};

type DeleteManyInput =
  | { where: { projectId: string } }
  | { where: { issueId: { in: string[] } } }
  | { where: { id: { in: string[] } } }
  | { where: { eventId: { in: string[] } } };

type CreateManyInput<T> = {
  data: T[];
};

type ReplayUpsertInput = {
  where: { eventId: string };
  create: {
    eventId: string;
    events: Prisma.InputJsonValue;
  };
  update: {
    events: Prisma.InputJsonValue;
  };
};

type SourceMapFindUniqueInput = {
  where: {
    projectId_release_fileName: {
      projectId: string;
      release: string;
      fileName: string;
    };
  };
  select: { content: true };
};

type SourceMapUpsertInput = {
  where: SourceMapFindUniqueInput["where"];
  create: {
    projectId: string;
    release: string;
    fileName: string;
    content: string;
  };
  update: {
    content: string;
  };
};

type RawQueryResult<T> = Promise<T>;

type PrismaClientLike = {
  user: any;
  session: any;
  project: {
    create(args: ProjectCreateInput): Promise<Project>;
    findUnique(args: ProjectFindUniqueInput): Promise<Project | null>;
    findMany(args: ProjectFindManyInput): Promise<ProjectWithCounts[]>;
    update(args: { where: { id: string }; data: { apiKey: string } }): Promise<Project>;
    delete(args: { where: { id: string } }): Promise<Project>;
  };
  projectMember: {
    create(args: { data: { projectId: string; userId?: string | null; email?: string | null; name: string; role?: string | null } }): Promise<ProjectMember>;
    findMany(args: ProjectMemberFindManyInput): Promise<ProjectMember[]>;
    findUnique(args: { where: { id: string } }): Promise<ProjectMember | null>;
    findFirst(args: { where: { projectId: string; userId?: string | null } }): Promise<ProjectMember | null>;
    update(args: { where: { id: string }; data: { role?: string | null } }): Promise<ProjectMember>;
    delete(args: { where: { id: string } }): Promise<ProjectMember>;
  };
  projectInvite: {
    create(args: { data: { projectId: string; token: string; email: string; role?: string | null; expiresAt: Date } }): Promise<ProjectInvite>;
    findMany(args: { where: { projectId: string }; orderBy?: { createdAt: "asc" | "desc" } }): Promise<ProjectInvite[]>;
    findUnique(args: { where: { token: string }; include?: { project?: true } }): Promise<ProjectInvite | null>;
    update(args: { where: { id: string }; data: { acceptedByUserId?: string; acceptedAt?: Date } }): Promise<ProjectInvite>;
  };
  issueComment: {
    create(args: { data: { issueId: string; authorId?: string | null; body: string } }): Promise<IssueComment>;
    findMany(args: { where: { issueId: string }; orderBy?: { createdAt: "asc" | "desc" } }): Promise<IssueComment[]>;
    deleteMany(args: DeleteManyInput): Promise<{ count: number }>;
  };
  manualReport: {
    create(args: {
      data: {
        issueId: string;
        title: string;
        description?: string | null;
        screenshotData?: string | null;
        annotations?: Prisma.InputJsonValue | null;
        url: string;
        userAgent?: string | null;
        createdByUserId?: string | null;
      };
    }): Promise<ManualReport>;
    findMany(args: { where: { issueId: string }; orderBy?: { createdAt: "asc" | "desc" } }): Promise<ManualReport[]>;
  };
  issue: {
    upsert(args: IssueUpsertInput): Promise<Issue>;
    findUnique(args: IssueFindUniqueInput): Promise<Issue | null>;
    findMany(args: IssueFindManyInput): Promise<Issue[]>;
    update(args: IssueUpdateInput): Promise<Issue>;
    deleteMany(args: DeleteManyInput): Promise<{ count: number }>;
  };
  event: {
    create(args: EventCreateInput): Promise<Event>;
    findUnique(args: EventFindUniqueInput): Promise<Event | null>;
    findMany(args: EventFindManyInput): Promise<Event[]>;
    count(args: CountInput): Promise<number>;
    deleteMany(args: DeleteManyInput): Promise<{ count: number }>;
  };
  breadcrumb: {
    createMany(args: CreateManyInput<{
      eventId: string;
      type: string;
      message: string;
      data?: Prisma.InputJsonValue;
      createdAt: Date;
    }>): Promise<{ count: number }>;
    deleteMany(args: DeleteManyInput): Promise<{ count: number }>;
  };
  networkRequest: {
    createMany(args: CreateManyInput<{
      eventId: string;
      method: string;
      url: string;
      status?: number | null;
      requestHeaders?: Prisma.InputJsonValue;
      requestBody?: string | null;
      responseHeaders?: Prisma.InputJsonValue;
      responseBody?: string | null;
      error?: string | null;
      duration?: number | null;
      createdAt: Date;
    }>): Promise<{ count: number }>;
    deleteMany(args: DeleteManyInput): Promise<{ count: number }>;
  };
  replayChunk: {
    upsert(args: ReplayUpsertInput): Promise<ReplayChunk>;
    deleteMany(args: DeleteManyInput): Promise<{ count: number }>;
  };
  sourceMap: {
    upsert(args: SourceMapUpsertInput): Promise<SourceMap>;
    findUnique(args: SourceMapFindUniqueInput): Promise<SourceMap | null>;
  };
  $transaction<T>(callback: (client: PrismaClientLike) => Promise<T>): Promise<T>;
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): RawQueryResult<T>;
  $disconnect(): Promise<void>;
};
