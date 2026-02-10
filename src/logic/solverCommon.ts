import type { SolutionType, Step } from "@/types";
import { cloneM, neg } from "./utils";

/**
 * Shared epsilon used for floating-point comparisons in pivot ratio tests.
 */
const EPS = 1e-10;

type PivotSearchOptions = {
  canLeaveBasis: (value: number) => boolean;
  ratioEpsilon?: number;
};

/**
 * Clones step snapshots so step-by-step mode can update safely without mutating UI history.
 */
export function cloneSteps(steps: Step[]): Step[] {
  return steps.map(step => ({
    ...step,
    matrix: cloneM(step.matrix),
    z: [...step.z],
    potentialPivots: [...step.potentialPivots],
    colsVariables: [...step.colsVariables],
    rowVariables: [...step.rowVariables],
  }));
}

/**
 * Converts any constraint with negative RHS to an equivalent row with positive RHS.
 */
export function normalizeRhs(matrix: number[][]): number[][] {
  const normalized = cloneM(matrix);
  const rhsIndex = normalized[0].length - 1;

  for (let row = 0; row < normalized.length; row++) {
    if (normalized[row][rhsIndex] >= 0) continue;

    for (let col = 0; col < normalized[row].length; col++) {
      normalized[row][col] *= -1;
    }
  }

  return normalized;
}

export function resolveSolutionType(
  hasNegative: boolean,
  potentialPivots: [number, number][]
): SolutionType {
  if (!hasNegative) {
    return "optimal";
  }

  if (potentialPivots.length === 0) {
    return "unbounded";
  }

  return "not-solved";
}

/**
 * Shared pivot candidates search used by simplex and artificial basis methods.
 */
export function findPotentialPivots(
  matrix: number[][],
  z: number[],
  options: PivotSearchOptions,
) {
  const potentialPivots: [number, number][] = [];
  const rhsIndex = matrix[0].length - 1;
  const ratioEpsilon = options.ratioEpsilon ?? 0;
  let hasNegative = false;

  for (let col = 0; col < z.length - 1; col++) {
    if (!neg(z[col])) continue;

    hasNegative = true;

    let leavingRow = -1;
    let minRatio = Infinity;

    for (let row = 0; row < matrix.length; row++) {
      if (!options.canLeaveBasis(matrix[row][col])) continue;

      const ratio = matrix[row][rhsIndex] / matrix[row][col];
      if (ratio < minRatio - ratioEpsilon) {
        minRatio = ratio;
        leavingRow = row;
      }
    }

    if (leavingRow !== -1) {
      potentialPivots.push([leavingRow, col]);
    }
  }

  return { potentialPivots, hasNegative };
}

export function computeObjectiveFromX(
  x: Record<string, number>,
  objectiveCoefficients: number[]
): number {
  let value = 0;

  for (let i = 0; i < objectiveCoefficients.length; i++) {
    value += (objectiveCoefficients[i] ?? 0) * (x[`x${i + 1}`] ?? 0);
  }

  return value;
}

export const SIMPLEX_RATIO_EPSILON = EPS;
