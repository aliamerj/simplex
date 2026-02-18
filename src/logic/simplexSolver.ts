import type { ProblemData, Solution, Step } from "@/types";
import { buildMatrix, cloneM, pos } from "./utils";
import { cloneSteps, computeObjectiveFromX, findPotentialPivots, normalizeRhs, resolveSolutionType, SIMPLEX_RATIO_EPSILON } from "./solverCommon";

type SimplexState = {
  matrix: number[][];
  basis: number[];
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
      // Keep the same simplex transform as in the teacher Java implementation.
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

    return [...steps, createSnapshot(problem, initial)];
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
  state.basis[pivotRow] = pivotCol;
  state.z = computeTargetFunction(problem, state.matrix, state.basis);

  return [...steps, createSnapshot(problem, state)];
}

function createInitialState(problem: ProblemData, indexBasis: number[]): SimplexState | null {
  if (!isBasisLengthValid(problem, indexBasis) || !isBasisIndicesValid(problem, indexBasis)) {
    return null;
  }

  const matrix = normalizeRhs(buildMatrix(problem));
  const basis = [...indexBasis];

  if (!isValidBasisForGauss(matrix, basis)) {
    return null;
  }

  const canonical = solveGauss(matrix, problem.numConstraints, matrix[0].length, basis);

  if (!isBasicFeasible(canonical)) {
    return null;
  }

  return {
    matrix: canonical,
    basis,
    z: computeTargetFunction(problem, canonical, basis),
  };
}

function restoreStateFromStep(problem: ProblemData, step: Step): SimplexState {
  const basis = step.rowVariables.map(name => parseInt(name.slice(1), 10) - 1);
  const matrix = cloneM(step.matrix);

  return {
    matrix,
    basis,
    z: computeTargetFunction(problem, matrix, basis),
  };
}

function createSnapshot(problem: ProblemData, state: SimplexState): Step {
  const { potentialPivots, hasNegative } = findPotentialPivots(state.matrix, state.z, {
    canLeaveBasis: pos,
    ratioEpsilon: SIMPLEX_RATIO_EPSILON,
  });

  return {
    matrix: cloneM(state.matrix),
    z: [...state.z],
    potentialPivots,
    colsVariables: createVariableNames(problem.numVariables),
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

function isValidBasisForGauss(matrix: number[][], basis: number[]) {
  return basis.every((col, row) => Math.abs(matrix[row][col]) > EPS);
}

function isBasicFeasible(matrix: number[][]) {
  const rhsIndex = matrix[0].length - 1;
  return matrix.every(row => row[rhsIndex] >= -EPS);
}

function computeTargetFunction(problem: ProblemData, matrix: number[][], basis: number[]) {
  const cols = matrix[0].length;
  const z = new Array(cols).fill(0);

  for (let col = 0; col < problem.numVariables; col++) {
    z[col] = problem.objectiveCoefficients[col] ?? 0;
  }

  for (let row = 0; row < basis.length; row++) {
    const basicCol = basis[row];
    const cB = problem.objectiveCoefficients[basicCol] ?? 0;

    if (Math.abs(cB) < EPS) continue;

    for (let col = 0; col < cols; col++) {
      z[col] -= cB * matrix[row][col];
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

function createVariableNames(numVariables: number) {
  return Array.from({ length: numVariables }, (_, i) => `x${i + 1}`);
}

export function doSolveSimplex(
  problem: ProblemData,
  initialMatrix: number[][],
  initialBasis: number[]
): Solution {
  const state: SimplexState = {
    matrix: cloneM(initialMatrix),
    basis: [...initialBasis],
    z: computeTargetFunction(problem, initialMatrix, initialBasis),
  };

  const steps: Step[] = [];

  while (true) {
    const snapshot = createSnapshot(problem, state);
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
    state.basis[pivotRow] = pivotCol;
    state.z = computeTargetFunction(problem, state.matrix, state.basis);
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
