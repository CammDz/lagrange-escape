import { z } from "zod";
export const VERSION = 1;
export const codeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/);
export const nameSchema = z
  .string()
  .trim()
  .min(2)
  .max(28)
  .regex(
    /^[\p{L}\p{N} _.-]+$/u,
    "Usa letras, números, espacios, punto o guion.",
  );
export const configSchema = z
  .object({
    title: nameSchema.default("Laboratorio Lagrange"),
    duration: z.number().int().min(5).max(20).default(15),
    mode: z.enum(["individual", "teams", "mixed"]).default("mixed"),
    maxPlayers: z.number().int().min(1).max(30).default(30),
    teamSize: z.number().int().min(2).max(30).default(30),
    allowTeams: z.boolean().default(true),
    hints: z.boolean().default(true),
    sound: z.boolean().default(true),
    ranking: z.boolean().default(true),
  })
  .strict();
export type Config = z.infer<typeof configSchema>;
export type Status =
  "waiting" | "countdown" | "running" | "paused" | "finished";
export const joinSchema = z
  .object({
    nickname: nameSchema,
    avatar: z.number().int().min(0).max(5).default(0),
    team: z.string().max(36).optional(),
    newTeam: nameSchema.optional(),
  })
  .strict();
export const actionSchema = z
  .object({
    v: z.literal(1),
    id: z.string().uuid(),
    seq: z.number().int().positive(),
    type: z.enum(["answer", "hint", "ready", "snapshot", "signal"]),
    stage: z.number().int().min(0).max(3).optional(),
    data: z.record(z.string().max(32), z.string().max(120)).optional(),
  })
  .strict();
export type Action = z.infer<typeof actionSchema>;
export interface Progress {
  signal?: { from: string; text: string; at: number };
  stage: number;
  done: string[];
  score: number;
  correct: number;
  errors: number;
  hints: number;
  stageErrors: number;
  stageHints: number;
  lastTime: number;
  seq: number;
  seen: string[];
  feedback: string;
  hintText: string;
  chambers: { score: number; errors: number; hints: number; time: number }[];
}
export interface Player {
  avatar?: number;
  id: string;
  nickname: string;
  teamId?: string;
  tokenHash: string;
  expires: number;
  ready: boolean;
  kicked: boolean;
  lastSeen: number;
  seq: number;
  seen: string[];
  connection?: string;
}
export interface Team {
  id: string;
  name: string;
  members: string[];
}
export interface RoomState {
  code: string;
  config: Config;
  status: Status;
  createdAt: number;
  startedAt: number;
  finishedAt: number;
  remaining: number;
  deadline: number;
  seq: number;
  open: boolean;
  variants: [number, number];
  tiles: Record<string, string>;
  players: Record<string, Player>;
  teams: Record<string, Team>;
  progress: Record<string, Progress>;
  events: { type: string; actor: string; at: number; detail: string }[];
}
export interface Problem {
  kind: "rectangle" | "circle";
  resource: number;
  title: string;
  statement: string;
  objective: string;
  constraint: string;
  domain: string;
  pieces: { id: string; label: string }[];
  slots: { id: string; label: string }[];
  connections: { id: string; label: string }[];
  targets: { id: string; label: string }[];
  radius?: number;
}
export interface Entry {
  id: string;
  name: string;
  category: "individual" | "team";
  score: number;
  stage: number;
  steps: number;
  hints: number;
  errors: number;
  lastTime: number;
  connected: boolean;
  rank: number;
}
export interface Snapshot {
  v: 1;
  seq: number;
  serverNow: number;
  code: string;
  config: Config;
  status: Status;
  open: boolean;
  remaining: number;
  deadline: number;
  players: {
    avatar?: number;
    id: string;
    nickname: string;
    teamId?: string;
    ready: boolean;
    connected: boolean;
    lastSeen: number;
  }[];
  teams: Team[];
  leaderboard: Entry[];
  you?: string;
  progress?: Progress;
  problem?: Problem;
  nextSeq?: number;
  feedback?: string;
}
