import type { ProblemData, Solution, Step } from "@/types";
import { buildMatrix, cloneM, neg, performPivot, pos } from "./utils";

type SimplexState = {
  matrix: number[][];
  basis: number[];
};

type StepAnalysis = {
  step: Step;
  nonBasic: number[];
};

export function solveSimplex(problem: ProblemData, indexBasis: number[]): Solution {
  const prepared = prepareInitialState(problem, indexBasis);

  if (!prepared.ok) {
    return buildInfeasibleSolution(problem);
  }

  const state = prepared.state;
  const steps: Step[] = [];

  while (true) {
    const analysis = analyzeStep(problem, state);

    if (analysis.step.solutionType === 'optimal' || analysis.step.solutionType === 'unbounded') {
      steps.push(analysis.step);
      return finalizeSolution(problem, state, steps);
    }

    const chosenPivotIndex = 0;
    const pivot = analysis.step.potentialPivots[chosenPivotIndex];

    if (!pivot) {
      steps.push(analysis.step);
      return finalizeSolution(problem, state, steps);
    }

    steps.push({
      ...analysis.step,
      selectedPivotIndex: chosenPivotIndex,
    });

    const [pivotRow, displayCol] = pivot;
    const pivotCol = analysis.nonBasic[displayCol];
    state.basis[pivotRow] = pivotCol;
    state.matrix = performPivot(state.matrix, pivotRow, pivotCol);
  }
}

export function doSolveSimplex(
  problem: ProblemData,
  initialMatrix: number[][],
  initialBasis: number[]
): Solution {
  const state: SimplexState = {
    matrix: cloneM(initialMatrix),
    basis: [...initialBasis],
  };

  const steps: Step[] = [];

  while (true) {
    const analysis = analyzeStep(problem, state);

    if (analysis.step.solutionType === 'optimal' || analysis.step.solutionType === 'unbounded') {
      steps.push(analysis.step);
      return finalizeSolution(problem, state, steps);
    }

    const chosenPivotIndex = 0;
    const pivot = analysis.step.potentialPivots[chosenPivotIndex];

    if (!pivot) {
      steps.push(analysis.step);
      return finalizeSolution(problem, state, steps);
    }

    steps.push({
      ...analysis.step,
      selectedPivotIndex: chosenPivotIndex,
    });

    const [pivotRow, displayCol] = pivot;
    const pivotCol = analysis.nonBasic[displayCol];
    state.basis[pivotRow] = pivotCol;
    state.matrix = performPivot(state.matrix, pivotRow, pivotCol);
  }
}

export function solveSimplexStep(
  problem: ProblemData,
  indexBasis: number[],
  previousSteps: Step[],
  selectedPivotIndex?: number,
): Solution {
  const prepared = prepareInitialState(problem, indexBasis);

  if (!prepared.ok) {
    return buildInfeasibleSolution(problem);
  }

  const previous = cloneSteps(previousSteps);

  if (previous.length === 0) {
    const initialStep = analyzeStep(problem, prepared.state).step;
    return finalizeSolution(problem, prepared.state, [initialStep]);
  }

  const lastIndex = previous.length - 1;
  const lastStep = previous[lastIndex];

  if (lastStep.solutionType !== 'not-solved' || !lastStep.potentialPivots.length) {
    return replaySimplex(problem, indexBasis, previous, null);
  }

  const pivotIndex = selectedPivotIndex ?? 0;
  if (!lastStep.potentialPivots[pivotIndex]) {
    return replaySimplex(problem, indexBasis, previous, null);
  }

  previous[lastIndex] = {
    ...lastStep,
    selectedPivotIndex: pivotIndex,
  };

  return replaySimplex(problem, indexBasis, previous, null);
}

