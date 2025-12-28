import type { ProblemData, Solution, Step } from "@/types";
import { buildMatrix, cloneA, cloneM, extractColumnsForDisplay, extractZForDisplay, neg, performPivot, pos } from "./utils";

export function solveSimplex(problem: ProblemData, baseVector: number[]): Solution {

  // Build initial simplex tableau from the problem
  let matrix = buildMatrix(problem);

  // Basis array will store indices of basic variables
  const basis: number[] = [];

  // Extract basis indices from baseVector
  // baseVector[i] === 1 means variable xi is basic
  for (let i = 0; i < baseVector.length; i++) {
    if (baseVector[i] === 1) {
      basis.push(i);
    }
  }

  // If number of basic variables ≠ number of constraints,
  // we do not have a valid initial basis → infeasible
  if (basis.length !== problem.numConstraints) {
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

  // Apply Gauss-Jordan elimination to obtain canonical form
  // Ensures:
  //  - basic columns form identity matrix
  //  - RHS values are correct
  const matrixAfterGauss = solveGauss(
    matrix,
    problem.numConstraints,
    matrix[0].length,  // includes RHS
    basis
  );

  // Run the main simplex iteration
  const result = doSolveSimplex(problem, matrixAfterGauss, basis)

  // Adjust objective sign if the problem is minimization
  return {
    ...result,
    objective: result.objective * (problem.objectiveType === 'min' ? -1 : 1)
  }
}



export function doSolveSimplex(
  problem: ProblemData,
  initialMatrix: number[][],
  initialBasis: number[]
): Solution {
  const steps: Step[] = [];

  // Clone matrix and basis to avoid mutating input
  let matrix = cloneM(initialMatrix);
  let basis = [...initialBasis];

  // Number of columns including RHS
  const totalCols = matrix[0].length;

  // Initialize target function Z
  let targetFunction = new Array(totalCols).fill(0);


  // Set coefficients of original objective function
  for (let i = 0; i < problem.numVariables; i++) {
    targetFunction[i] = problem.objectiveCoefficients[i];
  }

  // RHS of target function starts at 0
  targetFunction[totalCols - 1] = 0;

  // Transform target function into canonical form
  targetFunction = computeTargetFunction(targetFunction, matrix, basis);

  // Determine non-basic variables (used for display)
  const nonBasicVariables: number[] = [];
  for (let i = 0; i < totalCols - 1; i++) {
    if (!basis.includes(i)) {
      nonBasicVariables.push(i);
    }
  }

  // Labels for basic variables (rows)
  let rowVars = basis.map(i => `x${i + 1}`);

  while (true) {
    // Store all possible pivot positions
    const potentialPivots: [number, number][] = [];
    let hasNegative = false;
    const lastCol = matrix[0].length - 1;

    // Check target function for negative coefficients
    // Negative coefficient → solution not optimal
    for (let col = 0; col < targetFunction.length - 1; col++) {
      if (neg(targetFunction[col])) {
        hasNegative = true;

        // Find minimum ratio row for this column
        let minRow = -1;
        let minRatio = Infinity;

        // Minimum ratio test to select leaving variable
        for (let row = 0; row < basis.length; row++) {
          if (pos(matrix[row][col])) {
            const ratio = matrix[row][lastCol] / matrix[row][col];
            if (ratio < minRatio) {
              minRatio = ratio;
              minRow = row;
            }
          }
        }

        // Valid pivot found
        if (minRow !== -1) {
          potentialPivots.push([minRow, col]);
        } else {
          // No valid pivot → unbounded problem
          steps.push({
            matrix: extractColumnsForDisplay(matrix, nonBasicVariables),
            z: extractZForDisplay(targetFunction, nonBasicVariables),
            potentialPivots: [],
            colsVariables: nonBasicVariables.map(i => `x${i + 1}`),
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


    // Save tableau BEFORE pivot
    steps.push({
      matrix: extractColumnsForDisplay(matrix, nonBasicVariables),
      z: extractZForDisplay(targetFunction, nonBasicVariables),
      potentialPivots: [...potentialPivots],
      colsVariables: nonBasicVariables.map(i => `x${i + 1}`),
      rowVariables: rowVars,
      solutionType: hasNegative ? 'not-solved' : 'optimal'
    });


    // No negative coefficients → optimal solution reached
    if (!hasNegative) {
      break;
    }


    // If no pivots but still negative → unbounded
    if (potentialPivots.length === 0) {
      steps[steps.length - 1].solutionType = 'unbounded';
      break;
    }

    // Choose first potential pivot
    const [pivotRow, pivotCol] = potentialPivots[0];

    // Update basis and non-basic variables
    const leavingVar = basis[pivotRow];
    basis[pivotRow] = pivotCol;

    // Update non-basic variables
    const enteringIndex = nonBasicVariables.indexOf(pivotCol);
    if (enteringIndex !== -1) {
      nonBasicVariables[enteringIndex] = leavingVar;
    }

    // Perform pivot operation on the matrix
    matrix = performPivot(matrix, pivotRow, pivotCol)

 
    // Recompute target function
    targetFunction = computeTargetFunction(targetFunction, matrix, basis);

    // Update row labels
    rowVars = basis.map(i => `x${i + 1}`);
  }

  return {
    steps,
    objective: targetFunction[targetFunction.length - 1],
    x: computeBasisSolution(matrix, basis, problem.numVariables),
    method: 'simplex',
    problem
  };
}


// Compute values of basic variables
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


  // Assign values to basic variables from RHS
  for (let row = 0; row < matrix.length; row++) {
    const basisIndex = basis[row];
    if (basisIndex < numVariables) {
      // Find the column in this row that has 1
      for (let col = 0; col < matrix[row].length - 1; col++) {
        if (matrix[row][col] - 1 < 1e-10 && col === basisIndex) {
          solution[`x${basisIndex + 1}`] = matrix[row][matrix[row].length - 1];
          break;
        }
      }
    }
  }

  return solution;
}


// Transform target function to canonical form
function computeTargetFunction(
  targetFunction: number[],
  matrix: number[][],
  basis: number[]
): number[] {
  const rows = matrix.length;
  const cols = matrix[0].length; // includes RHS

  // Create a copy of the target function
  const newTarget = cloneA(targetFunction);

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
  basis: number[]  // basis indices for each row
): number[][] {
  // Create a deep copy
  let coeffs = coefficients.map(row => [...row]);

  // Forward elimination
  for (let i = 0; i < n; i++) {
    const minor = basis[i];

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
    if (pivot > 1e-10) {
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
