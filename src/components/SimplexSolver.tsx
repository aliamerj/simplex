import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle, AlertTriangle, AlertCircle, Calculator,
  Zap, RefreshCw, Hash, Square,
  Table2, Settings, Info, Maximize2
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'

import { SimplexTableau } from './SimplexTableau'
import { useSimplexSolver } from '@/hooks/useSimplexSolver'
import type { ProblemData } from '@/types'
import { formatValue } from '@/utils/fractionUtils'
import { Input } from './ui/input'
import { ProblemInfo } from './ProblemInfo'

interface Props {
  problem: ProblemData
}

export const SimplexSolver: React.FC<Props> = ({ problem }) => {
  const solver = useSimplexSolver(problem)

  const steps = solver.solution.steps
  const lastStep = steps.at(-1)

  const solutionType = lastStep?.solutionType ?? 'not-solved'

  const [useCustomBasis, setUseCustomBasis] = useState(false)
  const [basisInput, setBasisInput] = useState('')
  const [basisError, setBasisError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('tableau')

  /* ---------------- BASIS PARSER ---------------- */

  const parseBasis = useCallback((): number[] | null => {
    if (!basisInput.trim()) return null

    const parts = basisInput.split(',').map(p => p.trim())
    const basis: number[] = []

    for (const p of parts) {
      const v = Number(p)
      if (!Number.isInteger(v)) {
        setBasisError(`Некорректное значение: ${p}`)
        return null
      }
      if (v < 0 || v >= problem.numVariables) {
        setBasisError(`x${v + 1} вне диапазона`)
        return null
      }
      basis.push(v)
    }

    setBasisError(null)
    return basis
  }, [basisInput, problem])

  /* ---------------- ACTIONS ---------------- */

  useEffect(() => {
    if (useCustomBasis) {
      const b = parseBasis()
      if (b) solver.solveAll(b)
    } else {
      solver.solveAll([])
    }
  }, [basisInput])

  /* ---------------- DERIVED ---------------- */

  const isOptimal = solutionType === 'optimal'
  const isUnbounded = solutionType === 'unbounded'
  const isInfeasible = solutionType === 'infeasible'
  const isSolving = !isOptimal && !isUnbounded && !isInfeasible && steps.length > 0

  const solutionVector = useMemo(() => {
    return `(${Object.values(solver.solution.x)
      .map(v => formatValue(v, solver.fractions))
      .join(', ')})`
  }, [solver.solution.x, solver.fractions])

  const getStatusColor = () => {
    if (isOptimal) return 'bg-green-500/20 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
    if (isUnbounded) return 'bg-orange-500/20 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'
    if (isInfeasible) return 'bg-red-500/20 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
    return 'bg-blue-500/20 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
  }

  const getStatusIcon = () => {
    if (isOptimal) return <CheckCircle className="h-5 w-5" />
    if (isUnbounded) return <AlertTriangle className="h-5 w-5" />
    if (isInfeasible) return <AlertCircle className="h-5 w-5" />
    return <RefreshCw className="h-5 w-5 animate-spin" />
  }

  const getStatusText = () => {
    if (isOptimal) return 'Оптимальное решение найдено'
    if (isUnbounded) return 'Задача неограничена'
    if (isInfeasible) return 'Нет допустимых решений'
    if (steps.length === 0) return 'Ожидание решения'
    return 'Решение в процессе'
  }

  /* ---------------- RENDER ---------------- */

  return (
    <div className="space-y-6">
      {/* HEADER WITH STATS */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Title and Status */}
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {useCustomBasis ? 'Симплекс-метод' : 'Метод искусственного базиса'}
              </h1>
              <p className="text-muted-foreground mt-2">
                Решение задачи линейного программирования
              </p>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              <Calculator className="mr-2 h-4 w-4" />
              {steps.length} шаг{steps.length !== 1 ? 'а' : ''}
            </Badge>
          </div>

          {/* Status Card */}
          <Card className={`border ${getStatusColor()} backdrop-blur-sm`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-white/50 dark:bg-gray-800/50">
                  {getStatusIcon()}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{getStatusText()}</h3>
                  {isOptimal && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-green-600" />
                        <span className="font-mono text-lg font-bold">
                          Z = {formatValue(solver.solution.objective, solver.fractions)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-blue-600" />
                        <span className="font-mono text-sm">
                          X = {solutionVector}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Quick Stats */}
        <Card className="lg:w-80">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Статистика</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Переменные</span>
                <span className="font-medium">{problem.numVariables}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ограничения</span>
                <span className="font-medium">{problem.numConstraints}</span>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="text-sm font-medium">Прогресс решения</div>
              <Progress value={isOptimal ? 100 : (steps.length * 20)} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CONTROLS */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5">
        <Card className='flex-1'>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Управление решением
            </CardTitle>
            <CardDescription>
              Настройте параметры и метод решения
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Settings Panel */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Настройки отображения</h4>
                <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <Hash className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="fractions" className="font-medium">Дробный формат</Label>
                      <p className="text-xs text-muted-foreground">Показывать значения как дроби</p>
                    </div>
                  </div>
                  <Switch
                    id="fractions"
                    checked={solver.fractions}
                    onCheckedChange={solver.toggleFractions}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <Square className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="custom-basis" className="font-medium">Начальный базис</Label>
                      <p className="text-xs text-muted-foreground">Задать базисные переменные</p>
                    </div>
                  </div>
                  <Switch
                    id="custom-basis"
                    checked={useCustomBasis}
                    onCheckedChange={setUseCustomBasis}
                  />
                </div>
              </div>

              {/* Basis Input Panel */}
              {useCustomBasis && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Настройка базиса</h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="basis-input" className="text-sm">
                        Индексы базисных переменных
                        <span className="text-xs text-muted-foreground ml-2">
                          (0-{problem.numVariables - 1})
                        </span>
                      </Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          id="basis-input"
                          value={basisInput}
                          onChange={e => setBasisInput(e.target.value)}
                          placeholder={`0,1,2,... (${problem.numConstraints} переменных)`}
                          className={`flex-1 ${basisError ? 'border-destructive' : ''}`}
                        />
                      </div>
                      {basisError && (
                        <div className="text-sm text-destructive mt-2 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          {basisError}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                      <Info className="h-3 w-3 inline mr-1" />
                      Введите индексы через запятую. Например: для базиса (x₁, x₂, s₁) введите "0,1,2"
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <ProblemInfo problem={problem} />
      </div>

      {/* MAIN CONTENT TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="tableau" className="flex items-center gap-2">
            <Table2 className="h-4 w-4" />
            Симплекс-таблица
          </TabsTrigger>
          <TabsTrigger value="variables" className="flex items-center gap-2">
            <Maximize2 className="h-4 w-4" />
            Все переменные
          </TabsTrigger>
        </TabsList>

        {/* TABLEAU TAB */}
        <TabsContent value="tableau" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Текущая симплекс-таблица</CardTitle>
                  <CardDescription>
                    {steps.length === 0 ? 'Начальное состояние' : `Итерация ${steps.length}`}
                    {useCustomBasis && basisInput && (
                      <span className="ml-2 text-primary">
                        • Базис: [{basisInput}]
                      </span>
                    )}
                  </CardDescription>
                </div>
                {isSolving && (
                  <Badge variant="outline" className="animate-pulse">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Вычисление...
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {lastStep ? (
                <div className="space-y-6">
                  {steps.map((step, index) => (
                    <div key={index} className="relative">
                      {/* Step Connector Line */}
                      {index < steps.length - 1 && (
                        <div className="absolute left-6 top-8 bottom-0 w-px bg-border -translate-x-1/2 z-0" />
                      )}

                      <Card
                        className={`relative overflow-hidden transition-all hover:shadow-md border-primary/30`}
                      >
                        <CardHeader
                          className="cursor-pointer pb-3"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">
                                  {`Шаг ${index}`}
                                </CardTitle>
                                <Badge variant={index === steps.length - 1 ? "default" : "outline"}>
                                  {index === steps.length - 1 ? 'Текущая' : 'Завершена'}
                                </Badge>
                              </div>
                              <CardDescription>
                                Z = {formatValue(step.z[step.z.length - 1], solver.fractions)}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="pt-0">
                          <div className="mt-4 border-t pt-4">
                            <SimplexTableau
                              step={step}
                              useFractions={solver.fractions}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 space-y-4">
                  <Calculator className="h-16 w-16 mx-auto text-muted-foreground/50" />
                  <div>
                    <h3 className="font-medium text-lg">Решение не начато</h3>
                    <p className="text-muted-foreground">
                      Настройте параметры и запустите решение
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VARIABLES TAB */}
        <TabsContent value="variables">
          <Card>
            <CardHeader>
              <CardTitle>Значения всех переменных</CardTitle>
              <CardDescription>
                Текущее решение на итерации {steps.length || 0}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Основные переменные */}
                <div>
                  <h4 className="font-medium mb-3 text-blue-600 dark:text-blue-400">
                    Основные переменные (x₁...xₙ)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {Object.entries(solver.solution.x)
                      .filter(([name]) => name.startsWith('x'))
                      .sort(([a], [b]) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
                      .map(([name, value]) => {
                        return (
                          <div key={name} className={`
                            bg-gray-50 dark:bg-gray-800 p-3 rounded-lg ring-2 ring-blue-500
                          `}>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{name}</div>
                            <div className="text-lg font-semibold">
                              {formatValue(value, solver.fractions)}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <Separator />

                {/* Краткая сводка */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Сводка решения:</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Целевая функция:</span>
                      <span className="font-semibold">Z = {formatValue(solver.solution.objective, solver.fractions)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Вектор решения:</span>
                      <span className="font-mono">{solutionVector}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Тип решения:</span>
                      <span className={`
                        ${isOptimal ? 'text-green-600' : ''}
                        ${isUnbounded ? 'text-orange-600' : ''}
                        ${isInfeasible ? 'text-red-600' : ''}
                        ${isSolving ? 'text-blue-600' : ''}
                      `}>
                        {isOptimal ? 'Оптимальное' :
                          isUnbounded ? 'Неограниченное' :
                            isInfeasible ? 'Недопустимое' :
                              'В процессе'}
                      </span>
                    </div>
                    {useCustomBasis && basisInput && (
                      <div className="flex justify-between">
                        <span>Начальный базис:</span>
                        <span className="font-mono">
                          [{basisInput}]
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
