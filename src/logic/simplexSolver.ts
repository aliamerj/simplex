import type { ProblemData, Solution, Step } from "@/types";
import { buildMatrix, cloneM, extractColumnsForDisplay, extractZForDisplay, neg, performPivot, pos } from "./utils";

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

  if (!isValidBasis(matrix, basis)) {
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
  targetFunction = computeTargetFunction(problem, matrix, basis);


  // Determine non-basic variables (used for display)
  let nonBasicVariables = getNonBasic(totalCols, basis);
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
    basis[pivotRow] = pivotCol;

    // Update non-basic variables
    const enteringIndex = nonBasicVariables.indexOf(pivotCol);
    if (enteringIndex !== -1) {
      nonBasicVariables = getNonBasic(totalCols, basis);
    }

    // Perform pivot operation on the matrix
    matrix = performPivot(matrix, pivotRow, pivotCol)

    //  
    // Recompute target function
    targetFunction = computeTargetFunction(problem, matrix, basis);

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

  // Initialize all variables
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


// Transform target function to canonical form
function computeTargetFunction(
  problem: ProblemData,
  matrix: number[][],
  basis: number[]
): number[] {

  const cols = matrix[0].length;
  const z = new Array(cols).fill(0);

  // Fill original objective coefficients
  for (let i = 0; i < problem.numVariables; i++) {
    z[i] = problem.objectiveCoefficients[i];
  }

  // RHS
  z[cols - 1] = 0;

  // Canonical transformation
  for (let row = 0; row < basis.length; row++) {

    const basicIndex = basis[row];

    // coefficient of basic variable in objective
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
