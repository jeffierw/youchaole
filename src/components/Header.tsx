import { ConnectButton, useSuiClientContext } from '@mysten/dapp-kit';

export function Header() {
  const { selectNetwork, network } = useSuiClientContext();

  return (
    <header className="border-b-4 border-black bg-retro-gray p-4 flex justify-between items-center sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-electric-blue border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="font-retro text-black text-xl">U</span>
        </div>
        <h1 className="font-retro text-electric-blue text-lg hidden md:block">
          SUI <span className="text-white">BULK</span> SEND
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex border-2 border-black bg-black p-1">
          <button 
            onClick={() => selectNetwork('mainnet')}
            className={`px-3 py-1 font-retro text-[8px] transition-colors ${
              network === 'mainnet' ? 'bg-electric-blue text-black' : 'text-gray-500 hover:text-white'
            }`}
          >
            MAINNET
          </button>
          <button 
            onClick={() => selectNetwork('testnet')}
            className={`px-3 py-1 font-retro text-[8px] transition-colors ${
              network === 'testnet' ? 'bg-electric-blue text-black' : 'text-gray-500 hover:text-white'
            }`}
          >
            TESTNET
          </button>
        </div>

        <div className="pixel-connect-wrapper">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
