import type { ProblemData, Solution, Step } from "@/types";
import { buildMatrix, cloneM, pos } from "./utils";
import { cloneSteps, computeObjectiveFromX, findPotentialPivots, normalizeRhs, resolveSolutionType, SIMPLEX_RATIO_EPSILON } from "./solverCommon";

type SimplexState = {
  matrix: number[][];
  basis: number[];
  unbasis: number[];
  z: number[];
};

const EPS = 1e-10;

function executeSimplexPivot(
  matrix: number[][],
  pivotRow: number,
  pivotCol: number
): number[][] {
  const result = matrix.map(row => [...row]);
  const supportElement = result[pivotRow][pivotCol];

  if (Math.abs(supportElement) < EPS) {
    return result;
  }

  const newSupportLine = new Array(result[pivotRow].length).fill(0);

  for (let col = 0; col < result[pivotRow].length; col++) {
    if (col !== pivotCol) {
      newSupportLine[col] = result[pivotRow][col] / supportElement;
    } else {
      newSupportLine[col] = 1 / supportElement;
    }
  }

  result[pivotRow] = newSupportLine;

  for (let row = 0; row < result.length; row++) {
    if (row === pivotRow) continue;

    const currentCoef = result[row][pivotCol];
    const newLine = new Array(result[row].length).fill(0);

    for (let col = 0; col < result[row].length; col++) {
      if (col === pivotCol) {
        newLine[col] = -(result[row][col] / supportElement);
      } else {
        newLine[col] = result[row][col] - currentCoef * result[pivotRow][col];
      }
    }

    result[row] = newLine;
  }

  return result;
}

export function solveSimplex(problem: ProblemData, indexBasis: number[]): Solution {
  let steps: Step[] = [];

  while (true) {
    const nextSteps = solveSimplexStep(problem, indexBasis, steps, 0);

    if (nextSteps.length === steps.length) {
      steps = nextSteps;
      break;
    }

    steps = nextSteps;
    const lastStep = steps.at(-1);
    if (!lastStep || lastStep.solutionType !== 'not-solved') {
      break;
    }
  }

  const x = extractSimplexSolution(problem, steps);
  const objective = computeObjectiveFromX(x, problem.objectiveCoefficients);

  return {
    steps,
    x,
    objective,
    method: 'simplex',
    problem,
  };
}

export function solveSimplexStep(
  problem: ProblemData,
  indexBasis: number[],
  previousSteps: Step[],
  selectedPivotIndex?: number,
): Step[] {
  const steps = cloneSteps(previousSteps);

  if (steps.length === 0) {
    const initial = createInitialState(problem, indexBasis);
    if (!initial) {
      return [
        {
          matrix: [],
          z: [],
          potentialPivots: [],
          colsVariables: [],
          rowVariables: [],
          solutionType: 'infeasible',
        },
      ];
    }

    return [...steps, createSnapshot(initial)];
  }

  const lastStepIndex = steps.length - 1;
  const lastStep = steps[lastStepIndex];

  if (!lastStep.potentialPivots.length || lastStep.solutionType !== 'not-solved') {
    return steps;
  }

  const chosenPivotIndex = selectedPivotIndex ?? 0;
  const pivotPoint = lastStep.potentialPivots[chosenPivotIndex];

  if (!pivotPoint) {
    return steps;
  }

  steps[lastStepIndex] = {
    ...lastStep,
    selectedPivotIndex: chosenPivotIndex,
  };

  const state = restoreStateFromStep(problem, lastStep);
  const [pivotRow, pivotCol] = pivotPoint;

  state.matrix = executeSimplexPivot(state.matrix, pivotRow, pivotCol);

  const leavingVariable = state.basis[pivotRow];
  state.basis[pivotRow] = state.unbasis[pivotCol];
  state.unbasis[pivotCol] = leavingVariable;

  state.z = computeTargetFunction(problem, state.matrix, state.basis, state.unbasis);

  return [...steps, createSnapshot(state)];
}

function createInitialState(problem: ProblemData, indexBasis: number[]): SimplexState | null {
  if (!isBasisLengthValid(problem, indexBasis) || !isBasisIndicesValid(problem, indexBasis)) {
    return null;
  }

  const matrix = normalizeRhs(buildMatrix(problem));
  const basis = [...indexBasis];

  const canonical = solveGauss(matrix, problem.numConstraints, matrix[0].length, basis);

  if (!isBasisCanonical(canonical, basis) || !isBasicFeasible(canonical)) {
    return null;
  }

  const unbasis = createUnbasis(problem.numVariables, basis);
  const simplexMatrix = buildSimplexMatrix(canonical, unbasis);

  return {
    matrix: simplexMatrix,
    basis,
    unbasis,
    z: computeTargetFunction(problem, simplexMatrix, basis, unbasis),
  };
}

function restoreStateFromStep(problem: ProblemData, step: Step): SimplexState {
  const basis = step.rowVariables.map(name => parseInt(name.slice(1), 10) - 1);
  const unbasis = step.colsVariables.map(name => parseInt(name.slice(1), 10) - 1);
  const matrix = cloneM(step.matrix);

  return {
    matrix,
    basis,
    unbasis,
    z: computeTargetFunction(problem, matrix, basis, unbasis),
  };
}

function createSnapshot(state: SimplexState): Step {
  const { potentialPivots, hasNegative } = findPotentialPivots(state.matrix, state.z, {
    canLeaveBasis: pos,
    ratioEpsilon: SIMPLEX_RATIO_EPSILON,
  });

  return {
    matrix: cloneM(state.matrix),
    z: [...state.z],
    potentialPivots,
    colsVariables: state.unbasis.map(col => `x${col + 1}`),
    rowVariables: state.basis.map(col => `x${col + 1}`),
    solutionType: resolveSolutionType(hasNegative, potentialPivots),
  };
}