function replaySimplex(
  problem: ProblemData,
  indexBasis: number[],
  stepsWithSelections: Step[],
  autoPivotFallback: number | null,
): Solution {
  const prepared = prepareInitialState(problem, indexBasis);

  if (!prepared.ok) {
    return buildInfeasibleSolution(problem);
  }

  const state = prepared.state;
  const rebuiltSteps: Step[] = [];

  while (true) {
    const analysis = analyzeStep(problem, state);
    const stepIndex = rebuiltSteps.length;
    const historicStep = stepsWithSelections[stepIndex];
    const selectedPivot = historicStep?.selectedPivotIndex;

    if (analysis.step.solutionType !== 'not-solved') {
      rebuiltSteps.push(analysis.step);
      return finalizeSolution(problem, state, rebuiltSteps);
    }

    let pivotIndex: number | undefined = undefined;

    if (selectedPivot !== undefined) {
      pivotIndex = selectedPivot;
    } else if (autoPivotFallback !== null) {
      pivotIndex = autoPivotFallback;
    }

    if (pivotIndex === undefined || !analysis.step.potentialPivots[pivotIndex]) {
      rebuiltSteps.push(analysis.step);
      return finalizeSolution(problem, state, rebuiltSteps);
    }

    const [pivotRow, displayCol] = analysis.step.potentialPivots[pivotIndex];
    const pivotCol = analysis.nonBasic[displayCol];

    rebuiltSteps.push({
      ...analysis.step,
      selectedPivotIndex: pivotIndex,
    });

    state.basis[pivotRow] = pivotCol;
    state.matrix = performPivot(state.matrix, pivotRow, pivotCol);
  }
}

function prepareInitialState(
  problem: ProblemData,
  indexBasis: number[],
): { ok: true; state: SimplexState } | { ok: false } {
  if (indexBasis.length !== problem.numConstraints) {
    return { ok: false };
  }

  if (!indexBasis.every(idx => Number.isInteger(idx) && idx >= 0 && idx < problem.numVariables)) {
    return { ok: false };
  }

  if (new Set(indexBasis).size !== indexBasis.length) {
    return { ok: false };
  }

  const matrix = buildMatrix(problem);
  if (!isValidBasis(matrix, indexBasis)) {
    return { ok: false };
  }

  const afterGauss = solveGauss(matrix, problem.numConstraints, matrix[0].length, indexBasis);

  return {
    ok: true,
    state: {
      matrix: cloneM(afterGauss),
      basis: [...indexBasis],
    },
  };
}

function analyzeStep(problem: ProblemData, state: SimplexState): StepAnalysis {
  const totalCols = state.matrix[0].length;
  const nonBasic = getNonBasic(totalCols, state.basis);
  const targetFunction = computeTargetFunction(problem, state.matrix, state.basis);

  const potentialPivots: [number, number][] = [];
  let hasNegative = false;
  const lastCol = state.matrix[0].length - 1;

  for (let displayCol = 0; displayCol < nonBasic.length; displayCol++) {
    const col = nonBasic[displayCol];

    if (!neg(targetFunction[col])) continue;

    hasNegative = true;

    let minRow = -1;
    let minRatio = Infinity;

    for (let row = 0; row < state.basis.length; row++) {
      if (!pos(state.matrix[row][col])) continue;

      const ratio = state.matrix[row][lastCol] / state.matrix[row][col];
      if (ratio < minRatio) {
        minRatio = ratio;
        minRow = row;
      }
    }

    if (minRow !== -1) {
      potentialPivots.push([minRow, displayCol]);
    }
  }

  const solutionType = !hasNegative
    ? 'optimal'
    : potentialPivots.length === 0
      ? 'unbounded'
      : 'not-solved';

  const step: Step = {
    matrix: extractColumnsForDisplay(state.matrix, nonBasic),
    z: extractZForDisplay(targetFunction, nonBasic),
    potentialPivots,
    colsVariables: nonBasic.map(i => `x${i + 1}`),
    rowVariables: state.basis.map(i => `x${i + 1}`),
    solutionType,
  };

  return { step, nonBasic };
}

function finalizeSolution(problem: ProblemData, state: SimplexState, steps: Step[]): Solution {
  const targetFunction = computeTargetFunction(problem, state.matrix, state.basis);
  const objectiveValue = targetFunction[targetFunction.length - 1];

  return {
    steps,
    objective: objectiveValue * (problem.objectiveType === 'min' ? -1 : 1),
    x: computeBasisSolution(state.matrix, state.basis, problem.numVariables),
    method: 'simplex',
    problem,
  };
}

