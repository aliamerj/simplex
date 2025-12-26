import { useState, useCallback } from 'react';
import type { ProblemData, Solution } from '@/types';
import { solveArtificial } from '@/logic/artificialSolver';
import { getExampleProblem2 } from '@/logic/utils';
import { solveSimplex } from '@/logic/simplexSolver';

export const useSimplexSolver = (initialProblem?: ProblemData) => {
  const [fractions, setFractions] = useState<boolean>(false);
  const [solution, setSolution] = useState<Solution>(() => {
    const problem = initialProblem ?? getExampleProblem2();

    return {
      problem,
      steps: [],
      x: {},
      method: 'artificial',
      objective: 0,
    };
  });


  const solveAll = (basis: number[]) => {
    let result: Solution;
    if (basis.length === 0) {
      result = solveArtificial(solution.problem);
    } else {
      result = solveSimplex(solution.problem, basis);
    }

    setSolution(prev => ({
      ...prev,
      ...result,
    }));
  };

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
  }, [fractions]);

  return {
    fractions,
    solveAll,
    reset,
    toggleFractions,
    solution,
  };
};