function isBasisLengthValid(problem: ProblemData, basis: number[]) {
  return basis.length === problem.numConstraints;
}

function isBasisIndicesValid(problem: ProblemData, basis: number[]) {
  const unique = new Set(basis);
  if (unique.size !== basis.length) return false;

  return basis.every(col => Number.isInteger(col) && col >= 0 && col < problem.numVariables);
}

function isBasisCanonical(matrix: number[][], basis: number[]) {
  for (let row = 0; row < basis.length; row++) {
    for (let k = 0; k < basis.length; k++) {
      const expected = row === k ? 1 : 0;
      if (Math.abs(matrix[k][basis[row]] - expected) > EPS) {
        return false;
      }
    }
  }

  return true;
}

function isBasicFeasible(matrix: number[][]) {
  const rhsIndex = matrix[0].length - 1;
  return matrix.every(row => row[rhsIndex] >= -EPS);
}

function createUnbasis(numVariables: number, basis: number[]) {
  const basisSet = new Set(basis);
  const unbasis: number[] = [];

  for (let col = 0; col < numVariables; col++) {
    if (!basisSet.has(col)) {
      unbasis.push(col);
    }
  }

  return unbasis;
}

function buildSimplexMatrix(canonical: number[][], unbasis: number[]) {
  const rhsIndex = canonical[0].length - 1;

  return canonical.map(row => {
    const simplexRow = unbasis.map(col => row[col]);
    simplexRow.push(row[rhsIndex]);
    return simplexRow;
  });
}

function computeTargetFunction(
  problem: ProblemData,
  simplexMatrix: number[][],
  basis: number[],
  unbasis: number[],
) {
  const z = new Array(unbasis.length + 1).fill(0);
  const rhsIndex = unbasis.length;

  for (let col = 0; col < unbasis.length; col++) {
    z[col] = problem.objectiveCoefficients[unbasis[col]] ?? 0;
  }

  for (let row = 0; row < basis.length; row++) {
    const basicCol = basis[row];
    const cB = problem.objectiveCoefficients[basicCol] ?? 0;

    if (Math.abs(cB) < EPS) continue;

    z[rhsIndex] -= cB * simplexMatrix[row][rhsIndex];

    for (let col = 0; col < unbasis.length; col++) {
      z[col] -= cB * simplexMatrix[row][col];
    }
  }

  return z;
}

function extractSimplexSolution(problem: ProblemData, steps: Step[]) {
  const solution: Record<string, number> = {};

  for (let i = 0; i < problem.numVariables; i++) {
    solution[`x${i + 1}`] = 0;
  }

  const lastStep = steps.at(-1);
  if (!lastStep || lastStep.matrix.length === 0) {
    return solution;
  }

  const rhsIndex = lastStep.matrix[0].length - 1;

  lastStep.rowVariables.forEach((variableName, row) => {
    const variableIndex = parseInt(variableName.slice(1), 10) - 1;
    if (variableIndex >= 0 && variableIndex < problem.numVariables) {
      solution[variableName] = lastStep.matrix[row][rhsIndex];
    }
  });

  return solution;
}

export function doSolveSimplex(
  problem: ProblemData,
  initialMatrix: number[][],
  initialBasis: number[]
): Solution {
  const unbasis = createUnbasis(problem.numVariables, initialBasis);

  const state: SimplexState = {
    matrix: cloneM(initialMatrix),
    basis: [...initialBasis],
    unbasis,
    z: computeTargetFunction(problem, initialMatrix, initialBasis, unbasis),
  };

  const steps: Step[] = [];

  while (true) {
    const snapshot = createSnapshot(state);
    steps.push(snapshot);

    if (snapshot.solutionType !== 'not-solved') {
      break;
    }

    const pivot = snapshot.potentialPivots[0];
    if (!pivot) {
      break;
    }

    const [pivotRow, pivotCol] = pivot;
    state.matrix = executeSimplexPivot(state.matrix, pivotRow, pivotCol);

    const leavingVariable = state.basis[pivotRow];
    state.basis[pivotRow] = state.unbasis[pivotCol];
    state.unbasis[pivotCol] = leavingVariable;

    state.z = computeTargetFunction(problem, state.matrix, state.basis, state.unbasis);
  }

  const x = extractSimplexSolution(problem, steps);
  const objective = computeObjectiveFromX(x, problem.objectiveCoefficients);

  return {
    steps,
    x,
    objective,
    method: 'simplex',
    problem,
  };
}

export function solveGauss(
  coefficients: number[][],
  n: number,
  m: number,
  basis: number[]
): number[][] {
  const coeffs = coefficients.map(row => [...row]);

  for (let i = 0; i < n; i++) {
    const pivotCol = basis[i];

    if (Math.abs(coeffs[i][pivotCol]) < EPS) {
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(coeffs[k][pivotCol]) > EPS) {
          [coeffs[i], coeffs[k]] = [coeffs[k], coeffs[i]];
          break;
        }
      }
    }

    const pivot = coeffs[i][pivotCol];
    if (Math.abs(pivot) < EPS) {
      continue;
    }

    for (let j = 0; j < m; j++) {
      coeffs[i][j] /= pivot;
    }

    for (let k = 0; k < n; k++) {
      if (k === i) continue;

      const factor = coeffs[k][pivotCol];
      for (let j = 0; j < m; j++) {
        coeffs[k][j] -= factor * coeffs[i][j];
      }
    }
  }

  return coeffs;
}
