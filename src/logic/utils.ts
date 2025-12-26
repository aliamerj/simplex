import type { ProblemData } from "@/types";

const EPS = 1e-10;

export const neg = (x: number) => x < -EPS;
export const pos = (x: number) => x > EPS;
export const zero = (x: number) => Math.abs(x) < EPS;

export const cloneM = (m: number[][]) => m.map(r => [...r]);
export const cloneA = (a: number[]) => [...a];

export function extractColumnsForDisplay(
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

export function extractZForDisplay(
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

export function performPivot(
  matrix: number[][],
  pivotRow: number,
  pivotCol: number
): number[][] {
  const result = matrix.map(row => [...row]);
  const pivotElement = result[pivotRow][pivotCol];

  // Normalize pivot row
  for (let j = 0; j < result[pivotRow].length; j++) {
    result[pivotRow][j] /= pivotElement;
  }

  // Eliminate pivot column from other rows
  for (let i = 0; i < result.length; i++) {
    if (i !== pivotRow) {
      const factor = result[i][pivotCol];
      for (let j = 0; j < result[i].length; j++) {
        result[i][j] -= factor * result[pivotRow][j];
      }
    }
  }

  return result;
}

export function buildMatrix(problem: ProblemData): number[][] {
  const matrix: number[][] = [];
  for (let i = 0; i < problem.numConstraints; i++) {
    const row: number[] = [];
    for (let j = 0; j < problem.numVariables; j++) {
      row.push(problem.constraintMatrix[i][j]);
    }
    row.push(problem.rightHandSide[i]);
    matrix.push(row);
  }
  return matrix;
}

export const getExampleProblem4 = (): ProblemData => ({ numVariables: 3, numConstraints: 3, objectiveCoefficients: [-1, 1, 0], constraintMatrix: [[-1, 3, 0], [1, -1, 0], [2, 1, 0]], rightHandSide: [6, 3, 9], objectiveType: 'min', });
export const getExampleProblem = (): ProblemData => ({ numVariables: 4, numConstraints: 2, objectiveCoefficients: [-2, -1, -3, -1], constraintMatrix: [[1, 2, 5, -1], [1, -1, -1, 2],], rightHandSide: [4, 1], objectiveType: 'min', });
export const getExampleProblem2 = (): ProblemData => ({ numVariables: 5, numConstraints: 3, objectiveCoefficients: [-1, 1, 0, 0, 0], constraintMatrix: [[2, -4, -1, 1, 0], [4, -3, -1, 1, 1], [1, 4, 1, 0, 1]], rightHandSide: [-3, 6, 15], objectiveType: 'min', });
export const getExampleProblem3 = (): ProblemData => ({ numVariables: 3, numConstraints: 2, objectiveCoefficients: [-1, 2, -1], constraintMatrix: [[1, 4, 1], [1, -2, -1]], rightHandSide: [5, -1], objectiveType: 'min', });
