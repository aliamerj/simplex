export type ObjectiveType = 'max' | 'min';
export type SolutionType = 'optimal' | 'unbounded' | 'infeasible' | 'not-solved';
export type Fraction = [number, number];

export interface ProblemData {
  numVariables: number; // Основные переменные (x1, x2, ..., xn)
  numConstraints: number;
  objectiveCoefficients: number[]; // Коэффициенты ЦФ для основных переменных
  constraintMatrix: number[][]; // Коэффициенты ограничений
  rightHandSide: number[]; // Правые части ограничений
  objectiveType: ObjectiveType;
}

export type Step = {
  matrix: number[][],
  z: number[],
  potentialPivots: [number, number][],
  colsVariables: string[],
  rowVariables: string[],
  selectedPivotIndex?: number,
  solutionType?: SolutionType;
}

export type Solution = {
  problem: ProblemData
  steps: Step[],
  x: Record<string, number>,
  method: 'simplex' | 'artificial',
  objective: number
}



export interface ConstraintLine {
  a: number;
  b: number;
  c: number;
  type: '≤' | '≥' | '=';
  intercepts: {
    x: number | null;
    y: number | null;
  };
}

export interface Point {
  x: number;
  y: number;
}

export interface FeasibleRegion {
  vertices: Point[];
  isBounded: boolean;
  isEmpty: boolean;
}

export interface GraphicalSolution {
  problem: ProblemData;
  constraints: ConstraintLine[];
  feasibleRegion: FeasibleRegion;
  objectiveLine: ConstraintLine;
  optimalPoint: Point | null;
  optimalValue: number | null;
  fullSolution: number[] | null;  // [x₁, x₂, s₁, s₂, s₃, ...]
  cornerPoints: Array<{
    point: Point;
    objectiveValue: number;
    fullSolution: number[];
    isOptimal: boolean;
  }>;
  normalVector: {
    x: number;
    y: number;
  };
  viewport: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  method: 'graphical';
  steps: Gstep[];
}

export interface Gstep {
  description: string;
  type: 'constraint' | 'objective' | 'feasible' | 'optimal';
  data?: any;
}

export type SolverState = {
  matrix: number[][];
  z: number[];
  colsVariables: string[];
  rowVariables: string[];
  artificialPhase: boolean;
  solutionType?: SolutionType;
};
