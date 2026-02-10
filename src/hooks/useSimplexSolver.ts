import { useState, useCallback } from 'react';
import type { ProblemData, Solution } from '@/types';
import { getExampleProblem6 } from '@/logic/utils';
import { solveSimplex, solveSimplexStep } from '@/logic/simplexSolver';
import { solveArtificial, solveArtificialStep } from '@/logic/artificial';

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

  const solveAll = useCallback((indexBasis: number[]) => {
    let result: Solution;

    if (indexBasis.length === 0) {
      result = solveArtificial(solution.problem)
    } else {
      result = solveSimplex(solution.problem, indexBasis);
    }

    setSolution(prev => ({
      ...prev,
      ...result,
    }));
  }, [solution.problem]);

  const startStepByStep = useCallback((indexBasis: number[]) => {
    setSolution(prev => {
      if (prev.steps.length > 0) {
        return prev;
      }

      const result = indexBasis.length === 0
        ? {
          ...prev,
          steps: solveArtificialStep(prev.problem, []),
          method: 'artificial' as const,
        }
        : solveSimplexStep(prev.problem, indexBasis, []);

      return {
        ...prev,
        ...result,
      };
    });
  }, []);

  const solveStepByStep = useCallback((stepIndex: number, pivotIndex: number, indexBasis: number[]) => {
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

      if (indexBasis.length === 0) {
        const steps = solveArtificialStep(prev.problem, truncatedSteps, pivotIndex);

        return {
          ...prev,
          steps,
          method: 'artificial',
        };
      }

      const result = solveSimplexStep(prev.problem, indexBasis, truncatedSteps, pivotIndex);

      return {
        ...prev,
        ...result,
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
