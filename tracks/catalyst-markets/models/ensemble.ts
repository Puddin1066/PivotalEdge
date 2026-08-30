import {
  expectedCatalystReturn,
  probabilityEdge,
  type CatalystPrediction,
} from "../schemas/prediction.js";

export function buildEnsemblePrediction(input: {
  eventId: string;
  asOf: string;
  informationCutoff: string;
  pSuccess: number;
  rSuccess: number;
  rFailure: number;
  marketImpliedProbability: number | null;
  nearestAnalogCount: number;
  contradictoryCaseCount: number;
  auditStatus: "pass" | "fail" | "pending";
  frozen?: boolean;
}): CatalystPrediction {
  const ecr = expectedCatalystReturn(input.pSuccess, input.rSuccess, input.rFailure);
  return {
    eventId: input.eventId,
    modelVersion: "catalyst-markets-ensemble-v0",
    asOf: input.asOf,
    informationCutoff: input.informationCutoff,
    pSuccess: input.pSuccess,
    pSuccessInterval: null,
    rSuccess: input.rSuccess,
    rFailure: input.rFailure,
    expectedCatalystReturn: ecr,
    marketImpliedProbability: input.marketImpliedProbability,
    probabilityEdge: probabilityEdge(input.pSuccess, input.marketImpliedProbability),
    confidence: 0.6,
    nearestAnalogCount: input.nearestAnalogCount,
    contradictoryCaseCount: input.contradictoryCaseCount,
    auditStatus: input.auditStatus,
    frozen: input.frozen ?? false,
  };
}
