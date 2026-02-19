import React, { useMemo } from 'react';
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
  Tooltip
} from 'recharts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Target,
  CheckCircle,
  AlertTriangle,
  Info,
  CornerDownRight,
  ArrowRight,
} from 'lucide-react';
import { solveGraphical } from '@/logic/graphicalSolver';
import { formatValue } from '@/utils/fractionUtils';
import type { ProblemData, Point } from '@/types';
import { ProblemInfo } from './ProblemInfo';

interface GraphicalSolverProps {
  problem: ProblemData;
}

export const GraphicalSolver: React.FC<GraphicalSolverProps> = ({ problem }) => {
  const solution = useMemo(() => {
    try {
      return solveGraphical(problem);
    } catch {
      return null;
    }
  }, [problem]);

  if (!solution) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Нельзя применить графический метод</AlertTitle>
        <AlertDescription>
          Метод работает только для 2 переменных.
          В задаче {problem.numVariables}.
        </AlertDescription>
      </Alert>
    );
  }

  const formatConstraint = (c: any) => {
    const a = formatValue(c.a, true);
    const b = formatValue(c.b, true);
    const rhs = formatValue(c.c, true);

    let eq = '';
    if (Math.abs(c.a) > 1e-10) eq += `${a === '1' ? '' : a}x₁`;
    if (Math.abs(c.b) > 1e-10) {
      const sign = c.b > 0 ? '+' : '';
      const bStr = Math.abs(c.b) === 1 ? '' : b;
      eq += `${sign}${bStr}x₂`;
    }

    return `${eq} ${c.type} ${rhs}`;
  };

  const {
    chartData,
    constraintLines,
    objectiveLines,
    normalVectorData,
    clippedStripLines,
  } = useMemo(() => {
    /* ----- Bounds ----- */
    const corners = solution.cornerPoints.map(c => c.point);

    let maxX = 0;
    let maxY = 0;
    corners.forEach(p => {
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });

    maxX = Math.ceil(maxX) + 1;
    maxY = Math.ceil(maxY) + 1;

    /* ----- Constraint lines ----- */
    const constraintLines = solution.constraints.map((c, i) => {
      const points: Point[] = [];

      if (c.b !== 0) {
        for (let x = 0; x <= maxX; x += 0.5) {
          const y = (c.c - c.a * x) / c.b;
          if (y >= 0 && y <= maxY) points.push({ x, y });
        }
      } else {
        const x = c.c / c.a;
        for (let y = 0; y <= maxY; y += 0.5) {
          points.push({ x, y });
        }
      }

      return {
        id: i,
        name: formatConstraint(c),
        points,
        color: `hsl(${i * 60},70%,50%)`,
      };
    });

    /* ----- Feasible polygon points (for the polygon) ----- */
    const getFeasiblePolygonPoints = (): Point[] => {
      if (solution.cornerPoints.length === 0) return [];

      // Get the points from cornerPoints
      const points = solution.cornerPoints.map(cp => cp.point);

      if (points.length < 2) return points;

      // Sort points in a way that creates a proper polygon
      // Find the center
      const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
      const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

      // Sort by angle
      const sortedPoints = [...points].sort((a, b) => {
        const angleA = Math.atan2(a.y - centerY, a.x - centerX);
        const angleB = Math.atan2(b.y - centerY, b.x - centerX);
        return angleA - angleB;
      });

      // Close the polygon
      if (sortedPoints.length > 0) {
        sortedPoints.push(sortedPoints[0]);
      }

      return sortedPoints;
    };

    const feasiblePolygonPoints = getFeasiblePolygonPoints();

    /* ----- Function to clip a line to the feasible region ----- */
    const clipLineToFeasibleRegion = (a: number, b: number, c: number): Point[] => {
      if (solution.cornerPoints.length < 2) return [];

      // Get the feasible polygon (without closing point for calculations)
      const polygonPoints = feasiblePolygonPoints.slice(0, -1);
      if (polygonPoints.length < 3) return [];

      const intersections: Point[] = [];

      // Check intersection with each edge of the polygon
      for (let i = 0; i < polygonPoints.length; i++) {
        const p1 = polygonPoints[i];
        const p2 = polygonPoints[(i + 1) % polygonPoints.length];

        // Calculate values at endpoints
        const v1 = a * p1.x + b * p1.y;
        const v2 = a * p2.x + b * p2.y;

        // Check if line passes between p1 and p2
        if ((v1 <= c && v2 >= c) || (v1 >= c && v2 <= c)) {
          // Find intersection point
          const t = (c - v1) / (v2 - v1);
          const x = p1.x + t * (p2.x - p1.x);
          const y = p1.y + t * (p2.y - p1.y);
          intersections.push({ x, y });
        }
      }

      // We should have 0 or 2 intersection points
      if (intersections.length >= 2) {
        return intersections;
      }

      return [];
    };

    /* ----- Objective lines and strip ----- */
    const objectiveLines: any[] = [];
    const clippedStripLines: any[] = [];

    if (solution.optimalValue !== null) {
      // Create two red boundary lines at 70% and 130% of optimal
      // Clip the boundary lines to feasible region
      const { a, b } = solution.objectiveLine;

      // determine min/max Z over feasible region
      const zValues = solution.cornerPoints.map(p => p.objectiveValue);
      const minZ = Math.min(...zValues);
      const maxZ = Math.max(...zValues);

      const STRIP_LINES = 20;

      for (let i = 0; i <= STRIP_LINES; i++) {
        const t = i / STRIP_LINES;
        const z = minZ + (maxZ - minZ) * t;

        const clipped = clipLineToFeasibleRegion(a, b, z);
        if (clipped.length >= 2) {
          clippedStripLines.push({
            value: z,
            points: clipped,
          });
        }
      }

      // optimal line (special)
      const optimalClip = clipLineToFeasibleRegion(a, b, solution.optimalValue);
      if (optimalClip.length >= 2) {
        objectiveLines.push({
          value: solution.optimalValue,
          points: optimalClip,
          isOptimal: true,
        });
      }
    }

    /* ----- Normal vector ----- */
    const normalVectorData = solution.optimalPoint
      ? {
        start: solution.optimalPoint,
        end: {
          x: solution.optimalPoint.x + solution.normalVector.x * 0.5,
          y: solution.optimalPoint.y + solution.normalVector.y * 0.5,
        },
      }
      : null;

    return {
      chartData: { maxX, maxY },
      constraintLines,
      objectiveLines,
      normalVectorData,
      clippedStripLines,
    };
  }, [solution]);

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
        <ProblemInfo problem={problem} isGrap={true} useFractions />
      </div>

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

                <Line
                  data={[]}
                  dataKey="y"
                  stroke="#ef4444"
                  strokeDasharray="2 2"
                  name="Линии уровня целевой функции"
                  legendType="line"
                />

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
                    name={`Ограничение ${line.id + 1}`}
                    connectNulls
                  />
                ))}

                {/* Strip Lines - Clipped to feasible region */}
                {clippedStripLines.map((line, index) => (
                  <Line
                    key={`strip-${index}`}
                    type="linear"
                    data={line.points}
                    dataKey="y"
                    stroke="#ef4444"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    dot={false}
                    legendType="none"
                    connectNulls
                  />
                ))}

                {/* Boundary Lines and Optimal Line */}
                {objectiveLines.map((line, index) => (
                  <Line
                    key={`obj-${index}`}
                    type="linear"
                    data={line.points}
                    dataKey="y"
                    stroke={line.isOptimal ? "#10b981" : line.isBoundary ? "#dc2626" : "#94a3b8"}
                    strokeWidth={line.isOptimal ? 3 : line.isBoundary ? 2 : 1}
                    strokeDasharray={line.isOptimal ? undefined : (line.isBoundary ? undefined : "2 2")}
                    dot={false}
                    name="Оптимальная линия"
                    connectNulls
                  />
                ))}

                {/* Normal Vector */}
                {normalVectorData && (
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
