import React, { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  ReferenceLine,
  Polygon,
  Tooltip
} from 'recharts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Target,
  CheckCircle,
  AlertTriangle,
  Info,
  ZoomIn,
  ZoomOut,
  Grid,
  CornerDownRight,
  AreaChart as AreaChartIcon,
  ArrowRight,
  VectorSquareIcon,
} from 'lucide-react';
import { solveGraphical } from '@/logic/graphicalSolver';
import { formatValue } from '@/utils/fractionUtils';
import type { ProblemData, Point } from '@/types';

interface GraphicalSolverProps {
  problem: ProblemData;
}

export const GraphicalSolver: React.FC<GraphicalSolverProps> = ({ problem }) => {
  const [zoom, setZoom] = useState(1);
  const [showObjectiveLines, setShowObjectiveLines] = useState(true);
  const [showFeasibleArea, setShowFeasibleArea] = useState(true);
  const [showNormalVector, setShowNormalVector] = useState(true);

  const solution = useMemo(() => {
    try {
      return solveGraphical(problem);
    } catch (error) {
      return null;
    }
  }, [problem]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));

  if (!solution) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Нельзя применить графический метод</AlertTitle>
        <AlertDescription>
          Графический метод применяется только для задач с двумя переменными.
          В данной задаче {problem.numVariables} переменн{problem.numVariables === 1 ? 'ая' : 'ых'}.
        </AlertDescription>
      </Alert>
    );
  }

  const formatConstraint = (constraint: any) => {
    const a = formatValue(constraint.a, true);
    const b = formatValue(constraint.b, true);
    const c = formatValue(constraint.c, true);

    let eq = '';
    if (Math.abs(constraint.a) > 1e-10) {
      eq += `${a === '1' ? '' : a}x₁`;
    }
    if (Math.abs(constraint.b) > 1e-10) {
      const sign = constraint.b > 0 ? '+' : '';
      const bStr = Math.abs(constraint.b) === 1 ? '' : b;
      eq += `${sign}${bStr}x₂`;
    }
    return `${eq} ${constraint.type} ${c}`;
  };

  // Prepare chart data
  const { chartData, constraintLines, objectiveLines, feasiblePolygon, normalVectorData } = useMemo(() => {
    // Get all corner points from solution
    const cornerPoints = solution.cornerPoints.map(cp => cp.point);
    
    // Find min and max coordinates for chart bounds
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    
    cornerPoints.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });
    
    // Add some padding
    maxX = Math.ceil(maxX) + 1;
    maxY = Math.ceil(maxY) + 1;
    
    // Create a proper polygon from corner points in correct order
    const createPolygonFromPoints = (points: Point[]): Point[] => {
      if (points.length < 3) return points;
      
      // Sort points in counter-clockwise order starting from the origin (0,0) if it exists
      const sorted = [...points].sort((a, b) => {
        // First, check if point is origin
        if (a.x === 0 && a.y === 0) return -1;
        if (b.x === 0 && b.y === 0) return 1;
        
        // Calculate angle from origin
        const angleA = Math.atan2(a.y, a.x);
        const angleB = Math.atan2(b.y, b.x);
        return angleA - angleB;
      });
      
      // Close the polygon
      if (sorted.length > 0 && (sorted[0].x !== sorted[sorted.length - 1].x || 
          sorted[0].y !== sorted[sorted.length - 1].y)) {
        return [...sorted, sorted[0]];
      }
      
      return sorted;
    };
    
    const feasiblePolygon = createPolygonFromPoints(cornerPoints);

    // Constraint lines - generate lines that bound the feasible region
    const constraintLines = solution.constraints.map((constraint, index) => {
      const points: Array<{ x: number, y: number }> = [];
      
      if (constraint.b !== 0) {
        // y = (c - a*x) / b
        // Generate points for the line segment that's visible in the chart
        for (let x = 0; x <= maxX; x += 0.5) {
          const y = (constraint.c - constraint.a * x) / constraint.b;
          // Only include points within chart bounds and that could be on the boundary
          if (y >= 0 && y <= maxY) {
            points.push({ x, y });
          }
        }
      } else if (constraint.a !== 0) {
        // Vertical line: x = c / a
        const x = constraint.c / constraint.a;
        if (x >= 0 && x <= maxX) {
          for (let y = 0; y <= maxY; y += 0.5) {
            points.push({ x, y });
          }
        }
      }
      
      return {
        id: index,
        name: formatConstraint(constraint),
        points,
        color: index < solution.constraints.length - 2
          ? `hsl(${index * 60}, 70%, 50%)`
          : '#94a3b8'
      };
    });

    // Objective function lines - level lines
    const objectiveLines = [];
    if (solution.cornerPoints.length > 0 && showObjectiveLines && solution.optimalValue !== null) {
      const optimalValue = solution.optimalValue;
      const values = [
        optimalValue * 0.5,
        optimalValue * 0.75,
        optimalValue,
        optimalValue * 1.25
      ];

      for (const value of values) {
        const a = solution.objectiveLine.a;
        const b = solution.objectiveLine.b;
        const points: Array<{ x: number, y: number }> = [];

        if (b !== 0) {
          // Generate line within chart bounds
          for (let x = 0; x <= maxX; x += 0.5) {
            const y = (value - a * x) / b;
            if (y >= 0 && y <= maxY) {
              points.push({ x, y });
            }
          }
        } else if (a !== 0) {
          // Vertical line
          const x = value / a;
          if (x >= 0 && x <= maxX) {
            for (let y = 0; y <= maxY; y += 0.5) {
              points.push({ x, y });
            }
          }
        }

        objectiveLines.push({
          value,
          points,
          isOptimal: Math.abs(value - optimalValue) < 1e-10
        });
      }
    }

    // Normal vector data
    const normalVectorData = showNormalVector && solution.optimalPoint ? {
      start: solution.optimalPoint,
      end: {
        x: solution.optimalPoint.x + solution.normalVector.x * 0.5,
        y: solution.optimalPoint.y + solution.normalVector.y * 0.5
      }
    } : null;

    return {
      chartData: { maxX, maxY },
      constraintLines,
      objectiveLines,
      feasiblePolygon,
      normalVectorData
    };
  }, [solution, showObjectiveLines, showNormalVector]);


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Графический метод
          </h2>
          <p className="text-muted-foreground">
            Визуальное решение задачи с двумя переменными
          </p>
        </div>
        <Badge variant={solution.feasibleRegion.isEmpty ? "destructive" : "default"}>
          {solution.feasibleRegion.isEmpty
            ? "Нет допустимой области"
            : solution.feasibleRegion.isBounded
              ? "Ограниченная область"
              : "Неограниченная область"}
        </Badge>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Optimal Solution Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Оптимальное решение
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {solution.optimalPoint ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">x₁</div>
                    <div className="text-2xl font-bold">
                      {formatValue(solution.optimalPoint.x, true)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">x₂</div>
                    <div className="text-2xl font-bold">
                      {formatValue(solution.optimalPoint.y, true)}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Полный вектор решения</div>
                  <div className="font-mono text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded">
                    ({solution.fullSolution?.map(v => formatValue(v, true)).join(', ')})
                  </div>
                </div>

                <Separator />

                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Целевая функция</div>
                  <div className="text-2xl font-bold text-primary">
                    Z = {formatValue(solution.optimalValue!, true)}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Вектор нормали</div>
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    <span className="font-mono">
                      n = ({formatValue(solution.normalVector.x, true)}, {formatValue(solution.normalVector.y, true)})
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {solution.feasibleRegion.isEmpty
                    ? "Область допустимых решений пуста"
                    : "Целевая функция неограничена"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Problem Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Постановка задачи</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-2">Целевая функция</div>
              <div className="font-mono text-lg">
                {problem.objectiveType === 'max' ? 'max' : 'min'} Z =
                {problem.objectiveCoefficients.map((coeff, i) => (
                  <span key={i}>
                    {i > 0 && coeff >= 0 && '+'}
                    {formatValue(coeff, true)}x<sub>{i + 1}</sub>
                  </span>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <div className="text-sm text-muted-foreground mb-2">Ограничения</div>
              <div className="space-y-2">
                {solution.constraints.slice(0, -2).map((constraint, i) => (
                  <div key={i} className="font-mono">
                    {formatConstraint(constraint)}
                  </div>
                ))}
                <div className="font-mono">x₁ ≥ 0, x₂ ≥ 0</div>
              </div>
            </div>

            <Separator />

            <div className="text-sm text-muted-foreground">
              <div className="flex items-center gap-2 mb-1">
                <VectorSquareIcon className="h-4 w-4" />
                Вектор нормали указывает направление роста целевой функции
              </div>
              <div className="text-xs">
                При максимизации двигаемся по направлению вектора, при минимизации — против
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graph Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Управление графиком</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">Масштаб: {zoom.toFixed(1)}x</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            <div className="flex flex-wrap gap-2">
              <Button
                variant={showObjectiveLines ? "default" : "outline"}
                size="sm"
                onClick={() => setShowObjectiveLines(!showObjectiveLines)}
              >
                <Grid className="h-4 w-4 mr-2" />
                Линии уровня
              </Button>

              <Button
                variant={showFeasibleArea ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFeasibleArea(!showFeasibleArea)}
              >
                <AreaChartIcon className="h-4 w-4 mr-2" />
                Область
              </Button>

              <Button
                variant={showNormalVector ? "default" : "outline"}
                size="sm"
                onClick={() => setShowNormalVector(!showNormalVector)}
              >
                <VectorSquareIcon className="h-4 w-4 mr-2" />
                Вектор нормали
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Graph */}
      <Card>
        <CardHeader>
          <CardTitle>Графическое решение</CardTitle>
          <CardDescription>
            Область допустимых решений и линии уровня целевой функции
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-125 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

                <XAxis
                  type="number"
                  dataKey="x"
                  name="x₁"
                  domain={[0, chartData.maxX]}
                  tickFormatter={(value) => formatValue(value, true)}
                  label={{ value: 'x₁', position: 'insideBottom', offset: -10 }}
                />

                <YAxis
                  type="number"
                  dataKey="y"
                  name="x₂"
                  domain={[0, chartData.maxY]}
                  tickFormatter={(value) => formatValue(value, true)}
                  label={{ value: 'x₂', angle: -90, position: 'insideLeft' }}
                />

                <Tooltip
                  formatter={(value: any, name?: string) => {
                    if (name === 'x') return [formatValue(value, true), 'x₁'];
                    if (name === 'y') return [formatValue(value, true), 'x₂'];
                    return [value, name];
                  }}
                />

                <Legend />

                {/* Feasible Area - Highlight the entire polygon */}
                {showFeasibleArea && feasiblePolygon.length > 0 && (
                  <Polygon
                    points={feasiblePolygon.map(p => ({ x: p.x, y: p.y }))}
                    fill="#22c55e" // Green color
                    fillOpacity={0.3}
                    stroke="#22c55e"
                    strokeWidth={1.5}
                    name="Допустимая область"
                  />
                )}

                {/* Constraint Lines */}
                {constraintLines.map((line) => (
                  <Line
                    key={line.id}
                    type="linear"
                    data={line.points}
                    dataKey="y"
                    stroke={line.color}
                    strokeWidth={2}
                    strokeDasharray={line.id >= solution.constraints.length - 2 ? "3 3" : undefined}
                    dot={false}
                    name={line.name}
                    connectNulls
                  />
                ))}

                {/* Objective Function Lines */}
                {showObjectiveLines && objectiveLines.map((line, index) => (
                  <Line
                    key={index}
                    type="linear"
                    data={line.points}
                    dataKey="y"
                    stroke={line.isOptimal ? "#ef4444" : "#94a3b8"}
                    strokeWidth={line.isOptimal ? 3 : 1}
                    strokeDasharray={line.isOptimal ? undefined : "2 2"}
                    dot={false}
                    name={line.isOptimal ? `Оптимальная линия (Z = ${formatValue(line.value, true)})` : `Z = ${formatValue(line.value, true)}`}
                    connectNulls
                  />
                ))}

                {/* Normal Vector */}
                {showNormalVector && normalVectorData && (
                  <ReferenceLine
                    segment={[
                      { x: normalVectorData.start.x, y: normalVectorData.start.y },
                      { x: normalVectorData.end.x, y: normalVectorData.end.y }
                    ]}
                    stroke="#10b981"
                    strokeWidth={3}
                    label={{
                      value: 'n',
                      position: 'end',
                      fill: '#10b981',
                      fontSize: 14,
                      fontWeight: 'bold'
                    }}
                  />
                )}

                {/* Corner Points */}
                <Scatter
                  name="Угловые точки"
                  data={solution.cornerPoints.map(cp => cp.point)}
                  fill="#8b5cf6"
                  shape={(props: any) => {
                    const { cx, cy, payload } = props;
                    const point = solution.cornerPoints.find(cp =>
                      Math.abs(cp.point.x - payload.x) < 1e-10 &&
                      Math.abs(cp.point.y - payload.y) < 1e-10
                    );

                    return (
                      <g>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={point?.isOptimal ? 8 : 6}
                          fill={point?.isOptimal ? "#ef4444" : "#8b5cf6"}
                          stroke="white"
                          strokeWidth={2}
                        />
                      </g>
                    );
                  }}
                />

                {/* Optimal Point */}
                {solution.optimalPoint && (
                  <Scatter
                    name="Оптимальная точка"
                    data={[solution.optimalPoint]}
                    fill="#ef4444"
                    shape={() => (
                      <g>
                        <circle r={10} fill="none" stroke="#ef4444" strokeWidth={3} />
                        <circle r={6} fill="#ef4444" />
                      </g>
                    )}
                  />
                )}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Details Tabs */}
      <Tabs defaultValue="points">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="points">
            <CornerDownRight className="h-4 w-4 mr-2" />
            Угловые точки
          </TabsTrigger>
          <TabsTrigger value="steps">
            <Info className="h-4 w-4 mr-2" />
            Шаги решения
          </TabsTrigger>
        </TabsList>

        <TabsContent value="points">
          <Card>
            <CardHeader>
              <CardTitle>Угловые точки области</CardTitle>
              <CardDescription>
                Значения целевой функции и полный вектор решения в вершинах допустимой области
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Точка</th>
                      <th className="text-left py-3 px-4">x₁</th>
                      <th className="text-left py-3 px-4">x₂</th>
                      <th className="text-left py-3 px-4">Полное решение</th>
                      <th className="text-left py-3 px-4">Z</th>
                      <th className="text-left py-3 px-4">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solution.cornerPoints.map((point, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-3 px-4 font-medium">P{index + 1}</td>
                        <td className="py-3 px-4">{formatValue(point.point.x, true)}</td>
                        <td className="py-3 px-4">{formatValue(point.point.y, true)}</td>
                        <td className="py-3 px-4 font-mono text-xs">
                          ({point.fullSolution.map(v => formatValue(v, true)).join(', ')})
                        </td>
                        <td className="py-3 px-4 font-medium">{formatValue(point.objectiveValue, true)}</td>
                        <td className="py-3 px-4">
                          {point.isOptimal ? (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                              Оптимальная
                            </Badge>
                          ) : (
                            <Badge variant="outline">Допустимая</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="steps">
          <Card>
            <CardHeader>
              <CardTitle>Шаги графического метода</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {solution.steps.map((step, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 rounded-lg border">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{step.description}</h4>
                    </div>
                    <Badge variant="outline">
                      {step.type === 'constraint' && 'Ограничения'}
                      {step.type === 'objective' && 'Целевая функция'}
                      {step.type === 'feasible' && 'Допустимая область'}
                      {step.type === 'optimal' && 'Оптимум'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
