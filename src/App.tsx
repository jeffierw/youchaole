import { Header } from './components/Header'
import { Distribute } from './components/Distribute'
import { ToastProvider } from './components/ui/Toast'

function App() {
  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        
        <main className="flex-grow container mx-auto py-8">
          <div className="flex flex-col items-center mb-10 text-center">
            <h1 className="font-retro text-4xl text-electric-blue mb-4 drop-shadow-[0_0_10px_#00f2ff]">
              Y CHAO LE
            </h1>
            <p className="font-retro text-[10px] text-gray-400 tracking-widest uppercase">
              Sui Ecosystem Multi-Token Distributor
            </p>
          </div>

          <Distribute />
        </main>

        <footer className="border-t-4 border-black bg-retro-gray p-6 text-center mt-auto">
          <p className="font-retro text-[8px] text-gray-500">
            POWERED BY <span className="text-electric-blue">ANTIGRAVITY</span> | PIXELATED SUI TOOLS © 2024
          </p>
        </footer>

        {/* Retro scanline effect */}
        <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] z-[100] opacity-20"></div>
      </div>
    </ToastProvider>
  )
}

export default App
