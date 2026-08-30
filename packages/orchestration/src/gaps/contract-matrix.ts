/** Re-exports shared contract matrix from @pivotaledge/kg (single source of truth). */
export {
  assessContractEvidence,
  contractRequirementsFor,
  contractRequirementGroupsFor,
  CONTRACT_REQUIREMENTS,
  CONTRACT_REQUIREMENT_GROUPS,
  KG_GAP_TO_FIELD,
  type ContractRequirement,
  type ContractRequirementGroup,
} from "@pivotaledge/kg";

/** @deprecated Use CONTRACT_REQUIREMENTS from @pivotaledge/kg */
export { CONTRACT_REQUIREMENTS as CONTRACT_REQUIREMENTS_LEGACY } from "@pivotaledge/kg";
