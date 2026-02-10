import { useState, useCallback } from 'react';
import type { ProblemData, Solution } from '@/types';
import { getExampleProblem6 } from '@/logic/utils';
import { solveSimplex, solveSimplexStep } from '@/logic/simplexSolver';
import { extractSolutionFromSteps, solveArtificial, solveArtificialStep } from '@/logic/artificial';
import { computeObjectiveFromX } from '@/logic/solverCommon';

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

      const steps = basis.length === 0
        ? solveArtificialStep(prev.problem, [])
        : solveSimplexStep(prev.problem, basis, []);

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

      const steps = basis.length === 0
        ? solveArtificialStep(prev.problem, truncatedSteps, pivotIndex)
        : solveSimplexStep(prev.problem, basis, truncatedSteps, pivotIndex);

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
