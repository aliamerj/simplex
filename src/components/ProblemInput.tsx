import React, { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Save,
  Grid3x3,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { ProblemData } from '@/types';
import { validateProblemData } from '@/utils/validation';

interface ProblemInputProps {
  problem: ProblemData;
  onUpdate: (problem: ProblemData) => void;
  setActiveTab: Dispatch<SetStateAction<string>>

}
export const ProblemInput: React.FC<ProblemInputProps> = ({ problem, onUpdate, setActiveTab }) => {
  const [localProblem, setLocalProblem] = useState<ProblemData>(problem);
  const [errors, setErrors] = useState<string[]>([]);
  const [isObjectiveExpanded, setIsObjectiveExpanded] = useState(false);

  useEffect(() => {
    setLocalProblem(problem);
  }, [problem]);

  const handleInputChange = (
    type: 'objective' | 'constraint' | 'rhs',
    index: number,
    subIndex: number | null,
    value: string
  ) => {
    const newProblem = { ...localProblem };

    try {
      const numValue = parseFloat(value);

      if (type === 'objective') {
        const newCoeffs = [...newProblem.objectiveCoefficients];
        newCoeffs[index] = isNaN(numValue) ? 0 : numValue;
        newProblem.objectiveCoefficients = newCoeffs;
      } else if (type === 'constraint') {
        const newMatrix = newProblem.constraintMatrix.map(row => [...row]);
        newMatrix[index][subIndex!] = isNaN(numValue) ? 0 : numValue;
        newProblem.constraintMatrix = newMatrix;
      } else if (type === 'rhs') {
        const newRHS = [...newProblem.rightHandSide];
        newRHS[index] = isNaN(numValue) ? 0 : numValue;
        newProblem.rightHandSide = newRHS;
      }


      setLocalProblem(newProblem);
    } catch (error) {
      console.error('Invalid input:', error);
    }
  };

  const handleDimensionChange = (newNumVariables: number, newNumConstraints: number) => {
    const vars = Math.min(Math.max(1, newNumVariables), 16);
    const consts = Math.min(Math.max(1, newNumConstraints), 16);

    const newProblem: ProblemData = {
      numVariables: vars,
      numConstraints: consts,
      objectiveCoefficients: Array(vars).fill(0),
      constraintMatrix: Array(consts)
        .fill(null)
        .map(() => Array(vars).fill(0)),
      rightHandSide: Array(consts).fill(0),
      objectiveType: localProblem.objectiveType,
    };

    setLocalProblem(newProblem);
    setErrors([]);
  };

  const handleSubmit = () => {
    const validationErrors = validateProblemData(localProblem);
    if (validationErrors.length === 0) {
      onUpdate(localProblem);
      setErrors([]);
      setActiveTab("simplex");
    } else {
      setErrors(validationErrors);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Ошибки валидации */}
      {errors.length > 0 && (
        <Alert variant="destructive" className="text-sm sm:text-base">
          <AlertTitle>Обнаружены ошибки ввода</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Основные параметры задачи */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">Основные параметры</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Задайте размерность и тип задачи (максимум 16×16)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
            {/* Количество переменных */}
            <div className="space-y-2 sm:space-y-3">
              <Label htmlFor="numVariables" className="text-sm sm:text-base">
                Число переменных (x₁...xₙ)
              </Label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id="numVariables"
                    type="number"
                    min="1"
                    max="16"
                    value={localProblem.numVariables}
                    onChange={(e) => handleDimensionChange(
                      parseInt(e.target.value) || 1,
                      localProblem.numConstraints
                    )}
                    className="pr-12 text-sm sm:text-base"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs sm:text-sm">
                    ≤ 16
                  </div>
                </div>
                <Badge variant="secondary" className="whitespace-nowrap self-start sm:self-auto">
                  {localProblem.numVariables}/16
                </Badge>
              </div>
            </div>

            {/* Количество ограничений */}
            <div className="space-y-2 sm:space-y-3">
              <Label htmlFor="numConstraints" className="text-sm sm:text-base">
                Число ограничений
              </Label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id="numConstraints"
                    type="number"
                    min="1"
                    max="16"
                    value={localProblem.numConstraints}
                    onChange={(e) => handleDimensionChange(
                      localProblem.numVariables,
                      parseInt(e.target.value) || 1
                    )}
                    className="pr-12 text-sm sm:text-base"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs sm:text-sm">
                    ≤ 16
                  </div>
                </div>
                <Badge variant="secondary" className="whitespace-nowrap self-start sm:self-auto">
                  {localProblem.numConstraints}/16
                </Badge>
              </div>
            </div>

            {/* Тип целевой функции */}
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-sm sm:text-base">Тип целевой функции</Label>
              <div className="flex flex-col md:flex-row gap-2">
                <Button
                  type="button"
                  variant={localProblem.objectiveType === 'min' ? 'default' : 'outline'}
                  onClick={() => setLocalProblem({ ...localProblem, objectiveType: 'min' })}
                  size="sm"
                >
                  <Minimize2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="text-xs sm:text-sm">Минимизация</span>
                </Button>
                <Button
                  type="button"
                  variant={localProblem.objectiveType === 'max' ? 'default' : 'outline'}
                  onClick={() => setLocalProblem({ ...localProblem, objectiveType: 'max' })}
                  size="sm"
                >
                  <Maximize2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="text-xs sm:text-sm">Максимизация</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Коэффициенты целевой функции */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">Целевая функция</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Коэффициенты Cⱼ для переменных xⱼ
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <span className="font-medium text-base sm:text-lg whitespace-nowrap">
                {localProblem.objectiveType === 'max' ? 'max' : 'min'} Z =
              </span>
              <div className="flex-1 overflow-x-auto pb-2">
                <div className="flex items-center min-w-min gap-1 sm:gap-2">
                  {localProblem.objectiveCoefficients.map((coeff, index) => (
                    <div key={index} className="flex items-center">
                      {index > 0 && (
                        <span className="mx-1 sm:mx-2 text-gray-500 text-sm sm:text-base">
                          {coeff >= 0 ? '+' : ''}
                        </span>
                      )}
                      <div className="flex items-center bg-white dark:bg-gray-800 px-2 sm:px-3 py-1 sm:py-2 rounded-lg border min-w-25 sm:min-w-30">
                        <Input
                          type="number"
                          step="0.01"
                          value={coeff}
                          onChange={(e) => handleInputChange('objective', index, null, e.target.value)}
                          className="w-full text-center border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto text-sm sm:text-base"
                          placeholder="0"
                        />
                        <span className="ml-1 sm:ml-2 font-medium text-blue-600 dark:text-blue-400 text-sm sm:text-base">
                          x<sub className="text-xs sm:text-sm">{index + 1}</sub>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {localProblem.numVariables > 6 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsObjectiveExpanded(!isObjectiveExpanded)}
                className="text-xs text-gray-500"
              >
                {isObjectiveExpanded ? 'Свернуть' : 'Показать все коэффициенты'} →
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Матрица ограничений */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">Система ограничений</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Матрица коэффициентов ограничений A и вектор правых частей b
          </CardDescription>
        </CardHeader>
        <CardContent className="p-2 sm:p-4 md:p-6">
          <div className="overflow-x-auto -mx-2 sm:-mx-4 md:-mx-6 px-2 sm:px-4 md:px-6">
            <div className="min-w-150 sm:min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 sm:w-16 text-xs sm:text-sm">№</TableHead>
                    {Array.from({ length: localProblem.numVariables }).map((_, i) => (
                      <TableHead key={i} className="text-center text-xs sm:text-sm">
                        x<sub className="text-xs">{i + 1}</sub>
                      </TableHead>
                    ))}
                    <TableHead className="text-center w-16 sm:w-24 text-xs sm:text-sm">Знак</TableHead>
                    <TableHead className="text-center w-24 sm:w-32 bg-blue-50 dark:bg-blue-900/20 text-xs sm:text-sm">
                      b (Правая часть)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: localProblem.numConstraints }).map((_, rowIndex) => (
                    <TableRow key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <TableCell className="font-medium text-xs sm:text-sm">
                        {rowIndex + 1}
                      </TableCell>

                      {Array.from({ length: localProblem.numVariables }).map((_, colIndex) => (
                        <TableCell key={colIndex} className="p-1 sm:p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={localProblem.constraintMatrix[rowIndex]?.[colIndex] || 0}
                            onChange={(e) => handleInputChange('constraint', rowIndex, colIndex, e.target.value)}
                            className="w-full text-center text-xs sm:text-sm h-8 sm:h-10"
                            placeholder="0"
                          />
                        </TableCell>
                      ))}

                      <TableCell className="p-1 sm:p-2">
                        <div className="flex justify-center">
                          <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 border rounded bg-gray-50 dark:bg-gray-800">
                            <span className="text-sm sm:text-base">=</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="p-1 sm:p-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={localProblem.rightHandSide[rowIndex] || 0}
                          onChange={(e) => handleInputChange('rhs', rowIndex, null, e.target.value)}
                          className="w-full text-center bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-xs sm:text-sm h-8 sm:h-10"
                          placeholder="0"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 sm:gap-2 pt-2 border-t">
            <Grid3x3 className="h-3 w-3 sm:h-4 sm:w-4" />
            Размерность матрицы: {localProblem.numConstraints} × {localProblem.numVariables}
          </div>
        </CardContent>
      </Card>

      {/* Панель действий */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">Действия</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Сохраните задачу и перейдите к решению
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button
              onClick={handleSubmit}
              size="lg"
            >
              <Save className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              <span className="text-sm sm:text-base">Сохранить и решить</span>
            </Button>
          </div>

          <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400 space-y-1">
            <p>• Нажмите "Сохранить и решить" чтобы применить изменения и перейти к симплекс-методу</p>
            <p>• Для больших матриц используйте горизонтальную прокрутку на мобильных устройствах</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
