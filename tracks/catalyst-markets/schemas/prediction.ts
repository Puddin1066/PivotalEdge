import { z } from "zod";

import { IsoDateTimeSchema } from "./event.js";

/** Clinical + equity joint prediction (Notion §12). */
export const CatalystPredictionSchema = z.object({
  eventId: z.string().min(1),
  modelVersion: z.string().min(1),
  asOf: IsoDateTimeSchema,
  informationCutoff: IsoDateTimeSchema,
  pSuccess: z.number().min(0).max(1),
  pSuccessInterval: z.tuple([z.number(), z.number()]).nullable(),
  rSuccess: z.number(),
  rFailure: z.number(),
  expectedCatalystReturn: z.number(),
  marketImpliedProbability: z.number().min(0).max(1).nullable(),
  probabilityEdge: z.number().nullable(),
  confidence: z.number().min(0).max(1),
  nearestAnalogCount: z.number().int().nonnegative(),
  contradictoryCaseCount: z.number().int().nonnegative(),
  auditStatus: z.enum(["pass", "fail", "pending"]),
  frozen: z.boolean().default(false),
});
export type CatalystPrediction = z.infer<typeof CatalystPredictionSchema>;

export function expectedCatalystReturn(
  pSuccess: number,
  rSuccess: number,
  rFailure: number,
): number {
  return pSuccess * rSuccess + (1 - pSuccess) * rFailure;
}

export function probabilityEdge(
  pModel: number,
  pMarket: number | null | undefined,
): number | null {
  if (pMarket == null) return null;
  return pModel - pMarket;
}
