import { ConnectButton, useSuiClientContext } from '@mysten/dapp-kit';

export function Header() {
  const { selectNetwork, network } = useSuiClientContext();

  return (
    <header className="border-b-4 border-black bg-retro-gray p-3 md:p-4 flex flex-col sm:flex-row justify-between items-center sticky top-0 z-50 gap-4">
      <div className="flex items-center gap-3 md:gap-4 w-full sm:w-auto">
        <div className="w-8 h-8 md:w-10 md:h-10 bg-electric-blue border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0">
          <span className="font-retro text-black text-sm md:text-xl">U</span>
        </div>
        <h1 className="font-retro text-electric-blue text-[10px] md:text-lg whitespace-nowrap">
          SUI <span className="text-white">BULK</span> SEND
        </h1>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 md:gap-4 w-full sm:w-auto">
        <div className="flex border-2 border-black bg-black p-0.5 md:p-1 shrink-0">
          <button 
            onClick={() => selectNetwork('mainnet')}
            className={`px-2 md:px-3 py-1 font-retro text-[6px] md:text-[8px] transition-colors ${
              network === 'mainnet' ? 'bg-electric-blue text-black' : 'text-gray-500 hover:text-white'
            }`}
          >
            MAINNET
          </button>
          <button 
            onClick={() => selectNetwork('testnet')}
            className={`px-2 md:px-3 py-1 font-retro text-[6px] md:text-[8px] transition-colors ${
              network === 'testnet' ? 'bg-electric-blue text-black' : 'text-gray-500 hover:text-white'
            }`}
          >
            TESTNET
          </button>
        </div>

        <div className="pixel-connect-wrapper scale-90 md:scale-100 origin-right">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