function buildInfeasibleSolution(problem: ProblemData): Solution {
  return {
    steps: [{
      solutionType: 'infeasible',
      matrix: [],
      z: [],
      potentialPivots: [],
      colsVariables: [],
      rowVariables: [],
    }],
    objective: NaN,
    x: {},
    method: 'simplex',
    problem,
  };
}

function cloneSteps(steps: Step[]): Step[] {
  return steps.map(step => ({
    ...step,
    matrix: step.matrix.map(row => [...row]),
    z: [...step.z],
    potentialPivots: [...step.potentialPivots],
    colsVariables: [...step.colsVariables],
    rowVariables: [...step.rowVariables],
  }));
}

function computeBasisSolution(
  matrix: number[][],
  basis: number[],
  numVariables: number
): Record<string, number> {

  const solution: Record<string, number> = {};

  for (let i = 0; i < numVariables; i++) {
    solution[`x${i + 1}`] = 0;
  }

  const rhs = matrix[0].length - 1;

  for (let row = 0; row < basis.length; row++) {
    const col = basis[row];

    if (col < numVariables) {
      solution[`x${col + 1}`] = matrix[row][rhs];
    }
  }

  return solution;
}

function computeTargetFunction(
  problem: ProblemData,
  matrix: number[][],
  basis: number[]
): number[] {

  const cols = matrix[0].length;
  const z = new Array(cols).fill(0);

  for (let i = 0; i < problem.numVariables; i++) {
    z[i] = problem.objectiveCoefficients[i];
  }

  for (let row = 0; row < basis.length; row++) {
    const basicIndex = basis[row];
    const cB = problem.objectiveCoefficients[basicIndex] ?? 0;

    if (Math.abs(cB) < 1e-10) continue;

    for (let col = 0; col < cols; col++) {
      z[col] -= cB * matrix[row][col];
    }
  }

  return z;
}

export function solveGauss(
  coefficients: number[][],
  n: number,
  m: number,
  basis: number[]
): number[][] {
  const coeffs = coefficients.map(row => [...row]);

  for (let i = 0; i < n; i++) {
    const minor = basis[i];

    if (Math.abs(coeffs[i][minor]) < 1e-10) {
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(coeffs[k][minor]) > 1e-10) {
          [coeffs[i], coeffs[k]] = [coeffs[k], coeffs[i]];
          break;
        }
      }
    }

    const pivot = coeffs[i][minor];
    if (Math.abs(pivot) > 1e-10) {
      for (let j = 0; j < m; j++) {
        coeffs[i][j] /= pivot;
      }
    }

    for (let k = 0; k < n; k++) {
      if (k === i) continue;

      const factor = coeffs[k][minor];
      for (let j = 0; j < m; j++) {
        coeffs[k][j] -= factor * coeffs[i][j];
      }
    }
  }

  return coeffs;
}

function getNonBasic(totalCols: number, basis: number[]): number[] {
  const result: number[] = [];

  for (let i = 0; i < totalCols - 1; i++) {
    if (!basis.includes(i)) {
      result.push(i);
    }
  }

  return result;
}

function isValidBasis(matrix: number[][], basis: number[]): boolean {
  for (let row = 0; row < basis.length; row++) {
    const col = basis[row];

    if (Math.abs(matrix[row][col]) < 1e-10) {
      return false;
    }
  }

  return true;
}

function extractColumnsForDisplay(
  matrix: number[][],
  displayIndices: number[]
): number[][] {
  const result: number[][] = [];
  const lastCol = matrix[0].length - 1;

  for (let i = 0; i < matrix.length; i++) {
    const row: number[] = [];

    for (const colIdx of displayIndices) {
      row.push(matrix[i][colIdx]);
    }

    row.push(matrix[i][lastCol]);
    result.push(row);
  }

  return result;
}

function extractZForDisplay(
  z: number[],
  displayIndices: number[]
): number[] {
  const result: number[] = [];

  for (const colIdx of displayIndices) {
    if (colIdx < z.length) {
      result.push(z[colIdx]);
    } else {
      result.push(0);
    }
  }

  if (z.length > 0) {
    result.push(z[z.length - 1]);
  } else {
    result.push(0);
  }

  return result;
}
