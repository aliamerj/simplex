import type { ProblemData, Solution, Step } from "@/types";
import { buildMatrix, extractColumnsForDisplay, extractZForDisplay, neg, performPivot, pos } from "./utils";
import { doSolveSimplex } from "./simplexSolver";


export function solveArtificial(
  problem: ProblemData
): Solution {
  const steps: Step[] = [];
  // =====================================================
  // INITIAL PREPARATION (Canonical form)
  // =====================================================
  // 1) Build the constraint matrix from the problem
  //    Format: [ A | b ]
  // 2) Ensure all right-hand side values (b) are >= 0
  //    If b < 0 → multiply the entire row by -1
  //    This is required for the simplex ratio test
  let matrix = normalizeRHS(buildMatrix(problem));

  // =====================================================
  // BUILD ARTIFICIAL OBJECTIVE FUNCTION (Phase I)
  // =====================================================
  // Phase I objective:
  //   minimize w = a1 + a2 + ... + am
  //
  // Implementation trick:
  //   w = −(sum of all constraint rows)
  //
  // This ensures that:
  //   - Artificial variables start in the basis
  //   - We can apply the standard simplex rules
  let z = buildArtificialTargetFunction(matrix);

  // =====================================================
  // BUILD ARTIFICIAL SYSTEM
  // =====================================================
  // For each constraint:
  //   - Add one artificial variable
  //   - Artificial variables form the initial basis
  //
  // Final matrix structure:
  //   [ A | I | b ]
  //
  // where:
  //   A → original coefficients
  //   I → identity matrix (artificial variables)
  //   b → RHS
  let {
    artificialMatrix,
    nonBasicVariables,
    artificialIndices,
    basis
  } = buildArtificialSystem(matrix);

  // Labels of basic variables (for visualization)
  let rowVars = basis.map(i => `x${i + 1}`);

  // =====================================================
  // PHASE I: ARTIFICIAL SIMPLEX ITERATIONS
  // =====================================================
  while (true) {
    const potentialPivots: [number, number][] = [];
    let hasNegative = false;
    const lastCol = artificialMatrix[0].length - 1;

    // -------------------------------------------------
    // STEP 1: Find entering variables
    // -------------------------------------------------
    // Rule:
    //   If any coefficient in z (except RHS) is negative,
    //   the solution is NOT optimal
    for (let col = 0; col < z.length - 1; col++) {
      // Negative coefficient → entering variable candidate
      if (neg(z[col])) {
        hasNegative = true;

        let minRow = -1;
        let minRatio = Infinity;

        // -------------------------------------------------
        // STEP 2: Find leaving variable (ratio test)
        // -------------------------------------------------
        // Only consider rows where pivot column value > 0
        for (let row = 0; row < basis.length; row++) {
          if (pos(artificialMatrix[row][col])) {

            //ratio = RHS / pivotColumnValue
            const ratio = artificialMatrix[row][lastCol] / artificialMatrix[row][col];

            // Choose the smallest non-negative ratio
            if (ratio < minRatio) {
              minRatio = ratio;
              minRow = row;
            }
          }
        }

        // Choose the smallest non-negative ratio
        if (minRow !== -1) {
          potentialPivots.push([minRow, col]);
        }
      }
    }

    // -------------------------------------------------
    // SAVE STEP (BEFORE PIVOT)
    // -------------------------------------------------
    steps.push({
      matrix: extractColumnsForDisplay(artificialMatrix, nonBasicVariables),
      z: extractZForDisplay(z, nonBasicVariables),
      potentialPivots: potentialPivots,
      colsVariables: nonBasicVariables.map(i => `x${i + 1}`),
      rowVariables: rowVars,
      solutionType: hasNegative ? 'not-solved' : 'optimal'
    });

    // -------------------------------------------------
    // PHASE I TERMINATION CHECK
    // -------------------------------------------------
    // If no negative coefficients remain in z:
    //   → Artificial objective is minimized
    if (!hasNegative) {
      const artificialObj = z[z.length - 1];

      // If artificial objective > 0
      // → original problem is infeasible
      if (pos(artificialObj)) {
        return {
          steps: [...steps, {
            solutionType: 'infeasible',
            matrix: [],
            z: [],
            potentialPivots: [],
            colsVariables: [],
            rowVariables: [],
          }],
          objective: NaN,
          x: {},
          method: 'artificial',
          problem,
        };
      }

      // Artificial objective == 0
      // → feasible solution found
      break;
    }

    // -------------------------------------------------
    // UNBOUNDED CHECK
    // -------------------------------------------------
    // Negative z exists but no valid pivot row
    if (potentialPivots.length === 0) {
      steps[steps.length - 1].solutionType = 'unbounded';
      break;
    }

    // -------------------------------------------------
    // STEP 3: Perform pivot
    // -------------------------------------------------
    // Choose the first valid pivot
    const [pivotRow, pivotCol] = potentialPivots[0];

    // update basis
    const leavingVar = basis[pivotRow];
    basis[pivotRow] = pivotCol;

    // Update non-basic variable list
    for (let i = 0; i < nonBasicVariables.length; i++) {
      if (nonBasicVariables[i] === pivotCol) {
        nonBasicVariables[i] = leavingVar;
        break;
      }
    }

    // Perform Gauss-Jordan pivot
    artificialMatrix = performPivot(artificialMatrix, pivotRow, pivotCol)

    // -------------------------------------------------
    // STEP 4: Update artificial objective function
    // -------------------------------------------------
    // z_new = z_old − z[pivotCol] * pivotRow
    const factor = z[pivotCol];
    for (let j = 0; j < z.length; j++) {
      if (j === z.length - 1) {
        z[j] = z[j] - factor * artificialMatrix[pivotRow][lastCol];
      } else {
        z[j] = z[j] - factor * artificialMatrix[pivotRow][j];
      }
    }

    // Update row variable labels
    rowVars = basis.map(i => `x${i + 1}`);
  }

  // =====================================================
  // PHASE I COMPLETE → REMOVE ARTIFICIAL VARIABLES
  // =====================================================
  // Remove artificial columns and keep only original system
  const mainMatrix = makeMainMatrix(artificialMatrix, artificialIndices);

  // Filter out artificial variables from basis
  const originalBasis = basis.filter(idx => idx < problem.numVariables);

  // =====================================================
  // PHASE II: STANDARD SIMPLEX
  // =====================================================  
  const simplexResult = doSolveSimplex(problem, mainMatrix, originalBasis);

  return {
    steps: [...steps, ...simplexResult.steps],
    objective: simplexResult.objective * (problem.objectiveType === 'min' ? -1 : 1),
    x: simplexResult.x,
    method: 'artificial',
    problem,
  };
}

