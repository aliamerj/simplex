import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Calculator, Github } from 'lucide-react'
import { Button } from './components/ui/button.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center space-x-2">
          <Calculator className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Оптимизационный <span className='hidden sm:inline'>Решатель</span></h1>
            <p className="text-sm text-gray-600 hidden sm:inline">Лабораторная работа по методам оптимизации</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => window.open("https://github.com/aliamerj/simplex")}>
            <Github className="mr-2 h-4 w-4" />
            Github
          </Button>
        </div>
      </div>
    </header>
    <App />
    {/* Footer */}
    <footer className="border-t mt-8 py-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-medium mb-2">О программе</h3>
            <p className="text-sm text-gray-600">
              Лабораторная работа по методам оптимизации.
              Реализация симплекс-метода и метода искусственного базиса.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Возможности</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Решение задач линейного программирования</li>
              <li>• Пошаговый и автоматический режимы</li>
              <li>• Поддержка обыкновенных и десятичных дробей</li>
              <li>• Сохранение и загрузка задач</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">Ограничения</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Максимальный размер: 16×16</li>
              <li>• Все ограничения в форме ≤</li>
              <li>• Правые части ≥ 0</li>
            </ul>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Оптимизационный решатель. Все права защищены.</p>
        </div>
      </div>
    </footer>
  </StrictMode>,
)
