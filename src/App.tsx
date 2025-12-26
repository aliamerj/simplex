import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FileText, Calculator, BarChart3 } from 'lucide-react';
import { ProblemInput } from '@/components/ProblemInput';
import { SimplexSolver } from '@/components/SimplexSolver';
import { useSimplexSolver } from '@/hooks/useSimplexSolver';
import type { ProblemData } from '@/types';
import { runSimplexTest } from './debug/simplexTest';

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
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <main className="container mx-auto p-4 md:p-6">
          {/* Основные вкладки */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-1 sm:grid-cols-4 mb-6 h-auto p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <TabsTrigger value="input" className="data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-900">
                <FileText className="h-4 w-4 mr-2" />
                Ввод задачи
              </TabsTrigger>
              <TabsTrigger value="simplex" className="data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-900">
                <Calculator className="h-4 w-4 mr-2" />
                Симплекс-метод
              </TabsTrigger>
              <TabsTrigger value="graphical" className="data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-900">
                <BarChart3 className="h-4 w-4 mr-2" />
                Графический метод
              </TabsTrigger>
            </TabsList>

            {/* Вкладка ввода задачи */}
            <TabsContent value="input" className="space-y-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Ввод задачи линейного программирования</CardTitle>
                  <CardDescription>
                    Введите данные задачи в канонической форме. Максимальная размерность: 16×16
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ProblemInput
                    problem={localProblem}
                    onUpdate={handleProblemUpdate}
                    setActiveTab={setActiveTab}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Вкладка симплекс-метода */}
            <TabsContent value="simplex" className="space-y-6">
              <SimplexSolver
                problem={localProblem}
              />
            </TabsContent>

            {/* Вкладка графического метода */}
            <TabsContent value="graphical" className="space-y-6">
              {/* <GraphicalSolver */}
              {/*   problem={localProblem} */}
              {/* /> */}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </TooltipProvider>
  );
};

export default App;