function buildArtificialTargetFunction(matrix: number[][]): number[] {
  const rows = matrix.length;
  const originalCols = matrix[0].length;
  const z = new Array(originalCols).fill(0);

  for (let j = 0; j < originalCols; j++) {
    let sum = 0;
    for (let i = 0; i < rows; i++) {
      sum += matrix[i][j];
    }
    z[j] = -sum;
  }

  return z;
}



function buildArtificialSystem(matrix: number[][]) {
  const rows = matrix.length;
  const originalCols = matrix[0].length;
  const rhsCol = originalCols - 1;

  const artificialIndices = Array.from(
    { length: rows },
    (_, i) => rhsCol + i
  );

  const basis = [...artificialIndices];

  const artificialMatrix: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array(originalCols + rows).fill(0);

    for (let j = 0; j < rhsCol; j++) {
      row[j] = matrix[i][j];
    }

    row[artificialIndices[i]] = 1;
    row[row.length - 1] = matrix[i][rhsCol];

    return row;
  });

  const nonBasicVariables = new Array(originalCols - 1);
  for (let i = 0; i < nonBasicVariables.length; i++) {
    nonBasicVariables[i] = i;
  }

  return {
    artificialMatrix,
    artificialIndices,
    basis,
    nonBasicVariables,
  };
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

function makeMainMatrix(
  matrixArtificial: number[][],
  indexArtificialVariable: number[]
): number[][] {
  const originalCols = matrixArtificial[0].length - indexArtificialVariable.length;

  return matrixArtificial.map(row => {
    const mainRow = row.slice(0, originalCols - 1);
    mainRow.push(row[row.length - 1]);
    return mainRow;
  });
}
