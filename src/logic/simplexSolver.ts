import type { ProblemData, Solution, Step } from "@/types";
import { buildMatrix, extractColumnsForDisplay, extractZForDisplay, neg, performPivot, pos } from "./utils";

export function solveSimplex(problem: ProblemData, baseVector: number[]): Solution {
  let matrix = buildMatrix(problem);
  const basis: number[] = [];

  for (let i = 0; i < baseVector.length; i++) {
    if (baseVector[i] === 1) {
      basis.push(i);
    }
  }
  if (basis.length !== problem.numConstraints) {
    return {
      steps: [{
        solutionType: 'infeasible',
        matrix:[],
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

  const matrixAfterGauss = solveGauss(
    matrix,
    problem.numConstraints,
    matrix[0].length,  // includes RHS
    basis
  );
  const result = doSolveSimplex(problem, matrixAfterGauss, basis)


  return { ...result, objective: result.objective * (problem.objectiveType === 'min' ? -1 : 1) }
}



export function doSolveSimplex(
  problem: ProblemData,
  initialMatrix: number[][],
  initialBasis: number[]
): Solution {
  const steps: Step[] = [];

  // Clone the matrix and basis
  let matrix = initialMatrix.map(row => [...row]);
  let basis = [...initialBasis];

  // Create target function from original objective coefficients
  // Teacher's targetFunction has length = matrix columns (including RHS column)
  const totalCols = matrix[0].length;
  let targetFunction = new Array(totalCols).fill(0);

  // Set objective coefficients for original variables
  for (let i = 0; i < problem.numVariables; i++) {
    targetFunction[i] = problem.objectiveCoefficients[i];
  }

  // Last element is objective value (starts at 0)
  targetFunction[totalCols - 1] = 0;

  // Compute initial target function (teacher's ComputeTargetFunction)
  targetFunction = computeTargetFunction(targetFunction, matrix, basis);

  // Get non-basic variables for display (oderIndexNoBasis)
  const nonBasicVariables: number[] = [];
  for (let i = 0; i < totalCols - 1; i++) {
    if (!basis.includes(i)) {
      nonBasicVariables.push(i);
    }
  }

  const oderIndexNoBasis = [...nonBasicVariables];
  let rowVars = basis.map(i => `x${i + 1}`);

  let stepCount = 0;

  while (true) {
    // TEACHER'S SIMPLEX: Find potential pivots
    const potentialPivots: [number, number][] = [];
    let hasNegative = false;
    const lastCol = matrix[0].length - 1;

    // Check all columns except the last one (RHS/objective)
    for (let col = 0; col < targetFunction.length - 1; col++) {
      if (neg(targetFunction[col])) {
        hasNegative = true;

        // Find minimum ratio row for this column
        let minRow = -1;
        let minRatio = Infinity;

        for (let row = 0; row < basis.length; row++) {
          if (pos(matrix[row][col])) {
            const ratio = matrix[row][lastCol] / matrix[row][col];
            if (ratio < minRatio) {
              minRatio = ratio;
              minRow = row;
            }
          }
        }

        if (minRow !== -1) {
          potentialPivots.push([minRow, col]);
        } else {
          // Unbounded
          steps.push({
            matrix: extractColumnsForDisplay(matrix, oderIndexNoBasis),
            z: extractZForDisplay(targetFunction, oderIndexNoBasis),
            potentialPivots: [],
            colsVariables: oderIndexNoBasis.map(i => `x${i + 1}`),
            rowVariables: rowVars,
            solutionType: 'unbounded'
          });

          return {
            steps,
            objective: targetFunction[targetFunction.length - 1],
            x: computeBasisSolution(matrix, basis, problem.numVariables),
            method: 'simplex',
            problem
          };
        }
      }
    }

    // Save step BEFORE pivot
    steps.push({
      matrix: extractColumnsForDisplay(matrix, oderIndexNoBasis),
      z: extractZForDisplay(targetFunction, oderIndexNoBasis),
      potentialPivots: [...potentialPivots],
      colsVariables: oderIndexNoBasis.map(i => `x${i + 1}`),
      rowVariables: rowVars,
      solutionType: hasNegative ? 'not-solved' : 'optimal'
    });

    // If no negative coefficients, we're optimal
    if (!hasNegative) {
      break;
    }

    // If no potential pivots but has negative, problem is unbounded
    if (potentialPivots.length === 0) {
      steps[steps.length - 1].solutionType = 'unbounded';
      break;
    }

    // Choose first potential pivot (teacher uses first negative column)
    const [pivotRow, pivotCol] = potentialPivots[0];

    // Update basis and non-basic variables
    const leavingVar = basis[pivotRow];
    basis[pivotRow] = pivotCol;

    // Update non-basic variables (oderIndexNoBasis)
    const enteringIndex = oderIndexNoBasis.indexOf(pivotCol);
    if (enteringIndex !== -1) {
      oderIndexNoBasis[enteringIndex] = leavingVar;
    }

    matrix = performPivot(matrix, pivotRow, pivotCol)

    // Update target function (teacher's ComputeTargetFunction)
    targetFunction = computeTargetFunction(targetFunction, matrix, basis);

    // Update row labels
    rowVars = basis.map(i => `x${i + 1}`);

    stepCount++;
    if (stepCount > 100) {
      console.warn("Too many simplex iterations");
      break;
    }
  }

  return {
    steps,
    objective: targetFunction[targetFunction.length - 1],
    x: computeBasisSolution(matrix, basis, problem.numVariables),
    method: 'simplex',
    problem
  };
}

// Teacher's ComputeBasisSolution implementation
function computeBasisSolution(
  matrix: number[][],
  basis: number[],
  numVariables: number
): Record<string, number> {
  const solution: Record<string, number> = {};

  // Initialize all variables to 0
  for (let i = 0; i < numVariables; i++) {
    solution[`x${i + 1}`] = 0;
  }

  // For each basic variable, find its value
  for (let row = 0; row < matrix.length; row++) {
    const basisIndex = basis[row];
    if (basisIndex < numVariables) {
      // Find the column in this row that has 1
      for (let col = 0; col < matrix[row].length - 1; col++) {
        if (Math.abs(matrix[row][col] - 1) < 1e-10 && col === basisIndex) {
          solution[`x${basisIndex + 1}`] = matrix[row][matrix[row].length - 1];
          break;
        }
      }
    }
  }

  return solution;
}

// Teacher's ComputeTargetFunction implementation
function computeTargetFunction(
  targetFunction: number[],
  matrix: number[][],
  basis: number[]
): number[] {
  const rows = matrix.length;
  const cols = matrix[0].length; // includes RHS

  // Create a copy of the target function
  const newTarget = [...targetFunction];

  // For each row, find the basic variable (column with 1 in that row)
  for (let i = 0; i < rows; i++) {
    let basisIndex = -1;

    // Find which column in this row has 1 (and is in basis)
    for (let j = 0; j < cols - 1; j++) {
      if (Math.abs(matrix[i][j] - 1) < 1e-10 && basis.includes(j)) {
        basisIndex = j;
        break;
      }
    }

    if (basisIndex === -1) {
      // Couldn't find basic variable in this row
      continue;
    }

    // Get the coefficient of this basic variable in the target function
    const basisCoefficient = targetFunction[basisIndex];

    // Update all non-basic columns (and RHS)
    for (let k = 0; k < cols; k++) {
      if (k !== basisIndex) {
        newTarget[k] = newTarget[k] - basisCoefficient * matrix[i][k];
      }
    }
  }

  // Set coefficients of basic variables to 0
  for (const basisIndex of basis) {
    newTarget[basisIndex] = 0;
  }

  return newTarget;
}


export function solveGauss(
  coefficients: number[][],
  n: number,     // number of rows
  m: number,     // number of columns (including RHS)
  minors: number[]  // basis indices for each row
): number[][] {
  // Create a deep copy
  let coeffs = coefficients.map(row => [...row]);

  // Forward elimination
  for (let i = 0; i < n; i++) {
    const minor = minors[i];

    // If pivot element is zero, try to switch rows
    if (Math.abs(coeffs[i][minor]) < 1e-10) {
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(coeffs[k][minor]) > 1e-10) {
          // Switch rows i and k
          [coeffs[i], coeffs[k]] = [coeffs[k], coeffs[i]];
          break;
        }
      }
    }

    // Normalize the pivot row by the pivot element
    const pivot = coeffs[i][minor];
    if (Math.abs(pivot) > 1e-10) {
      for (let j = 0; j < m; j++) {
        coeffs[i][j] /= pivot;
      }
    }

    // Eliminate this column from other rows
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = coeffs[k][minor];
        for (let j = 0; j < m; j++) {
          coeffs[k][j] -= factor * coeffs[i][j];
        }
      }
    }
  }

  return coeffs;
}
