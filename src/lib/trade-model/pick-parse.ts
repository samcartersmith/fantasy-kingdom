import type { PickBucket } from "@/lib/trade-model/types";

const PICK_ID_RE = /^pick_(\d{4})_(early|mid|late)_(\d+)$/;

export type ParsedPickId = {
  year: number;
  round: number;
  bucket: PickBucket;
};

export function tryParsePickId(assetId: string): ParsedPickId | null {
  const m = PICK_ID_RE.exec(assetId.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const bucket = m[2] as PickBucket;
  const round = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(round)) return null;
  return { year, round, bucket };
}
