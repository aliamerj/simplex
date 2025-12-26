import type { ProblemData } from '../types';

export const validateProblemData = (problem: ProblemData): string[] => {
  const errors: string[] = [];

  // Check dimensions
  if (problem.numVariables > 16 || problem.numConstraints > 16) {
    errors.push('Maximum dimensions are 16x16');
  }

  if (problem.numVariables < 1 || problem.numConstraints < 1) {
    errors.push('At least one variable and one constraint required');
  }

  // Check arrays length
  if (problem.objectiveCoefficients.length !== problem.numVariables) {
    errors.push('Objective coefficients count must match number of variables');
  }

  if (problem.constraintMatrix.length !== problem.numConstraints) {
    errors.push('Constraint matrix rows must match number of constraints');
  }

  if (problem.rightHandSide.length !== problem.numConstraints) {
    errors.push('Right-hand side values count must match number of constraints');
  }

  if (problem.constraintSigns.length !== problem.numConstraints) {
    errors.push('Constraint signs count must match number of constraints');
  }

  // Check constraint matrix dimensions
  for (let i = 0; i < problem.constraintMatrix.length; i++) {
    if (problem.constraintMatrix[i].length !== problem.numVariables) {
      errors.push(`Row ${i + 1} has incorrect number of coefficients`);
      break;
    }
  }

  // Check for NaN values
  problem.objectiveCoefficients.forEach((coeff, index) => {
    if (isNaN(coeff)) {
      errors.push(`Objective coefficient x${index + 1} is not a valid number`);
    }
  });

  problem.constraintMatrix.forEach((row, rowIndex) => {
    row.forEach((coeff, colIndex) => {
      if (isNaN(coeff)) {
        errors.push(`Constraint coefficient at [${rowIndex + 1}, ${colIndex + 1}] is not valid`);
      }
    });
  });

  problem.rightHandSide.forEach((value, index) => {
    if (isNaN(value)) {
      errors.push(`Right-hand side value at constraint ${index + 1} is not valid`);
    }
  });

  return errors;
};

export const validatePivotSelection = (
  tableau: any,
  rowIndex: number,
  colIndex: number
): string | null => {
  if (rowIndex < 0 || rowIndex >= tableau.coefficients.length) {
    return 'Invalid row index';
  }

  if (colIndex < 0 || colIndex >= tableau.variables.length) {
    return 'Invalid column index';
  }

  const pivotElement = tableau.coefficients[rowIndex][colIndex];
  
  if (Math.abs(pivotElement) < 1e-8) {
    return 'Pivot element cannot be zero';
  }

  if (pivotElement < 0) {
    return 'Pivot element should be positive';
  }

  return null;
};
