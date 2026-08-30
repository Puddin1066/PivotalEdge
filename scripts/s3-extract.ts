#!/usr/bin/env tsx
/**
 * S3 CLI: extract trial/regulatory facts from a text file with citation audit.
 * Usage: pnpm s3:extract --trial trial_1 --doc doc_1 --file ./path.txt [--llm]
 */
import { readFile } from "node:fs/promises";
import { config } from "dotenv";

import {
  auditRegulatoryExtraction,
  auditTrialExtraction,
  extractRegulatoryAssessment,
  extractTrialAssessment,
  ExtractionReviewQueue,
} from "@pivotaledge/agents";

config();

const args = process.argv.slice(2);
function arg(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const useLlm = args.includes("--llm");
const file = arg("--file");
const trialId = arg("--trial");
const appId = arg("--app");
const docId = arg("--doc");

async function main() {
  if (!file || !docId || (!trialId && !appId)) {
    console.error("Usage: --trial ID | --app ID --doc ID --file PATH [--llm]");
    process.exit(1);
  }
  const sourceText = await readFile(file, "utf8");
  const queue = new ExtractionReviewQueue();

  if (trialId) {
    const { assessment, usedLlm } = await extractTrialAssessment(
      { trialId, documentId: docId, sourceText },
      { useHeuristicFallback: !useLlm },
    );
    const audit = auditTrialExtraction(assessment, sourceText);
    console.log(JSON.stringify({ usedLlm, assessment, audit }, null, 2));
    if (!audit.schemaValid || !audit.citationAudit.valid) {
      queue.enqueue({
        extractionKind: "trial",
        entityId: trialId,
        documentId: docId,
        reason: "citation_audit_failed",
        issues: [
          ...audit.citationAudit.missingCitations,
          ...audit.citationAudit.fabricatedNumerics,
        ],
      });
      console.log(`Review queue: ${queue.list("pending").length} pending`);
      process.exit(1);
    }
    return;
  }

  const { assessment, usedLlm } = await extractRegulatoryAssessment(
    { applicationId: appId!, documentId: docId, sourceText },
    { useHeuristicFallback: !useLlm },
  );
  const audit = auditRegulatoryExtraction(assessment, sourceText);
  console.log(JSON.stringify({ usedLlm, assessment, audit }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
