import React, { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Save, 
  Download, 
  Upload, 
  Grid3x3,
  Maximize2,
  Minimize2,
  FileText,
  Table as TableIcon
} from 'lucide-react';
import type { ProblemData } from '@/types';
import { validateProblemData } from '@/utils/validation';

interface ProblemInputProps {
  problem: ProblemData;
  onUpdate: (problem: ProblemData) => void;
  setActiveTab: Dispatch<SetStateAction<string>>

}

export const ProblemInput: React.FC<ProblemInputProps> = ({ problem, onUpdate,setActiveTab }) => {
  const [localProblem, setLocalProblem] = useState<ProblemData>(problem);
  const [errors, setErrors] = useState<string[]>([]);
  const [inputMode, setInputMode] = useState<'matrix' | 'manual'>('matrix');

  useEffect(() => {
    setLocalProblem(problem);
  }, [problem]);

  const handleInputChange = (
    type: 'objective' | 'constraint' | 'sign' | 'rhs',
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
      } else if (type === 'sign') {
        const newSigns = [...newProblem.constraintSigns];
        newSigns[index] = value as '≤' | '≥' | '=';
        newProblem.constraintSigns = newSigns;
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
      constraintSigns: Array(consts).fill('≤'),
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
     setActiveTab("artificial") 
    } else {
      setErrors(validationErrors);
    }
  };

  const handleSaveToFile = () => {
    // Функция сохранения в файл
    console.log('Save to file');
  };

  const handleLoadFromFile = () => {
    // Функция загрузки из файла
    console.log('Load from file');
  };

  return (
    <div className="space-y-6">
      {/* Заголовок и режимы ввода */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ввод задачи линейного программирования</h2>
          <p className="text-gray-600 dark:text-gray-400">Введите данные задачи в канонической форме</p>
        </div>
        <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'matrix' | 'manual')}>
          <TabsList>
            <TabsTrigger value="matrix" className="flex items-center gap-2">
              <TableIcon className="h-4 w-4" />
              Матричный ввод
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Формульный ввод
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Ошибки валидации */}
      {errors.length > 0 && (
        <Alert variant="destructive">
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
        <CardHeader>
          <CardTitle>Основные параметры</CardTitle>
          <CardDescription>
            Задайте размерность и тип задачи (максимум 16×16)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Количество переменных */}
            <div className="space-y-3">
              <Label htmlFor="numVariables">Число переменных (x₁...xₙ)</Label>
              <div className="flex items-center space-x-2">
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
                    className="pr-12"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                    ≤ 16
                  </div>
                </div>
                <Badge variant="secondary" className="whitespace-nowrap">
                  {localProblem.numVariables}/16
                </Badge>
              </div>
            </div>

            {/* Количество ограничений */}
            <div className="space-y-3">
              <Label htmlFor="numConstraints">Число ограничений</Label>
              <div className="flex items-center space-x-2">
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
                    className="pr-12"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                    ≤ 16
                  </div>
                </div>
                <Badge variant="secondary" className="whitespace-nowrap">
                  {localProblem.numConstraints}/16
                </Badge>
              </div>
            </div>

            {/* Тип целевой функции */}
            <div className="space-y-3">
              <Label>Тип целевой функции</Label>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant={localProblem.objectiveType === 'min' ? 'default' : 'outline'}
                  onClick={() => setLocalProblem({...localProblem, objectiveType: 'min'})}
                  className="flex-1"
                >
                  <Minimize2 className="mr-2 h-4 w-4" />
                  Минимизация
                </Button>
                <Button
                  type="button"
                  variant={localProblem.objectiveType === 'max' ? 'default' : 'outline'}
                  onClick={() => setLocalProblem({...localProblem, objectiveType: 'max'})}
                  className="flex-1"
                >
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Максимизация
                </Button>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Информация о знаках ограничений */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
              <p className="font-medium">Информация о типах ограничений:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Для ограничений ≤ используется слабачная переменная</li>
                <li>Для ограничений ≥ используется избыточная и искусственная переменная</li>
                <li>Для ограничений = используется искусственная переменная</li>
                <li>Метод искусственного базиса используется автоматически при наличии ≥ или =</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Коэффициенты целевой функции */}
      <Card>
        <CardHeader>
          <CardTitle>Целевая функция</CardTitle>
          <CardDescription>
            Коэффициенты Cⱼ для переменных xⱼ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-6">
              <span className="font-medium text-lg">
                {localProblem.objectiveType === 'max' ? 'max' : 'min'} Z =
              </span>
              <div className="flex items-center flex-wrap gap-2">
                {localProblem.objectiveCoefficients.map((coeff, index) => (
                  <div key={index} className="flex items-center">
                    {index > 0 && (
                      <span className="mx-2 text-gray-500">{coeff >= 0 ? '+' : ''}</span>
                    )}
                    <div className="flex items-center bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border">
                      <Input
                        type="number"
                        step="0.01"
                        value={coeff}
                        onChange={(e) => handleInputChange('objective', index, null, e.target.value)}
                        className="w-24 text-center border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
                        placeholder="0"
                      />
                      <span className="ml-2 font-medium text-blue-600 dark:text-blue-400">
                        x<sub>{index + 1}</sub>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Матрица ограничений */}
      <Card>
        <CardHeader>
          <CardTitle>Система ограничений</CardTitle>
          <CardDescription>
            Матрица коэффициентов ограничений A и вектор правых частей b
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">№</TableHead>
                  {Array.from({ length: localProblem.numVariables }).map((_, i) => (
                    <TableHead key={i} className="text-center">
                      x<sub>{i + 1}</sub>
                    </TableHead>
                  ))}
                  <TableHead className="text-center w-24">Знак</TableHead>
                  <TableHead className="text-center w-32 bg-blue-50 dark:bg-blue-900/20">b (Правая часть)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: localProblem.numConstraints }).map((_, rowIndex) => (
                  <TableRow key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <TableCell className="font-medium">
                      {rowIndex + 1}
                    </TableCell>
                    
                    {Array.from({ length: localProblem.numVariables }).map((_, colIndex) => (
                      <TableCell key={colIndex}>
                        <Input
                          type="number"
                          step="0.01"
                          value={localProblem.constraintMatrix[rowIndex]?.[colIndex] || 0}
                          onChange={(e) => handleInputChange('constraint', rowIndex, colIndex, e.target.value)}
                          className="w-full text-center"
                          placeholder="0"
                        />
                      </TableCell>
                    ))}
                    
                    <TableCell>
                      <Select
                        value={localProblem.constraintSigns[rowIndex]}
                        onValueChange={(value) => handleInputChange('sign', rowIndex, null, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="≤">≤</SelectItem>
                          <SelectItem value="≥">≥</SelectItem>
                          <SelectItem value="=">=</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={localProblem.rightHandSide[rowIndex] || 0}
                        onChange={(e) => handleInputChange('rhs', rowIndex, null, e.target.value)}
                        className="w-full text-center bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
                        placeholder="0"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <Grid3x3 className="h-4 w-4" />
            Размерность матрицы: {localProblem.numConstraints} × {localProblem.numVariables}
          </div>
        </CardContent>
      </Card>

      {/* Панель действий */}
      <Card>
        <CardHeader>
          <CardTitle>Действия</CardTitle>
          <CardDescription>
            Сохраните задачу и перейдите к решению
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              onClick={handleSubmit} 
              className="h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              size="lg"
            >
              <Save className="mr-2 h-5 w-5" />
              Сохранить и решить
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleSaveToFile} 
              className="h-12"
              size="lg"
            >
              <Download className="mr-2 h-5 w-5" />
              Сохранить в файл
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleLoadFromFile} 
              className="h-12"
              size="lg"
            >
              <Upload className="mr-2 h-5 w-5" />
              Загрузить из файла
            </Button>
          </div>
          
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 space-y-1">
            <p>• Нажмите "Сохранить и решить" чтобы применить изменения и перейти к симплекс-методу</p>
            <p>• Для задач с ограничениями ≥ или = будет автоматически использован метод искусственного базиса</p>
            <p>• Все данные сохраняются в формате JSON и могут быть загружены позже</p>
          </div>
        </CardContent>
      </Card>

      {/* Информационная панель */}
      <Alert>
        <AlertTitle>Информация о формате задачи</AlertTitle>
        <AlertDescription className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <p className="flex items-center gap-2">
              <span className="font-medium">•</span>
              Максимальный размер задачи: 16×16 переменных и ограничений
            </p>
            <p className="flex items-center gap-2">
              <span className="font-medium">•</span>
              Все правые части (b) должны быть ≥ 0 для канонической формы
            </p>
            <p className="flex items-center gap-2">
              <span className="font-medium">•</span>
              Для ограничений с ≥ или = используется метод искусственного базиса
            </p>
            <p className="flex items-center gap-2">
              <span className="font-medium">•</span>
              Коэффициенты могут быть целыми или дробными числами
            </p>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};
