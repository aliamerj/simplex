// types/index.ts
export type ObjectiveType = 'max' | 'min';
export type SolutionType = 'optimal' | 'unbounded' | 'infeasible' | 'not-solved';
export type Fraction = [number, number];

export interface ProblemData {
  numVariables: number; // Основные переменные (x1, x2, ..., xn)
  numConstraints: number;
  objectiveCoefficients: number[]; // Коэффициенты ЦФ для основных переменных
  constraintMatrix: number[][]; // Коэффициенты ограничений
  rightHandSide: number[]; // Правые части ограничений
  constraintSigns: ('≤' | '≥' | '=')[]; // Знаки ограничений
  objectiveType: ObjectiveType;
}

export type Step = {
  matrix: number[][],
  z: number[],
  potentialPivots: [number, number][],
  colsVariables: string[],
  rowVariables: string[],
  solutionType?: SolutionType;
}

export type Solution = {
  problem: ProblemData
  steps: Step[],
  x: Record<string, number>,
  method: 'simplex' | 'artificial',
  objective: number
}
