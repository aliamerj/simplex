import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Calculator, History,
  CheckCircle, AlertTriangle, AlertCircle
} from 'lucide-react'

import { SimplexTableau } from './SimplexTableau'
import { useSimplexSolver } from '@/hooks/useSimplexSolver'
import type { ProblemData } from '@/types'
import { formatValue } from '@/utils/fractionUtils'
import { Input } from './ui/input'

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

  const solutionVector = useMemo(() => {
    return `(${Object.values(solver.solution.x)
      .map(v => formatValue(v, solver.fractions))
      .join(', ')})`
  }, [solver.solution.x, solver.fractions])

  /* ===================== UI ===================== */

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">
            {useCustomBasis ? 'Симплекс-метод' : 'Искусственный базис'}
          </h2>
          <p className="text-muted-foreground">
            Пошаговое решение задачи ЛП
          </p>
        </div>

        <Badge variant="outline">
          Шагов: {steps.length}
        </Badge>
      </div>

      {/* STATUS */}
      <Alert>
        {isOptimal && <CheckCircle className="h-4 w-4 text-green-600" />}
        {isUnbounded && <AlertTriangle className="h-4 w-4 text-orange-600" />}
        {isInfeasible && <AlertCircle className="h-4 w-4 text-red-600" />}

        <AlertTitle>
          {isOptimal && 'Оптимум найден'}
          {isUnbounded && 'Задача неограничена'}
          {isInfeasible && 'Нет допустимых решений'}
          {!isOptimal && !isUnbounded && !isInfeasible && 'Ожидание решения'}
        </AlertTitle>

        {isOptimal && (
          <AlertDescription>
            <div>Z = {formatValue(solver.solution.objective, solver.fractions)}</div>
            <div>X = {solutionVector}</div>
          </AlertDescription>
        )}
      </Alert>

      {/* CONTROLS */}
      <Card>
        <CardHeader>
          <CardTitle>Управление</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={solver.fractions}
                onCheckedChange={solver.toggleFractions}
              />
              <Label>Дроби</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={useCustomBasis}
                onCheckedChange={setUseCustomBasis}
              />
              <Label>Начальный базис</Label>
            </div>
          </div>

          {useCustomBasis && (
            <div className="space-y-2">
              <Input
                value={basisInput}
                onChange={e => setBasisInput(e.target.value)}
                placeholder={`Пример: 0,1 (${problem.numConstraints})`}
              />
              {basisError && (
                <div className="text-sm text-red-600">{basisError}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MAIN */}
      <Tabs defaultValue="tableau">
        <TabsList>
          <TabsTrigger value="tableau">
            <Calculator className="h-4 w-4 mr-2" />
            Таблица
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            История
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tableau">
          <Card>
            <CardHeader>
              <CardTitle>Текущая таблица</CardTitle>
            </CardHeader>
            <CardContent>
              {lastStep ? (
                <SimplexTableau
                  step={lastStep}
                  useFractions={solver.fractions}
                />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Нет данных
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-4">
            {steps.map((step, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle>Шаг {i}</CardTitle>
                </CardHeader>
                <CardContent>
                  <SimplexTableau
                    step={step}
                    useFractions={solver.fractions}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
