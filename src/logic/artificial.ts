import type { ProblemData, Solution, Step, SolutionType } from "@/types";
import { buildMatrix } from "./utils";


type SolverState = {
  matrix: number[][];
  z: number[];
  colsVariables: string[];
  rowVariables: string[];
  artificialPhase: boolean;
};

export function solveArtificial(problem: ProblemData): Solution {
  let steps: Step[] = [];

  while (true) {
    const nextSteps = solveArtificialStep(problem, steps, 0);

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

  const x = extractSolutionFromSteps(problem, steps);
  const objective = computeObjectiveFromX(x, problem.objectiveCoefficients);

  return {
    steps,
    objective,
    x,
    method: 'artificial',
    problem
  };
}

export function solveArtificialStep(
  problem: ProblemData,
  previousSteps: Step[],
  selectedPivotIndex?: number,
): Step[] {
  const steps = cloneSteps(previousSteps);

  if (steps.length === 0) {
    const initialState = createInitialState(problem);
    return appendNextSnapshot(problem, steps, initialState);
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

  const state = restoreState(problem, lastStep);
  applyPivotToState(state, pivotPoint);

  return appendNextSnapshot(problem, steps, state);
}

/////////////////////////////////////////////////////////
// Helpers
/////////////////////////////////////////////////////////

function createInitialState(problem: ProblemData): SolverState {
  const matrix = normalizeRHS(buildMatrix(problem));
  const z = buildArtificialTargetFunction(matrix);

  const colsVariables = Array.from({ length: problem.numVariables })
    .map((_, i) => `x${i + 1}`);

  const rowVariables = Array.from({ length: problem.numConstraints })
    .map((_, i) => `x${i + problem.numVariables + 1}`);

  return {
    matrix,
    z,
    colsVariables,
    rowVariables,
    artificialPhase: true,
  };
}

function restoreState(problem: ProblemData, step: Step): SolverState {
  const matrix = cloneM(step.matrix);
  const z = [...step.z];
  const colsVariables = [...step.colsVariables];
  const rowVariables = [...step.rowVariables];

  const originalZ = rebuildOriginalZ(problem, matrix, rowVariables, colsVariables);
  const artificialPhase = !isSameVector(z, originalZ);

  return {
    matrix,
    z,
    colsVariables,
    rowVariables,
    artificialPhase,
  };
}

function appendNextSnapshot(problem: ProblemData, steps: Step[], state: SolverState): Step[] {
  while (true) {
    const { potentialPivots, hasNegative } = findPotentialPivots(state.matrix, state.z);
    const solutionType = resolveSolutionType(hasNegative, potentialPivots);

    steps.push({
      matrix: cloneM(state.matrix),
      z: [...state.z],
      potentialPivots: [...potentialPivots],
      colsVariables: [...state.colsVariables],
      rowVariables: [...state.rowVariables],
      solutionType,
    });

    if (solutionType !== 'not-solved') {
      if (state.artificialPhase && isAllZero(state.z)) {
        state.z = rebuildOriginalZ(problem, state.matrix, state.rowVariables, state.colsVariables);
        state.artificialPhase = false;
        continue;
      }
    }

    return steps;
  }
}

function resolveSolutionType(hasNegative: boolean, potentialPivots: [number, number][]): SolutionType {
  if (!hasNegative) {
    return 'optimal';
  }

  if (potentialPivots.length === 0) {
    return 'unbounded';
  }

  return 'not-solved';
}

function findPotentialPivots(matrix: number[][], z: number[]) {
  const potentialPivots: [number, number][] = [];
  let hasNegative = false;
  const lastCol = matrix[0].length - 1;

  for (let col = 0; col < z.length - 1; col++) {
    if (!neg(z[col])) continue;

    hasNegative = true;

    let minRow = -1;
    let minRatio = Infinity;

    for (let row = 0; row < matrix.length; row++) {
      if (neg(matrix[row][col]) || matrix[row][col] === 0) continue;

      const ratio = matrix[row][lastCol] / matrix[row][col];
      if (ratio < minRatio) {
        minRatio = ratio;
        minRow = row;
      }
    }

    if (minRow !== -1) {
      potentialPivots.push([minRow, col]);
    }
  }

  return { potentialPivots, hasNegative };
}

function applyPivotToState(state: SolverState, pivotPoint: [number, number]) {
  const [pivotRow, pivotCol] = pivotPoint;

  state.rowVariables[pivotRow] = state.colsVariables[pivotCol];
  state.colsVariables = state.colsVariables.filter((_, i) => i !== pivotCol);

  const tableau = cloneM([...state.matrix, state.z]);
  const afterPivot = pivot(tableau, pivotRow, pivotCol);

  const finalized = afterPivot.map(row => row.filter((_, i) => i !== pivotCol));
  state.matrix = finalized.slice(0, finalized.length - 1);
  state.z = finalized[finalized.length - 1];
}

function extractSolutionFromSteps(problem: ProblemData, steps: Step[]) {
  const lastStep = steps.at(-1);

  if (!lastStep) {
    return createZeroSolution(problem.numVariables);
  }

  return extractSolution(lastStep.matrix, lastStep.rowVariables, problem.numVariables);
}

function computeObjectiveFromX(x: Record<string, number>, C: number[]) {
  let value = 0;
  for (let i = 0; i < C.length; i++) {
    value += C[i] * (x[`x${i + 1}`] ?? 0);
  }
  return value;
}

function createZeroSolution(totalVars: number) {
  const solution: Record<string, number> = {};
  for (let i = 1; i <= totalVars; i++) {
    solution[`x${i}`] = 0;
  }
  return solution;
}

function cloneSteps(steps: Step[]): Step[] {
  return steps.map(step => ({
    ...step,
    matrix: cloneM(step.matrix),
    z: [...step.z],
    potentialPivots: [...step.potentialPivots],
    colsVariables: [...step.colsVariables],
    rowVariables: [...step.rowVariables],
  }));
}

function normalizeRHS(matrix: number[][]): number[][] {

  const m = matrix.map(row => [...row]);

  for (let i = 0; i < m.length; i++) {
    if (m[i][m[0].length - 1] < 0) {
      for (let j = 0; j < m[0].length; j++) {
        m[i][j] *= -1;
      }
    }
  }

  return m;
}

function buildArtificialTargetFunction(matrix: number[][]): number[] {

  const rows = matrix.length;
  const cols = matrix[0].length;
  const z = new Array(cols).fill(0);

  for (let j = 0; j < cols; j++) {
    let sum = 0;
    for (let i = 0; i < rows; i++) {
      sum += matrix[i][j];
    }
    z[j] = -sum;
  }

  return z;
}

function pivot(matrix: number[][], pivotRow: number, pivotCol: number) {

  const pivotValue = matrix[pivotRow][pivotCol];

  // Normalize pivot row
  for (let j = 0; j < matrix[0].length; j++) {
    matrix[pivotRow][j] /= pivotValue;
  }

  // Eliminate other rows
  for (let i = 0; i < matrix.length; i++) {

    if (i === pivotRow) continue;

    const factor = matrix[i][pivotCol];

    for (let j = 0; j < matrix[0].length; j++) {
      matrix[i][j] -= factor * matrix[pivotRow][j];
    }
  }

  return matrix;
}

/////////////////////////////////////////////////////////

function rebuildOriginalZ(
  problem: ProblemData,
  matrix: number[][],
  rowVariables: string[],
  colsVariables: string[]
): number[] {

  const cols = matrix[0].length;
  const newZ = new Array(cols).fill(0);

  // Copy original coefficients
  for (let j = 0; j < colsVariables.length; j++) {
    const idx = parseInt(colsVariables[j].substring(1)) - 1;
    newZ[j] = problem.objectiveCoefficients[idx] ?? 0;
  }

  // Substitute basis rows
  for (let i = 0; i < rowVariables.length; i++) {

    const idx = parseInt(rowVariables[i].substring(1)) - 1;
    const coeff = problem.objectiveCoefficients[idx] ?? 0;

    if (coeff === 0) continue;

    for (let j = 0; j < cols; j++) {
      newZ[j] -= coeff * matrix[i][j];
    }
  }

  return newZ;
}

/////////////////////////////////////////////////////////

function extractSolution(
  matrix: number[][],
  rowVariables: string[],
  totalVars: number
) {

  const solution: Record<string, number> = {};
  const rhs = matrix[0].length - 1;

  for (let i = 1; i <= totalVars; i++) {
    solution[`x${i}`] = 0;
  }

  for (let i = 0; i < rowVariables.length; i++) {
    const variable = rowVariables[i];
    const idx = parseInt(variable.substring(1));

    if (idx <= totalVars) {
      solution[`x${idx}`] = matrix[i][rhs];
    }
  }

  return solution;
}

/////////////////////////////////////////////////////////

function cloneM(matrix: number[][]) {
  return matrix.map(r => [...r]);
}

function isAllZero(z: number[]) {
  return z.every(v => Math.abs(v) < 1e-10);
}

function neg(v: number) {
  return v < -1e-10;
}

function isSameVector(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > 1e-10) return false;
  }
  return true;
}
