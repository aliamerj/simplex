import type { ProblemData, Solution, SolverState, Step } from "@/types";
import { cloneSteps, findPotentialPivots, resolveSolutionType } from "./solverCommon";
import { cloneM, neg, performPivot } from "./utils";

export function doSimplex(problem: ProblemData, initialState: SolverState, method: "artificial" | "simplex"): Solution {
  let steps: Step[] = [];

  while (true) {
    const nextSteps = solveStepMode(problem, steps, initialState, method, 0);

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

  const lastStep = steps[steps.length - 1]
  if (lastStep.solutionType === 'optimal') {
    if (Object.values(x).length === 0) {
      steps[steps.length - 1] = { ...lastStep, solutionType: 'unbounded' }
    }
  }

  const objective = steps[steps.length - 1].z[steps[steps.length - 1].z.length - 1] * -1
  return {
    steps,
    objective,
    x,
    method,
    problem
  };

}


export function solveStepMode(
  problem: ProblemData,
  previousSteps: Step[],
  initialState: SolverState,
  method: "artificial" | "simplex",
  selectedPivotIndex?: number,
): Step[] {
  const steps = cloneSteps(previousSteps);

  if (steps.length === 0) {
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
  applyPivotToState(state, pivotPoint, method);

  return appendNextSnapshot(problem, steps, state);
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
    const { potentialPivots, hasNegative } = findPotentialPivots(state.matrix, state.z, {
      canLeaveBasis: value => !neg(value) && value !== 0,
    });
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

function applyPivotToState(state: SolverState, pivotPoint: [number, number], method: "artificial" | "simplex") {
  const [pivotRow, pivotCol] = pivotPoint;

  state.rowVariables[pivotRow] = state.colsVariables[pivotCol];


  const tableau = cloneM([...state.matrix, state.z]);
  const afterPivot = performPivot(tableau, pivotRow, pivotCol);
  if (method === 'artificial') {
    const finalized = afterPivot.map(row => row.filter((_, i) => i !== pivotCol));
    state.colsVariables = state.colsVariables.filter((_, i) => i !== pivotCol);
    state.matrix = finalized.slice(0, finalized.length - 1);
    state.z = finalized[finalized.length - 1];
    return;
  }
  state.matrix = afterPivot.slice(0, afterPivot.length - 1);
  state.z = afterPivot[afterPivot.length - 1];
}

export function extractSolutionFromSteps(problem: ProblemData, steps: Step[]) {
  const lastStep = steps.at(-1);

  if (!lastStep) {
    return createZeroSolution(problem.numVariables);
  }

  return extractSolution(lastStep.matrix, lastStep.rowVariables, problem.numVariables);
}

function createZeroSolution(totalVars: number) {
  const solution: Record<string, number> = {};
  for (let i = 1; i <= totalVars; i++) {
    solution[`x${i}`] = 0;
  }
  return solution;
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

  // Copy original coefficients with sign change (except RHS)
  for (let j = 0; j < colsVariables.length; j++) {
    const idx = parseInt(colsVariables[j].substring(1)) - 1;
    const coeff = problem.objectiveCoefficients[idx] ?? 0;

    newZ[j] = (j === rhsIndex) ? coeff : -coeff;
  }

  // Substitute basis rows
  for (let i = 0; i < rowVariables.length; i++) {

    const idx = parseInt(rowVariables[i].substring(1)) - 1;
    const coeff = problem.objectiveCoefficients[idx] ?? 0;

    if (coeff === 0) continue;

    for (let j = 0; j < cols; j++) {
      newZ[j] += coeff * matrix[i][j];
    }
  }
  if (problem.objectiveType === 'min') {
    // ⭐ Flip signs (+ to - and - to +)
    for (let j = 0; j < newZ.length; j++) {
      newZ[j] *= -1;
    }
  }


  return newZ;
}

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
    if (!variable || !variable.startsWith("x")) continue;

    const idx = Number(variable.slice(1));

    // Validate parsed index
    if (!Number.isInteger(idx) || idx <= 0 || idx > totalVars) continue;
    if (!matrix[i] || rhs < 0 || rhs >= matrix[i].length) continue;

    if (idx <= totalVars) {
      solution[`x${idx}`] = matrix[i][rhs];
    }
  }

  return solution;
}

function isAllZero(z: number[]) {
  return z.every(v => Math.abs(v) < 1e-10);
}

function isSameVector(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > 1e-10) return false;
  }
  return true;
}

