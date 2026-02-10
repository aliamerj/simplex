import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ArrowUp, ArrowLeft, Star } from 'lucide-react';
import { formatValue } from '@/utils/fractionUtils';
import type { Step } from '@/types';

interface SimplexTableauProps {
  step: Step;
  useFractions: boolean;
  onPivotSelect?: (pivotIndex: number) => void;
}

export const SimplexTableau: React.FC<SimplexTableauProps> = ({
  step,
  useFractions,
  onPivotSelect,
}) => {
  if (!step) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          Таблица не доступна
        </CardContent>
      </Card>
    );
  }

  const { matrix, z, potentialPivots, rowVariables, colsVariables } = step;

  // Extract RHS from matrix (last column)
  const coefficients = matrix.map(row => row.slice(0, -1));
  const rhs = matrix.map(row => row[row.length - 1]);

  // Extract Z value (last element)
  const zRow = z.slice(0, -1);
  const zValue = z[z.length - 1];

  // Helper function to format values
  const formatCellValue = (value: number): string => {
    return formatValue(value, useFractions);
  };

  // Check if a cell is a potential pivot
  const isPotentialPivot = (row: number, col: number): boolean => {
    if (!potentialPivots || !Array.isArray(potentialPivots)) return false;
    return potentialPivots.some(([r, c]) => r === row && c === col);
  };

  const getPivotIndex = (row: number, col: number): number => {
    if (!potentialPivots || !Array.isArray(potentialPivots)) return -1;
    return potentialPivots.findIndex(([r, c]) => r === row && c === col);
  };

  // Group potential pivots by row for better display
  const potentialPivotsByRow: Record<number, number[]> = {};
  if (potentialPivots && Array.isArray(potentialPivots)) {
    potentialPivots.forEach(([row, col]) => {
      if (!potentialPivotsByRow[row]) {
        potentialPivotsByRow[row] = [];
      }
      potentialPivotsByRow[row].push(col);
    });
  }

  const hasPivots = potentialPivots && potentialPivots.length > 0;

  return (
    <div className="overflow-x-auto">
      <TooltipProvider>
        <table className="w-full border-collapse">
          {/* Header */}
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <th className="sticky left-0 z-10 border border-gray-300 dark:border-gray-600 px-4 py-3 text-left font-medium bg-gray-50 dark:bg-gray-800">
                Базис
              </th>

              {colsVariables.map((variable, colIndex) => {
                // Check if any potential pivot in this column
                const hasPivotInColumn = hasPivots &&
                  potentialPivots.some(([, c]) => c === colIndex);
                return (
                  <th
                    key={colIndex}
                    className={`border border-gray-300 dark:border-gray-600 px-4 py-3 text-left font-medium ${hasPivotInColumn
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : ''
                      }`}
                  >
                    <div className="flex items-center gap-1">
                      {variable}
                      {hasPivotInColumn && (
                        <Tooltip>
                          <TooltipTrigger>
                            <ArrowUp className="h-4 w-4 text-green-600" />
                          </TooltipTrigger>
                          <TooltipContent>Возможная переменная для ввода</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </th>
                );
              })}

              <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-left font-medium">
                RHS
              </th>
            </tr>
          </thead>

          <tbody>
            {/* Constraint rows */}
            {coefficients.map((row, rowIndex) => {
              const hasPivotsInRow = potentialPivotsByRow[rowIndex]?.length > 0;
              const isEvenRow = rowIndex % 2 === 0;

              return (
                <tr
                  key={rowIndex}
                  className={
                    isEvenRow
                      ? 'bg-white dark:bg-gray-900'
                      : 'bg-gray-50 dark:bg-gray-800'
                  }
                >
                  {/* Basis variable */}
                  <td
                    className={`sticky left-0 z-10 border border-gray-300 dark:border-gray-600 px-4 py-3 font-medium ${hasPivotsInRow
                        ? 'bg-yellow-100 dark:bg-yellow-900/30'
                        : isEvenRow
                          ? 'bg-white dark:bg-gray-900'
                          : 'bg-gray-50 dark:bg-gray-800'
                      }`}
                  >
                    <div className="flex items-center gap-1">
                      {rowVariables[rowIndex]}
                      {hasPivotsInRow && (
                        <Tooltip>
                          <TooltipTrigger>
                            <ArrowLeft className="h-4 w-4 text-yellow-600" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Возможная исключаемая переменная
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </td>

                  {/* Coefficients */}
                  {row.map((coeff, colIndex) => {
                    const isPivotCell = isPotentialPivot(rowIndex, colIndex);
                    const pivotIndex = getPivotIndex(rowIndex, colIndex);
                    const isSelectedPivot = step.selectedPivotIndex === pivotIndex;

                    return (
                      <td
                        key={colIndex}
                        className={`border border-gray-300 dark:border-gray-600 px-4 py-3 ${isPivotCell
                            ? 'bg-linear-to-br from-yellow-200 to-yellow-100 dark:from-yellow-900/50 dark:to-yellow-800/50 font-bold'
                            : colIndex % 2 === 0
                              ? 'bg-white/50 dark:bg-gray-900/50'
                              : ''
                          }`}
                      >
                        <Tooltip>
                          <TooltipTrigger
                            className={`w-full text-left ${isPivotCell && onPivotSelect ? 'cursor-pointer' : ''}`}
                            onClick={() => {
                              if (isPivotCell && onPivotSelect && pivotIndex !== -1) {
                                onPivotSelect(pivotIndex);
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span>{formatCellValue(coeff)}</span>
                              {isSelectedPivot && (
                                <Star className="h-3 w-3 text-yellow-600" />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {colsVariables[colIndex]} = {formatCellValue(coeff)}
                            {isPivotCell && ' (Возможный опорный элемент)'}
                            {isSelectedPivot && ' (Выбран)'}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}

                  {/* RHS */}
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 font-medium">
                    {formatCellValue(rhs[rowIndex])}
                  </td>
                </tr>
              );
            })}

            {/* Z Row */}
            <tr className="bg-linear-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-t-2 border-gray-300 dark:border-gray-600">
              <td className="sticky left-0 z-10 border border-gray-300 dark:border-gray-600 px-4 py-3 font-bold bg-blue-50 dark:bg-blue-900/20">
                Z
              </td>

              {zRow.map((coeff, colIndex) => {
                const hasPivotInColumn = hasPivots &&
                  potentialPivots.some(([, c]) => c === colIndex);
                return (
                  <td
                    key={colIndex}
                    className={`border border-gray-300 dark:border-gray-600 px-4 py-3 font-medium ${hasPivotInColumn
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : colIndex % 2 === 0
                          ? 'bg-blue-50/50 dark:bg-blue-900/10'
                          : ''
                      }`}
                  >
                    <Tooltip>
                      <TooltipTrigger className="w-full text-left">
                        {formatCellValue(coeff)}
                      </TooltipTrigger>
                      <TooltipContent>
                        Коэффициент при {colsVariables[colIndex]}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                );
              })}

              <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 font-bold">
                {formatCellValue(zValue)}
              </td>
            </tr>
          </tbody>
        </table>
      </TooltipProvider>
    </div>
  );
};
