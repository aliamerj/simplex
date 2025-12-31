import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import type { ProblemData } from '@/types'
import { Separator } from '@radix-ui/react-separator'

export const ProblemInfo = ({ problem, isGrap = false }: { problem: ProblemData, isGrap?: boolean }) => {
  return (<Card>
    <CardHeader>
      <CardTitle>Постановка задачи</CardTitle>
    </CardHeader>

    <CardContent className="space-y-4">
      {/* Objective */}
      <div>
        <div className="text-sm text-muted-foreground mb-2">
          Целевая функция
        </div>
        <div className="font-mono text-lg">
          {problem.objectiveType === 'max' ? 'max' : 'min'} Z ={' '}
          {formatObjective(problem)}
        </div>
      </div>

      <Separator />

      {/* Constraints */}
      <div>
        <div className="text-sm text-muted-foreground mb-2">
          Ограничения
        </div>

        <div className="space-y-1">
          {problem.constraintMatrix.map((row, i) =>
            formatConstraintRow(row, problem.rightHandSide[i], i, isGrap)
          )}

          <div className="font-mono">
            {formatNonNegativity(problem.numVariables)}
          </div>
        </div>
      </div>
    </CardContent>
  </Card>


  )
}

const formatCoeff = (value: number, isFirst: boolean) => {
  if (Math.abs(value) < 1e-10) return null;

  const sign =
    isFirst
      ? value < 0 ? '−' : ''
      : value < 0 ? '−' : '+';

  const abs = Math.abs(value);
  const coeff = abs === 1 ? '' : abs.toString();

  return `${sign}${coeff}`;
};

const formatObjective = (problem: ProblemData) => {
  return problem.objectiveCoefficients
    .map((c, i) => {
      const part = formatCoeff(c, i === 0);
      if (!part) return null;

      return (
        <span key={i}>
          {part}x<sub>{i + 1}</sub>
        </span>
      );
    })
    .filter(Boolean);
};

const formatConstraintRow = (
  row: number[],
  rhs: number,
  index: number,
  isGrap: boolean,
) => {
  const terms = row
    .map((coeff, j) => {
      const part = formatCoeff(coeff, j === 0);
      if (part === null) return null;

      return (
        <span key={j}>
          {part}x<sub>{j + 1}</sub>
        </span>
      );
    })
    .filter(Boolean);

  return (
    <div key={index} className="font-mono">
      {terms.length ? terms : '0'} {isGrap ? "≤" : "="} {rhs}
    </div>
  );
};
const formatNonNegativity = (numVars: number) => {
  return Array.from({ length: numVars })
    .map((_, i) => `x${i + 1} ≥ 0`)
    .join(', ');
};

