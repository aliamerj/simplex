import { solveSimplex } from "@/logic/simplexSolver";
import { getExampleProblem3 } from "@/logic/utils";

export const runSimplexTest = () => {
  const x = solveSimplex(getExampleProblem3(), [1, 0, 1])
  console.log({ x })
};

