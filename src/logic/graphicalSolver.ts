import type {
  ConstraintLine,
  FeasibleRegion,
  GraphicalSolution,
  Gstep,
  Point,
  ProblemData,
} from "@/types";

export function solveGraphical(problem: ProblemData): GraphicalSolution {
  const steps: Gstep[] = [];

  // Step 1: Convert constraints to lines (for graphical display)
  const constraints = convertConstraintsToLines(problem);
  steps.push({ 
    type: "constraint", 
    description: `Построены ${constraints.length} ограничений` 
  });

  // Step 2: Find all intersection points
  const intersections = findIntersectionPoints(constraints);
  steps.push({ 
    type: "feasible", 
    description: `Найдено ${intersections.length} точек пересечения` 
  });

  // Step 3: Filter feasible points
  const feasiblePoints = filterFeasiblePoints(intersections, constraints);
  steps.push({ 
    type: "feasible", 
    description: `${feasiblePoints.length} точек являются допустимыми` 
  });

  // Step 4: Build feasible region
  const feasibleRegion = buildFeasibleRegion(feasiblePoints);
  steps.push({ 
    type: "feasible", 
    description: `Построена область допустимых решений с ${feasibleRegion.vertices.length} вершинами` 
  });

  // Step 5: Calculate corner points with full solution vectors
  const cornerPoints = calculateCornerPointsWithSlack(feasiblePoints, problem);
  steps.push({ 
    type: "optimal", 
    description: `Рассчитаны значения в ${cornerPoints.length} угловых точках` 
  });

  // Step 6: Find optimal point
  const optimal = findOptimalPoint(cornerPoints, problem.objectiveType);
  
  if (optimal) {
    steps.push({ 
      type: "optimal", 
      description: `Оптимальная точка: (${optimal.point.x}, ${optimal.point.y}) со значением Z = ${optimal.objectiveValue}` 
    });
  } else {
    steps.push({ 
      type: "optimal", 
      description: "Оптимальная точка не найдена" 
    });
  }

  // Step 7: Prepare objective line for display
  const objectiveLine = convertObjectiveToLine(problem);
  steps.push({ 
    type: "objective", 
    description: `Целевая функция: Z = ${problem.objectiveCoefficients[0]}x₁ + ${problem.objectiveCoefficients[1]}x₂` 
  });

  // Step 8: Prepare normal vector
  const normalVector = {
    x: problem.objectiveCoefficients[0],
    y: problem.objectiveCoefficients[1]
  };
  steps.push({ 
    type: "objective", 
    description: `Вектор нормали: n = (${normalVector.x}, ${normalVector.y})` 
  });

  return {
    problem,
    constraints,
    feasibleRegion,
    objectiveLine,
    optimalPoint: optimal?.point ?? null,
    optimalValue: optimal?.objectiveValue ?? null,
    fullSolution: optimal?.fullSolution ?? null,
    cornerPoints,
    normalVector,
    viewport: computeViewport(feasibleRegion.vertices),
    method: "graphical",
    steps,
  };
}

/* =========================
   CONVERSIONS
========================= */

function convertConstraintsToLines(problem: ProblemData): ConstraintLine[] {
  const lines: ConstraintLine[] = [];

  for (let i = 0; i < problem.numConstraints; i++) {
    const a = problem.constraintMatrix[i][0];
    const b = problem.constraintMatrix[i][1];
    const c = problem.rightHandSide[i];

    lines.push(buildLine(a, b, c, "≤"));
  }

  // x ≥ 0
  lines.push(buildLine(1, 0, 0, "≥"));

  // y ≥ 0
  lines.push(buildLine(0, 1, 0, "≥"));

  return lines;
}

function convertObjectiveToLine(problem: ProblemData): ConstraintLine {
  const a = problem.objectiveCoefficients[0];
  const b = problem.objectiveCoefficients[1];

  return buildLine(a, b, 0, "=");
}

/* =========================
   GEOMETRY CORE
========================= */

