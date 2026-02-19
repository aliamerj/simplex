import type { ProblemData, Solution, SolverState } from "@/types";
import { normalizeRhs } from "./solverCommon"
import { buildMatrix, cloneA } from "./utils";
import { doSimplex } from "./solver";



export function solveSimplex(problem: ProblemData, basis: number[]): Solution {
  const state = createInitialSimplexState(problem, basis)
  if (!isBasisLengthValid(problem, basis) || !isBasisIndicesValid(problem, basis)) {
    return {
      steps: [{ ...state, potentialPivots: [], solutionType: 'infeasible' }],
      objective: 0,
      x: {},
      method: 'simplex',
      problem
    };
  }

  return doSimplex(problem, state, 'simplex')
}


export function createInitialSimplexState(problem: ProblemData, basis: number[]): SolverState {
  const matrix = normalizeRhs(buildMatrix(problem, true));
  const rowVariables = basis.map(b => `x${b}`)
  const rhs = cloneA(problem.rightHandSide)

  const colsVariables = Array.from({ length: problem.numVariables })
    .map((_, i) => `x${i + 1}`).filter(x => !rowVariables.includes(x))

  try {
    const normalized = applyBasisGauss(matrix, rhs, basis);
    const z = rebuildOriginalZ(problem, normalized, rowVariables, colsVariables)
    return {
      matrix: normalized,
      z,
      colsVariables,
      rowVariables,
      artificialPhase: true,
    };
  } catch {
    return {
      matrix: [[]],
      z: [],
      colsVariables,
      rowVariables,
      artificialPhase: true,
      solutionType: 'infeasible'
    }
  }
}


export function applyBasisGauss(
  matrix: number[][],
  rhs: number[],
  basis: number[]
): number[][] {

  const m = matrix.length;
  const n = matrix[0].length;

  // ===== FORWARD ELIMINATION =====
  for (let i = 0; i < basis.length; i++) {
    const pivotCol = basis[i] - 1;

    // Swap ONLY matrix rows (NOT rhs)
    if (matrix[i][pivotCol] === 0) {
      let swapRow = -1;
      for (let r = i + 1; r < m; r++) {
        if (matrix[r][pivotCol] !== 0) {
          swapRow = r;
          break;
        }
      }
      if (swapRow === -1) {
        throw new Error("Degenerate system");
      }

      [matrix[i], matrix[swapRow]] =
        [matrix[swapRow], matrix[i]];
      // ⚠ DO NOT swap rhs
    }

    // Normalize pivot row
    const pivot = matrix[i][pivotCol];

    for (let j = 0; j < n; j++) {
      matrix[i][j] /= pivot;
    }
    rhs[i] /= pivot;

    // Eliminate rows below
    for (let r = i + 1; r < m; r++) {
      const factor = matrix[r][pivotCol];

      for (let c = 0; c < n; c++) {
        matrix[r][c] -= factor * matrix[i][c];
      }

      rhs[r] -= factor * rhs[i];
    }
  }

  // ===== BACKWARD ELIMINATION =====
  for (let i = basis.length - 1; i >= 0; i--) {
    const pivotCol = basis[i] - 1;

    for (let r = i - 1; r >= 0; r--) {
      const factor = matrix[r][pivotCol];

      for (let c = 0; c < n; c++) {
        matrix[r][c] -= factor * matrix[i][c];
      }

      rhs[r] -= factor * rhs[i];
    }
  }

  // ===== REMOVE BASIS COLUMNS =====
  const basisSet = new Set(basis.map(b => b - 1));

  const matrixWithoutBasis = matrix.map(row =>
    row.filter((_, colIndex) => !basisSet.has(colIndex)) 
  );

  // ===== APPEND RHS AS LAST COLUMN =====
  const finalMatrix = matrixWithoutBasis.map((row, i) => [
    ...row,
    rhs[i]
  ]);

  return finalMatrix;
}
function isBasisLengthValid(problem: ProblemData, basis: number[]) {
  return basis.length === problem.numConstraints;
}

function isBasisIndicesValid(problem: ProblemData, basis: number[]) {
  const unique = new Set(basis);
  if (unique.size !== basis.length) return false;

  return basis.every(col => Number.isInteger(col) && col > 0 && col <= problem.numVariables);
}


export function rebuildOriginalZ(
  problem: ProblemData,
  matrix: number[][],
  rowVariables: string[],
  colsVariables: string[],
): number[] {

  const cols = matrix[0].length;
  const rhsIndex = cols - 1;

  const newZ = new Array(cols).fill(0);

  // Step 1: C_N
  for (let j = 0; j < colsVariables.length; j++) {

    const idx = parseInt(colsVariables[j].substring(1)) - 1;

    if (j !== rhsIndex) {
      newZ[j] = problem.objectiveCoefficients[idx] ?? 0;
    }
  }

  // RHS must start from 0
  newZ[rhsIndex] = 0;

  // Step 2: subtract C_B * rows
  for (let i = 0; i < rowVariables.length; i++) {

    const idx = parseInt(rowVariables[i].substring(1)) - 1;
    const cb = problem.objectiveCoefficients[idx] ?? 0;

    if (cb === 0) continue;

    for (let j = 0; j < cols; j++) {
      newZ[j] -= cb * matrix[i][j];
    }
  }

  return newZ;
}
