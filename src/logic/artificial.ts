import type { ProblemData, Solution, Step } from "@/types";
import { buildMatrix } from "./utils";


export function solveArtificial(problem: ProblemData): Solution {

  const steps: Step[] = [];

  let matrix = normalizeRHS(buildMatrix(problem));
  let z = buildArtificialTargetFunction(matrix);

  let colsVariables = Array.from({ length: problem.numVariables })
    .map((_, i) => `x${i + 1}`);

  let rowVariables = Array.from({ length: problem.numConstraints })
    .map((_, i) => `x${i + problem.numVariables + 1}`);

  let solved = false;
  let artificialPhase = true;

  while (!solved) {

    let potentialPivots: [number, number][] = [];
    let hasNegative = false;

    const lastCol = matrix[0].length - 1;

    // --- Find pivot candidates ---
    for (let col = 0; col < z.length - 1; col++) {

      if (neg(z[col])) {

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
    }

    // --- Save step snapshot ---
    steps.push({
      matrix: cloneM(matrix),
      z: [...z],
      potentialPivots: [...potentialPivots],
      colsVariables: [...colsVariables],
      rowVariables: [...rowVariables],
      solutionType: hasNegative ? 'not-solved' : 'optimal'
    });

    // --- Check termination / phase switch ---
    if (!hasNegative || potentialPivots.length === 0) {

      if (artificialPhase && isAllZero(z)) {

        // Switch to original objective
        z = rebuildOriginalZ(problem, matrix, rowVariables, colsVariables);
        artificialPhase = false;
        continue;
      }

      solved = true;
      break;
    }

    // --- Choose pivot (teacher logic: first candidate) ---
    const [pivotRow, pivotCol] = potentialPivots[0];

    // --- Update basis ---
    rowVariables[pivotRow] = colsVariables[pivotCol];
    colsVariables = colsVariables.filter((_, i) => i !== pivotCol);

    // --- Build tableau with Z row ---
    const tableau = cloneM([...matrix, z]);

    // --- Pivot ---
    const afterPivot = pivot(tableau, pivotRow, pivotCol);

    // --- Remove pivot column ---
    const finalized = afterPivot.map(row =>
      row.filter((_, i) => i !== pivotCol)
    );

    matrix = finalized.slice(0, finalized.length - 1);
    z = finalized[finalized.length - 1];
  }

  // --- Extract final solution ---
  const x = extractSolution(matrix, rowVariables, problem.numVariables);
  const objective = computeObjective(x, problem.objectiveCoefficients);

  return {
    steps,
    objective,
    x,
    method: 'artificial',
    problem
  };
}

/////////////////////////////////////////////////////////
// Helpers
/////////////////////////////////////////////////////////

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

  const solution: Record<number, number> = {};
  const rhs = matrix[0].length - 1;

  for (let i = 1; i <= totalVars; i++) {
    solution[i] = 0;
  }

  for (let i = 0; i < rowVariables.length; i++) {
    const idx = parseInt(rowVariables[i].substring(1));
    solution[idx] = matrix[i][rhs];
  }

  return solution;
}

/////////////////////////////////////////////////////////

function computeObjective(solution: Record<number, number>, C: number[]) {

  let value = 0;
  for (let i = 0; i < C.length; i++) {
    value += C[i] * solution[i + 1];
  }
  return value;
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

