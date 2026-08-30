# Phase 0 contracts (TypeScript sketches)

Authoritative detail remains in Notion / `docs/PIVOTALEDGE_SPEC.md`.
These sketches seed `packages/schemas` in Phase 0.

## TemporalProvenance

```typescript
export type TemporalProvenance = {
  sourceUrl: string;
  sourceSystem: string;
  retrievedAt: string;
  firstPublicAt: string | null;
  effectiveAt: string | null;
  versionId: string | null;
  checksum: string;
  exactPassage: string | null;
  locator: string | null;
  accessClass: "open" | "restricted" | "unknown";
};
```

## MarketQuestion

```typescript
export type MarketEventType =
  | "TRIAL_PRIMARY_ENDPOINT"
  | "TRIAL_POSITIVE_TOPLINE"
  | "NDA_BLA_SUBMISSION"
  | "FILING_ACCEPTANCE"
  | "FDA_APPROVAL"
  | "FDA_APPROVAL_BY_DATE"
  | "ADVISORY_COMMITTEE_VOTE";

export type MarketQuestion = {
  marketId: string;
  eventType: MarketEventType;
  drugAssetId: string | null;
  drugAliases: string[];
  sponsorId: string | null;
  indicationId: string | null;
  population: string | null;
  applicationId: string | null;
  linkedTrialIds: string[];
  endpointIds: string[];
  eventDeadline: string;
  resolutionSource: string;
  resolutionDefinition: string;
  conditionalApprovalCounts: boolean | null;
  ambiguityFlags: string[];
  parserConfidence: number;
};
```

## BetRecommendation

```typescript
export type BetAction = "BET_YES" | "BET_NO" | "WAIT" | "NO_BET";

export type BetRecommendation = {
  action: BetAction;
  marketId: string;
  generatedAt: string;
  expiresAt: string;
  modelProbability: number;
  marketAdjustedProbability: number;
  conservativeProbability: number;
  executablePrice: number;
  maximumEntryPrice: number | null;
  netEdge: number;
  recommendedStake: number;
  maximumStake: number;
  bankrollFraction: number;
  evidenceConfidence: "low" | "moderate" | "high";
  resolutionRisk: "low" | "moderate" | "high";
  latentInformationRisk: "low" | "moderate" | "high";
  primaryThesis: string;
  strongestCounterargument: string;
  invalidators: string[];
  supportingEvidenceIds: string[];
  forecastId: string;
  orderBookSnapshotId: string;
  policyVersion: string;
};
```

## Core entity inventory (Phase 0 schemas)

DrugAsset, DrugAlias, Sponsor, Person, Indication, Mechanism,
ClinicalProgram, ClinicalTrial, TrialVersion, Endpoint, TrialResult,
RegulatoryApplication, RegulatoryAction, RegulatoryPrecedent,
Document, EvidenceAssertion, Forecast, ForecastComponent,
PredictionMarket, OrderBookSnapshot, OpportunitySignal, ModelRun,
ModelCall, Job, TemporalCutoffAudit