function buildLine(
  a: number,
  b: number,
  c: number,
  type: "≤" | "≥" | "="
): ConstraintLine {
  return {
    a,
    b,
    c,
    type,
    intercepts: {
      x: a !== 0 ? c / a : null,
      y: b !== 0 ? c / b : null,
    },
  };
}

function findIntersectionPoints(constraints: ConstraintLine[]): Point[] {
  const points: Point[] = [];

  for (let i = 0; i < constraints.length; i++) {
    for (let j = i + 1; j < constraints.length; j++) {
      const p = findIntersection(constraints[i], constraints[j]);
      if (p) {
        points.push(p);
      }
    }
  }

  return points;
}

function findIntersection(l1: ConstraintLine, l2: ConstraintLine): Point | null {
  const det = l1.a * l2.b - l2.a * l1.b;
  if (Math.abs(det) < 1e-9) return null;

  return {
    x: (l1.c * l2.b - l2.c * l1.b) / det,
    y: (l1.a * l2.c - l2.a * l1.c) / det,
  };
}

function filterFeasiblePoints(points: Point[], constraints: ConstraintLine[]): Point[] {
  return points.filter(p =>
    constraints.every(c => {
      const v = c.a * p.x + c.b * p.y;
      if (c.type === "≤") return v <= c.c + 1e-9;
      if (c.type === "≥") return v >= c.c - 1e-9;
      return Math.abs(v - c.c) < 1e-9;
    })
  );
}

/* =========================
   FEASIBLE REGION
========================= */

function buildFeasibleRegion(points: Point[]): FeasibleRegion {
  if (points.length === 0) {
    return { vertices: [], isBounded: false, isEmpty: true };
  }

  const hull = convexHull(points);

  return {
    vertices: hull,
    isBounded: true,
    isEmpty: hull.length === 0,
  };
}

/* =========================
   OBJECTIVE AND SLACK VARIABLES
========================= */

function calculateCornerPointsWithSlack(points: Point[], problem: ProblemData) {
  const [c1, c2] = problem.objectiveCoefficients;
  
  return points.map(p => {
    const objectiveValue = c1 * p.x + c2 * p.y;
    
    // Calculate slack variables for each constraint
    const slackVariables: number[] = [];
    for (let i = 0; i < problem.numConstraints; i++) {
      const a = problem.constraintMatrix[i][0];
      const b = problem.constraintMatrix[i][1];
      const rhs = problem.rightHandSide[i];
      
      // For ≤ constraints, slack = rhs - (a*x + b*y)
      const lhs = a * p.x + b * p.y;
      const slack = rhs - lhs;
      slackVariables.push(slack >= 0 ? slack : 0);
    }
    
    // Full solution vector: [x₁, x₂, s₁, s₂, s₃, ...]
    const fullSolution = [p.x, p.y, ...slackVariables];
    
    return {
      point: p,
      objectiveValue,
      fullSolution,
      isOptimal: false
    };
  });
}

function findOptimalPoint(
  corners: { point: Point; objectiveValue: number; fullSolution: number[] }[],
  type: "min" | "max"
) {
  if (corners.length === 0) return null;

  let optimal = corners[0];
  
  for (const corner of corners) {
    if (type === "max") {
      if (corner.objectiveValue > optimal.objectiveValue) {
        optimal = corner;
      }
    } else {
      if (corner.objectiveValue < optimal.objectiveValue) {
        optimal = corner;
      }
    }
  }
  
  
  return optimal;
}

/* =========================
   UTILITIES
========================= */

function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return [...points];

  // Sort points by x, then by y
  const sorted = [...points].sort((a, b) =>
    a.x === b.x ? a.y - b.y : a.x - b.x
  );

  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  // Lower hull
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  // Upper hull
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Remove last points (duplicates)
  upper.pop();
  lower.pop();

  return [...lower, ...upper];
}

function computeViewport(points: Point[]) {
  if (!points.length) return { minX: 0, maxX: 10, minY: 0, maxY: 10 };

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);

  return {
    minX: Math.min(0, ...xs) - 1,
    maxX: Math.max(...xs) + 2,
    minY: Math.min(0, ...ys) - 1,
    maxY: Math.max(...ys) + 2,
  };
}
