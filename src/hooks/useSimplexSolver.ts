import { useState, useCallback } from 'react';
import type { ProblemData, Solution, Step } from '@/types';
import { getExampleProblem6 } from '@/logic/utils';
import { createInitialArtificialState, solveArtificial } from '@/logic/artificial';
import { computeObjectiveFromX } from '@/logic/solverCommon';
import { createInitialSimplexState, solveSimplex } from '@/logic/simplexMethod';
import { extractSolutionFromSteps, solveStepMode } from '@/logic/solver';

export const useSimplexSolver = (initialProblem?: ProblemData) => {
  const [fractions, setFractions] = useState<boolean>(false);
  const [solution, setSolution] = useState<Solution>(() => {
    const problem = initialProblem ?? getExampleProblem6();

    return {
      problem,
      steps: [],
      x: {},
      method: 'artificial',
      objective: 0,
    };
  });


  const solveAll = useCallback((basis: number[]) => {
    let result: Solution;
    if (basis.length === 0) {
      result = solveArtificial(solution.problem)
    } else {
      result = solveSimplex(solution.problem, basis);
    }

    setSolution(prev => ({
      ...prev,
      ...result,
    }));
  }, [solution.problem]);

  const startStepByStep = useCallback((basis: number[] = []) => {
    setSolution(prev => {
      if (prev.steps.length > 0) {
        return prev;
      }

      let steps: Step[] = [];
      if (basis.length === 0) {
        const initialState = createInitialArtificialState(prev.problem)
        steps = solveStepMode(prev.problem, [], initialState, 'artificial')

      } else {
        const initialState = createInitialSimplexState(prev.problem, basis)
        steps = solveStepMode(prev.problem, [], initialState, 'artificial')
      }
      return {
        ...prev,
        steps,
        method: basis.length === 0 ? 'artificial' : 'simplex',
      };
    });
  }, []);

  const solveStepByStep = useCallback((stepIndex: number, pivotIndex: number, basis: number[] = []) => {
    setSolution(prev => {
      if (stepIndex < 0 || stepIndex >= prev.steps.length) {
        return prev;
      }

      const truncatedSteps = prev.steps
        .slice(0, stepIndex + 1)
        .map(step => ({
          ...step,
          matrix: step.matrix.map(row => [...row]),
          z: [...step.z],
          potentialPivots: [...step.potentialPivots],
          colsVariables: [...step.colsVariables],
          rowVariables: [...step.rowVariables],
        }));

      let steps: Step[] = []
      if (basis.length === 0) {
        const initialState = createInitialArtificialState(prev.problem)
        steps = solveStepMode(prev.problem, truncatedSteps, initialState, "artificial", pivotIndex)

      } else {
        const initialState = createInitialSimplexState(prev.problem, basis)
        steps = solveStepMode(prev.problem, truncatedSteps, initialState, 'simplex', pivotIndex)
      }



      const x = extractSolutionFromSteps(prev.problem, steps);

      const objective = computeObjectiveFromX(x, prev.problem.objectiveCoefficients);

      return {
        ...prev,
        steps,
        x,
        objective,
        method: basis.length === 0 ? 'artificial' : 'simplex',
      };
    });
  }, []);

  const reset = useCallback(() => {
    setSolution(prev => ({
      ...prev,
      steps: [],
      x: {},
      objective: 0
    }));
  }, []);

  const toggleFractions = useCallback(() => {
    setFractions(prev => !prev);
  }, []);

  return {
    fractions,
    solveAll,
    reset,
    toggleFractions,
    startStepByStep,
    solveStepByStep,
    solution,
  };
};
