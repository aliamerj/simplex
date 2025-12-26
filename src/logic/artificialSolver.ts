import type { ProblemData, Solution, Step } from "@/types";
import { buildMatrix, extractColumnsForDisplay, extractZForDisplay, neg, performPivot, pos } from "./utils";
import { doSolveSimplex } from "./simplexSolver";

// Now update your artificial basis to use this for Phase II
export function solveArtificial(
  problem: ProblemData
): Solution {
  const steps: Step[] = [];

  let matrix = normalizeRHS(buildMatrix(problem));
  let z = buildArtificialTargetFunction(matrix);

  let {
    artificialMatrix,
    nonBasicVariables,
    artificialIndices,
    basis
  } = buildArtificialSystem(matrix);

  let rowVars = basis.map(i => `x${i + 1}`);
  const oderIndexNoBasis = [...nonBasicVariables];
  let stepCount = 0;

  // Phase I: Artificial Basis
  while (true) {
    const potentialPivots: [number, number][] = [];
    let hasNegative = false;
    const lastCol = artificialMatrix[0].length - 1;

    for (let col = 0; col < z.length - 1; col++) {
      if (neg(z[col])) {
        hasNegative = true;

        let minRow = -1;
        let minRatio = Infinity;

        for (let row = 0; row < basis.length; row++) {
          if (pos(artificialMatrix[row][col])) {
            const ratio = artificialMatrix[row][lastCol] / artificialMatrix[row][col];
            if (ratio < minRatio) {
              minRatio = ratio;
              minRow = row;
            }
          }
        }

        if (minRow !== -1) {
          potentialPivots.push([minRow, col]);
        }
      }
    }

    // Save step BEFORE pivot
    steps.push({
      matrix: extractColumnsForDisplay(artificialMatrix, oderIndexNoBasis),
      z: extractZForDisplay(z, oderIndexNoBasis),
      potentialPivots: potentialPivots,
      colsVariables: oderIndexNoBasis.map(i => `x${i + 1}`),
      rowVariables: rowVars,
      solutionType: hasNegative ? 'not-solved' : 'optimal'
    });

    if (!hasNegative) {
      const artificialObj = z[z.length - 1];
      if (Math.abs(artificialObj) > 1e-10) {
        return {
          steps,
          objective: NaN,
          x: {},
          method: 'artificial',
          problem,
        };
      }
      break;
    }

    if (potentialPivots.length === 0) {
      steps[steps.length - 1].solutionType = 'unbounded';
      break;
    }

    const [pivotRow, pivotCol] = potentialPivots[0];

    const leavingVar = basis[pivotRow];
    basis[pivotRow] = pivotCol;

    for (let i = 0; i < nonBasicVariables.length; i++) {
      if (nonBasicVariables[i] === pivotCol) {
        nonBasicVariables[i] = leavingVar;
        break;
      }
    }

    for (let i = 0; i < oderIndexNoBasis.length; i++) {
      if (oderIndexNoBasis[i] === pivotCol) {
        oderIndexNoBasis[i] = leavingVar;
        break;
      }
    }

    artificialMatrix = performPivot(artificialMatrix, pivotRow, pivotCol)

    const factor = z[pivotCol];
    for (let j = 0; j < z.length; j++) {
      if (j === z.length - 1) {
        z[j] = z[j] - factor * artificialMatrix[pivotRow][lastCol];
      } else {
        z[j] = z[j] - factor * artificialMatrix[pivotRow][j];
      }
    }

    rowVars = basis.map(i => `x${i + 1}`);

    stepCount++;
    if (stepCount > 100) break;
  }

  // Phase I complete, create main matrix without artificial variables
  const mainMatrix = makeMainMatrix(artificialMatrix, artificialIndices);

  // Filter out artificial variables from basis
  const originalBasis = basis.filter(idx => idx < problem.numVariables);
  // Now run Phase II: Simplex Method
  const simplexResult = doSolveSimplex(problem, mainMatrix, originalBasis);

  // Combine steps from both phases
  const allSteps = [...steps, ...simplexResult.steps];

  return {
    steps: allSteps,
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
