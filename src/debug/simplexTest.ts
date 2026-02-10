import { solveArtificial } from "@/logic/artificial";
import { getExampleProblem3 } from "@/logic/utils";

export const runSimplexTest = () => {
  const x = solveArtificial(getExampleProblem3())
  console.log({ x })
};

