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

  // Store input values as strings for display, only convert to numbers on blur
  const [inputValues, setInputValues] = useState<{
    objective: string[];
    constraints: string[][];
    rhs: string[];
    numVariables: string;
    numConstraints: string;
  }>({
    objective: problem.objectiveCoefficients.map(String),
    constraints: problem.constraintMatrix.map(row => row.map(String)),
    rhs: problem.rightHandSide.map(String),
    numVariables: String(problem.numVariables),
    numConstraints: String(problem.numConstraints)
  });

  useEffect(() => {
    setLocalProblem(problem);
    setInputValues({
      objective: problem.objectiveCoefficients.map(String),
      constraints: problem.constraintMatrix.map(row => row.map(String)),
      rhs: problem.rightHandSide.map(String),
      numVariables: String(problem.numVariables),
      numConstraints: String(problem.numConstraints)
    });
  }, [problem]);

  const handleInputChange = (
    type: 'objective' | 'constraint' | 'rhs' | 'numVariables' | 'numConstraints',
    index: number | null,
    subIndex: number | null,
    value: string
  ) => {
    // Only update the display value for now
    if (type === 'objective' && index !== null) {
      setInputValues(prev => ({
        ...prev,
        objective: prev.objective.map((v, i) => i === index ? value : v)
      }));
    } else if (type === 'constraint' && index !== null && subIndex !== null) {
      setInputValues(prev => ({
        ...prev,
        constraints: prev.constraints.map((row, i) =>
          i === index ? row.map((v, j) => j === subIndex ? value : v) : row
        )
      }));
    } else if (type === 'rhs' && index !== null) {
      setInputValues(prev => ({
        ...prev,
        rhs: prev.rhs.map((v, i) => i === index ? value : v)
      }));
    } else if (type === 'numVariables') {
      setInputValues(prev => ({
        ...prev,
        numVariables: value
      }));
    } else if (type === 'numConstraints') {
      setInputValues(prev => ({
        ...prev,
        numConstraints: value
      }));
    }
  };

  const handleInputBlur = (
    type: 'objective' | 'constraint' | 'rhs' | 'numVariables' | 'numConstraints',
    index: number | null,
    subIndex: number | null
  ) => {
    // Get the current display value
    let displayValue = '';

    // Handle dimension types first
    if (type === 'numVariables') {
      displayValue = inputValues.numVariables;
      const numValue = displayValue === '' ? 1 : parseFloat(displayValue);
      const finalValue = Math.min(Math.max(1, isNaN(numValue) ? 1 : numValue), 16);

      const vars = finalValue;
      const consts = localProblem.numConstraints;

      const updatedProblem: ProblemData = {
        numVariables: vars,
        numConstraints: consts,
        objectiveCoefficients: Array(vars).fill(0),
        constraintMatrix: Array(consts)
          .fill(null)
          .map(() => Array(vars).fill(0)),
        rightHandSide: Array(consts).fill(0),
        objectiveType: localProblem.objectiveType,
      };

      setLocalProblem(updatedProblem);
      setInputValues(prev => ({
        ...prev,
        numVariables: String(vars),
        objective: Array(vars).fill('0'),
        constraints: Array(consts).fill(null).map(() => Array(vars).fill('0'))
      }));
      return;
    }

    if (type === 'numConstraints') {
      displayValue = inputValues.numConstraints;
      const numValue = displayValue === '' ? 1 : parseFloat(displayValue);
      const finalValue = Math.min(Math.max(1, isNaN(numValue) ? 1 : numValue), 16);

      const vars = localProblem.numVariables;
      const consts = finalValue;

      const updatedProblem: ProblemData = {
        numVariables: vars,
        numConstraints: consts,
        objectiveCoefficients: Array(vars).fill(0),
        constraintMatrix: Array(consts)
          .fill(null)
          .map(() => Array(vars).fill(0)),
        rightHandSide: Array(consts).fill(0),
        objectiveType: localProblem.objectiveType,
      };

      setLocalProblem(updatedProblem);
      setInputValues(prev => ({
        ...prev,
        numConstraints: String(consts),
        constraints: Array(consts).fill(null).map(() => Array(vars).fill('0')),
        rhs: Array(consts).fill('0')
      }));
      return;
    }

    // Handle other types (objective, constraint, rhs)
    if (type === 'objective' && index !== null) {
      displayValue = inputValues.objective[index];
    } else if (type === 'constraint' && index !== null && subIndex !== null) {
      displayValue = inputValues.constraints[index][subIndex];
    } else if (type === 'rhs' && index !== null) {
      displayValue = inputValues.rhs[index];
    } else {
      return; // Invalid parameters
    }

    // Parse the value, use appropriate default if empty or invalid
    const numValue = displayValue === '' ? 0 : parseFloat(displayValue);
    const finalValue = isNaN(numValue) ? 0 : numValue;

    // Update the actual problem data
    const newProblem = { ...localProblem };

    if (type === 'objective' && index !== null) {
      const newCoeffs = [...newProblem.objectiveCoefficients];
      newCoeffs[index] = finalValue;
      newProblem.objectiveCoefficients = newCoeffs;
    } else if (type === 'constraint' && index !== null && subIndex !== null) {
      const newMatrix = newProblem.constraintMatrix.map(row => [...row]);
      newMatrix[index][subIndex] = finalValue;
      newProblem.constraintMatrix = newMatrix;
    } else if (type === 'rhs' && index !== null) {
      const newRHS = [...newProblem.rightHandSide];
      newRHS[index] = finalValue;
      newProblem.rightHandSide = newRHS;
    }

    setLocalProblem(newProblem);

    // Update display value to show the parsed number (formatted)
    if (type === 'objective' && index !== null) {
      setInputValues(prev => ({
        ...prev,
        objective: prev.objective.map((v, i) => i === index ? String(finalValue) : v)
      }));
    } else if (type === 'constraint' && index !== null && subIndex !== null) {
      setInputValues(prev => ({
        ...prev,
        constraints: prev.constraints.map((row, i) =>
          i === index ? row.map((v, j) => j === subIndex ? String(finalValue) : v) : row
        )
      }));
    } else if (type === 'rhs' && index !== null) {
      setInputValues(prev => ({
        ...prev,
        rhs: prev.rhs.map((v, i) => i === index ? String(finalValue) : v)
      }));
    }
  };

  const handleSubmit = () => {
    // First, process all input values from display strings to actual numbers
    const updatedProblem = { ...localProblem };

    // Process objective coefficients
    updatedProblem.objectiveCoefficients = inputValues.objective.map(val => {
      const num = val === '' ? 0 : parseFloat(val);
      return isNaN(num) ? 0 : num;
    });

    // Process constraint matrix
    updatedProblem.constraintMatrix = inputValues.constraints.map(row =>
      row.map(val => {
        const num = val === '' ? 0 : parseFloat(val);
        return isNaN(num) ? 0 : num;
      })
    );

    // Process RHS
    updatedProblem.rightHandSide = inputValues.rhs.map(val => {
      const num = val === '' ? 0 : parseFloat(val);
      return isNaN(num) ? 0 : num;
    });

    // Process dimensions
    updatedProblem.numVariables = inputValues.numVariables === '' ? 1 :
      Math.min(Math.max(1, parseInt(inputValues.numVariables) || 1), 16);
    updatedProblem.numConstraints = inputValues.numConstraints === '' ? 1 :
      Math.min(Math.max(1, parseInt(inputValues.numConstraints) || 1), 16);

    setLocalProblem(updatedProblem);

    const validationErrors = validateProblemData(updatedProblem);
    if (validationErrors.length === 0) {
      onUpdate(updatedProblem);
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
                    type="text"
                    value={inputValues.numVariables}
                    onChange={(e) => handleInputChange('numVariables', null, null, e.target.value)}
                    onBlur={() => handleInputBlur('numVariables', null, null)}
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
                    type="text"
                    value={inputValues.numConstraints}
                    onChange={(e) => handleInputChange('numConstraints', null, null, e.target.value)}
                    onBlur={() => handleInputBlur('numConstraints', null, null)}
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
                          type="text"
                          value={inputValues.objective[index] || ''}
                          onChange={(e) => handleInputChange('objective', index, null, e.target.value)}
                          onBlur={() => handleInputBlur('objective', index, null)}
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
                            type="text"
                            value={inputValues.constraints[rowIndex]?.[colIndex] || ''}
                            onChange={(e) => handleInputChange('constraint', rowIndex, colIndex, e.target.value)}
                            onBlur={() => handleInputBlur('constraint', rowIndex, colIndex)}
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
                          type="text"
                          value={inputValues.rhs[rowIndex] || ''}
                          onChange={(e) => handleInputChange('rhs', rowIndex, null, e.target.value)}
                          onBlur={() => handleInputBlur('rhs', rowIndex, null)}
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
