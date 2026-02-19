import type { ProblemData, Solution, SolverState } from "@/types";
import { buildMatrix, buildTargetFunction } from "./utils";
import { normalizeRhs } from "./solverCommon";
import { doSimplex } from "./solver";


export function solveArtificial(problem: ProblemData): Solution {
  const initialState = createInitialArtificialState(problem)
  return doSimplex(problem, initialState, 'artificial')
}

export function createInitialArtificialState(problem: ProblemData): SolverState {
  const matrix = normalizeRhs(buildMatrix(problem));
  const z = buildTargetFunction(matrix);

  const colsVariables = Array.from({ length: problem.numVariables })
    .map((_, i) => `x${i + 1}`);

  const rowVariables = Array.from({ length: problem.numConstraints })
    .map((_, i) => `x${i + problem.numVariables + 1}`);

  return {
    matrix,
    z,
    colsVariables,
    rowVariables,
    artificialPhase: true,
  };
}
