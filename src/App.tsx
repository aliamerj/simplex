import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Calculator, BarChart3 } from 'lucide-react';
import { ProblemInput } from '@/components/ProblemInput';
import { SimplexSolver } from '@/components/SimplexSolver';
import { useSimplexSolver } from '@/hooks/useSimplexSolver';
import type { ProblemData } from '@/types';
import { runSimplexTest } from './debug/simplexTest';
import { GraphicalSolver } from './components/GraphicalSolver';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('input');

  const solver = useSimplexSolver();
  const [localProblem, setLocalProblem] = useState<ProblemData>(solver.solution.problem);

  const handleProblemUpdate = (problem: ProblemData) => {
    setLocalProblem(problem);
  };

  useEffect(() => {
    runSimplexTest()
  }, [])

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto p-3 sm:p-4 md:p-6 lg:p-8">
        {/* Основные вкладки */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger
              value="input"
            >
              <FileText className="h-4 w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">Ввод задачи</span>
              <span className="sm:hidden">Ввод</span>
            </TabsTrigger>
            <TabsTrigger
              value="simplex"
            >
              <Calculator className="h-4 w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">Симплекс-метод</span>
              <span className="sm:hidden">Симплекс</span>
            </TabsTrigger>
            <TabsTrigger
              value="graphical"
            >
              <BarChart3 className="h-4 w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">Графический метод</span>
              <span className="sm:hidden">График</span>
            </TabsTrigger>
          </TabsList>

          {/* Вкладка ввода задачи */}
          <TabsContent value="input" className="space-y-4 sm:space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl md:text-2xl">Ввод задачи линейного программирования</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Введите данные задачи в канонической форме. Максимальная размерность: 16×16
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6">
                <ProblemInput
                  problem={localProblem}
                  onUpdate={handleProblemUpdate}
                  setActiveTab={setActiveTab}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Вкладка симплекс-метода */}
          <TabsContent value="simplex" className="space-y-4 sm:space-y-6">
            <SimplexSolver
              problem={localProblem}
            />
          </TabsContent>

          {/* Вкладка графического метода */}
          <TabsContent value="graphical" className="space-y-6">
            <GraphicalSolver
              problem={localProblem}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>);
};

export default App;
