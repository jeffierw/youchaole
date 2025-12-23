import { useState, useMemo, useEffect, useRef } from 'react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction, useSuiClientQuery, useSuiClientContext } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_TYPE_ARG, normalizeStructTag } from '@mysten/sui/utils';
import { Loader2, Send, Users, Wallet, ChevronDown, Search, Check, AlertTriangle } from 'lucide-react';
import { useToast } from './ui/Toast';

const CONTRACT_CONFIG: Record<string, string> = {
  testnet: import.meta.env.VITE_CONTRACT_TESTNET || "0x3edbb72e95318691993c3104da0e3279d9665938b99098c690cafb4277610628",
  mainnet: import.meta.env.VITE_CONTRACT_MAINNET || "0xd4be63c4ba47f8665bfab24131a7e13961a717e4331eea23229074dc5bbf9523",
};

// Helper for type-safe coin comparison
const isSameType = (typeA: string, typeB: string) => {
  try {
    return normalizeStructTag(typeA) === normalizeStructTag(typeB);
  } catch {
    return typeA.toLowerCase() === typeB.toLowerCase();
  }
};

export function Distribute() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { toast } = useToast();
  const { network } = useSuiClientContext();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const successRef = useRef<HTMLDivElement>(null);

  const [coinType, setCoinType] = useState(SUI_TYPE_ARG);
  const [addressInput, setAddressInput] = useState('');
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [tokenSearch, setTokenSearch] = useState('');
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);

  const CONTRACT_ID = CONTRACT_CONFIG[network] || CONTRACT_CONFIG.testnet;

  const { data: allBalances, refetch: refetchBalances } = useSuiClientQuery('getAllBalances', {
    owner: account?.address || '',
  }, {
    enabled: !!account?.address,
  });

  const ownedCoinTypes = useMemo(() => {
    if (!allBalances) return [SUI_TYPE_ARG];
    const types = new Set(allBalances.map(b => b.coinType));
    types.add(SUI_TYPE_ARG);
    return Array.from(types).sort((a, b) => {
        if (isSameType(a, SUI_TYPE_ARG)) return -1;
        if (isSameType(b, SUI_TYPE_ARG)) return 1;
        return a.localeCompare(b);
    });
  }, [allBalances]);

  // Aggregate balances for the dropdown
  const coinBalancesMap = useMemo(() => {
    if (!allBalances) return {};
    const map: Record<string, bigint> = {};
    allBalances.forEach(b => {
      map[b.coinType] = BigInt(b.totalBalance);
    });
    return map;
  }, [allBalances]);

  const normalizedCoinType = useMemo(() => {
    try {
      return normalizeStructTag(coinType);
    } catch {
      return coinType;
    }
  }, [coinType]);

  const { data: coinMetadata } = useSuiClientQuery('getCoinMetadata', {
    coinType: normalizedCoinType,
  });

  const decimals = coinMetadata?.decimals ?? 9;
  const symbol = coinMetadata?.symbol ?? 'TOKEN';
  const tokenName = coinMetadata?.name ?? '';

  const balance = useMemo(() => {
    if (!allBalances) return 0n;
    const item = allBalances.find(b => isSameType(b.coinType, normalizedCoinType));
    return item ? BigInt(item.totalBalance) : 0n;
  }, [allBalances, normalizedCoinType]);

  const formattedBalance = (Number(balance) / Math.pow(10, decimals)).toLocaleString(undefined, { 
    maximumFractionDigits: decimals,
    useGrouping: false 
  });

  const { addresses, hasFilteredSelf } = useMemo(() => {
    const rawAddresses = addressInput
      .split('\n')
      .map((a) => a.trim().toLowerCase())
      .filter((a) => a.startsWith('0x') && (a.length >= 42));
    
    const uniqueAddresses = Array.from(new Set(rawAddresses));
    const currentAddr = account?.address?.toLowerCase();
    
    const filtered = uniqueAddresses.filter(addr => addr !== currentAddr);
    
    return {
      addresses: filtered,
      hasFilteredSelf: uniqueAddresses.length !== filtered.length
    };
  }, [addressInput, account?.address]);

  const totalAmountMist = useMemo(() => {
    if (!amount || addresses.length === 0) return 0n;
    try {
      const amountInMist = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));
      return amountInMist * BigInt(addresses.length);
    } catch {
      return 0n;
    }
  }, [amount, addresses.length, decimals]);

  const isBalanceInsufficient = totalAmountMist > balance;

  useEffect(() => {
    setTxDigest(null);
    if (account?.address) refetchBalances();
  }, [network, account?.address]);

  const handleDistribute = async () => {
    if (!account || addresses.length === 0 || !amount) return;
    if (isBalanceInsufficient) {
      toast("Insufficient balance", 'error');
      return;
    }

    setIsProcessing(true);
    setTxDigest(null);

    try {
      const txb = new Transaction();
      const amountInMist = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));

      let coinToUse;
      
      if (isSameType(normalizedCoinType, SUI_TYPE_ARG)) {
        const [suiCoin] = txb.splitCoins(txb.gas, [totalAmountMist]);
        coinToUse = suiCoin;
      } else {
        // 分页获取所有代币对象，确保凑够余额
        const coinObjects: string[] = [];
        let cursor: string | null | undefined = null;
        let gatheredBalance = 0n;

        while (gatheredBalance < totalAmountMist) {
          const { data: coins, nextCursor, hasNextPage } = await client.getCoins({
            owner: account.address,
            coinType: normalizedCoinType,
            cursor,
          });

          if (coins.length === 0 && gatheredBalance < totalAmountMist) {
            throw new Error(`Insufficient ${symbol} objects found to cover the total amount`);
          }

          for (const coin of coins) {
            coinObjects.push(coin.coinObjectId);
            gatheredBalance += BigInt(coin.balance);
            if (gatheredBalance >= totalAmountMist) break;
          }

          if (gatheredBalance >= totalAmountMist || !hasNextPage) break;
          cursor = nextCursor;
        }

        if (gatheredBalance < totalAmountMist) {
            throw new Error(`Insufficient ${symbol} balance (gathered ${gatheredBalance}, need ${totalAmountMist})`);
        }

        const primaryCoin = txb.object(coinObjects[0]);
        if (coinObjects.length > 1) {
            txb.mergeCoins(primaryCoin, coinObjects.slice(1).map(id => txb.object(id)));
        }
        
        const [splitCoin] = txb.splitCoins(primaryCoin, [totalAmountMist]);
        coinToUse = splitCoin;
      }

      // Call Contract
      txb.moveCall({
        target: `${CONTRACT_ID}::batch_transfer::batch_transfer`,
        typeArguments: [normalizedCoinType],
        arguments: [
          coinToUse,
          txb.pure.u64(amountInMist),
          txb.pure.vector('address', addresses)
        ],
      });
      
      // CRITICAL: Since batch_transfer takes &mut Coin<T>, the object coinToUse 
      // still exists in the PTB. We must transfer it back to avoid UnusedValueWithoutDrop.
      txb.transferObjects([coinToUse], account.address);
      
      // txb.setGasBudget(10_000_000n + (BigInt(addresses.length) * 500_000n));

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: (result) => {
            setTxDigest(result.digest);
            setIsProcessing(false);
            setAddressInput('');
            toast(`Distributed to ${addresses.length} addresses!`, 'success');
            setTimeout(() => {
                refetchBalances();
                successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 500);
          },
          onError: (err) => {
            console.error('Wallet Error:', err);
            toast(err.message || "Transaction failed", 'error');
            setIsProcessing(false);
          },
        }
      );
    } catch (err: any) {
      console.error(err);
      toast(err.message, 'error');
      setIsProcessing(false);
    }
  };

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center p-12 pixel-card mt-10">
        <Wallet className="w-16 h-16 text-electric-blue mb-4 animate-pulse" />
        <p className="font-retro text-[12px] text-white uppercase">PLEASE CONNECT YOUR WALLET TO START</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 md:py-10 px-3 md:px-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <div className="space-y-4 md:space-y-6">
          <div className="pixel-card">
            <h2 className="font-retro text-[10px] text-electric-blue mb-4 uppercase flex items-center gap-2">
              <Loader2 className="w-4 h-4" /> Token Selection
            </h2>
            <div className="space-y-4">
              <div className="relative">
                <label className="font-retro text-[8px] text-gray-400 block mb-2 uppercase">Selected Token</label>
                <button 
                  onClick={() => setIsTokenSelectorOpen(!isTokenSelectorOpen)}
                  className="w-full bg-black border-2 border-gray-800 p-2 text-left flex items-center justify-between hover:border-electric-blue transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-retro text-[10px] text-white">{symbol}</span>
                    <span className="text-[6px] font-mono text-gray-500 truncate max-w-[150px]">{normalizedCoinType}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-electric-blue transition-transform ${isTokenSelectorOpen ? 'rotate-180' : ''}`} />
                </button>

                {isTokenSelectorOpen && (
                  <div className="absolute z-50 mt-2 w-full min-w-[280px] sm:min-w-[320px] bg-black border-2 border-electric-blue shadow-2xl p-2 left-0 sm:-left-2">
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                      <input 
                        type="text"
                        autoFocus
                        placeholder="Search name or symbol..."
                        value={tokenSearch}
                        onChange={(e) => setTokenSearch(e.target.value)}
                        className="w-full bg-retro-gray border border-gray-700 p-1.5 pl-7 text-[8px] font-retro text-white outline-none focus:border-electric-blue"
                      />
                    </div>
                    <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                      {ownedCoinTypes.filter(type => 
                        type.toLowerCase().includes(tokenSearch.toLowerCase()) || 
                        (isSameType(type, SUI_TYPE_ARG) && 'sui'.includes(tokenSearch.toLowerCase()))
                      ).map((type) => {
                        const rawBal = coinBalancesMap[type] || 0n;
                        return (
                          <button
                            key={type}
                            onClick={() => {
                              setCoinType(type);
                              setIsTokenSelectorOpen(false);
                              setTokenSearch('');
                            }}
                            className={`w-full text-left p-2 hover:bg-electric-blue group transition-colors flex items-center justify-between ${isSameType(coinType, type) ? 'bg-electric-blue/20' : ''}`}
                          >
                            <div className="flex flex-col overflow-hidden max-w-[60%] sm:max-w-[70%]">
                              <span className={`font-retro text-[8px] ${isSameType(coinType, type) ? 'text-electric-blue' : 'text-white group-hover:text-black'}`}>
                                {isSameType(type, SUI_TYPE_ARG) ? 'SUI' : type.split('::').pop()}
                              </span>
                              <span className="text-[6px] font-mono text-gray-400 group-hover:text-black/70 truncate">{type}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="font-retro text-[8px] text-gray-500 group-hover:text-black whitespace-nowrap">
                                    {(Number(rawBal / 100000n) / 10000).toFixed(2)}
                                </span>
                                {isSameType(coinType, type) && <Check className="w-3 h-3 text-electric-blue group-hover:text-black" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="font-retro text-[8px] text-gray-400 block mb-2 uppercase">Amount per address</label>
                <div className="relative flex flex-col gap-1">
                  <div className="relative flex items-center">
                    <input 
                      type="number" 
                      value={amount} 
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-black border-2 border-gray-800 p-2 pr-20 md:pr-24 text-white font-retro text-[10px] focus:border-electric-blue outline-none"
                      placeholder="0.0"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                      <span className="font-retro text-[6px] md:text-[8px] text-electric-blue">{symbol}</span>
                      <span className="bg-gray-800 px-1 py-0.5 rounded text-[5px] md:text-[6px] text-gray-400 font-mono">D:{decimals}</span>
                    </div>
                  </div>
                  {tokenName && <p className="text-[6px] font-retro text-gray-500 italic pl-1 truncate">{tokenName}</p>}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-retro text-[8px] text-gray-400 uppercase">Current balance</span>
                  <span className="font-retro text-[8px] md:text-[10px] text-white tabular-nums">{formattedBalance}</span>
                </div>
                {isBalanceInsufficient && (
                  <div className="flex items-center gap-1.5 text-red-500 mt-2 bg-red-500/10 p-2 border border-red-500/30">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span className="font-retro text-[6px] uppercase">Insufficient balance</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pixel-card bg-[#00f2ff]/5 border-electric-blue/30">
            <h2 className="font-retro text-[10px] text-white mb-2 uppercase flex items-center gap-2">
              <Users className="w-4 h-4 text-electric-blue" /> Summary
            </h2>
            <div className="space-y-2 text-[10px] font-retro">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Valid Addresses</span>
                  <span className="text-electric-blue">{addresses.length}</span>
                </div>
                {hasFilteredSelf && (
                  <p className="text-[6px] text-yellow-500/80 text-right uppercase italic">
                    * Sender wallet excluded
                  </p>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 uppercase leading-none text-right">Total Distribution</span>
                <span className={`text-electric-blue ${isBalanceInsufficient ? 'text-red-500' : ''}`}>
                  {amount && addresses.length ? (parseFloat(amount) * addresses.length).toLocaleString(undefined, { maximumFractionDigits: decimals }) : '0'} {symbol}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="pixel-card flex flex-col">
            <h2 className="font-retro text-[10px] md:text-[12px] text-white mb-4 uppercase flex items-center gap-2">
              <Send className="w-4 h-4 md:w-5 md:h-5 text-electric-blue" /> Receiver wallets
            </h2>
            <textarea 
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              className="w-full bg-black border-2 border-gray-800 p-3 md:p-4 text-white font-mono text-[9px] md:text-[10px] focus:border-electric-blue outline-none resize-none min-h-[250px] md:min-h-[350px] leading-relaxed"
              placeholder="Paste addresses here, one per line..."
            />
            
            <div className="mt-6 md:mt-8 flex flex-col items-center justify-center">
              <button 
                onClick={handleDistribute}
                disabled={isProcessing || addresses.length === 0 || !amount || isBalanceInsufficient}
                className={`w-full pixel-button-primary py-3 md:py-4 relative group ${
                  (isProcessing || addresses.length === 0 || !amount || isBalanceInsufficient) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div className="flex items-center justify-center gap-2 md:gap-3 w-full">
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                      <span className="mt-1 font-retro text-[9px] md:text-[12px]">Distribute to {addresses.length} wallets</span>
                    </>
                  )}
                </div>
              </button>
              <div className="mt-4 flex items-center gap-2 text-center">
                 <div className="w-1.5 h-1.5 bg-electric-blue animate-pulse shrink-0"></div>
                 <p className="font-retro text-[6px] text-gray-500 uppercase tracking-tighter">
                   Network: <span className="text-electric-blue">{network.toUpperCase()}</span> | Contract: {CONTRACT_ID.slice(0, 4)}...{CONTRACT_ID.slice(-4)}
                 </p>
              </div>
            </div>
          </div>

          {txDigest && (
            <div ref={successRef} className="pixel-card bg-green-900/30 border-green-500/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-green-500 shadow-[0_0_8px_#22c55e]"></div>
                <p className="font-retro text-[10px] text-green-400 uppercase leading-none">Transaction Confirmed</p>
              </div>
              <div className="bg-black/40 border border-green-500/20 p-3 mb-4 overflow-hidden">
                <p className="font-mono text-[8px] text-gray-400 break-all leading-relaxed">{txDigest}</p>
              </div>
              <div className="font-retro text-[6px] md:text-[8px] text-gray-400 flex flex-wrap items-center gap-x-1.5 gap-y-2 leading-relaxed">
                <span className="mt-0.5">Check records</span>
                <a 
                  href={`https://suiscan.xyz/${network}/tx/${txDigest}`} 
                  target="_blank" 
                  className="text-electric-blue hover:text-white underline decoration-1 underline-offset-2 transition-colors uppercase whitespace-nowrap"
                >
                  SUISCAN
                </a> 
                <span className="mt-0.5">or</span>
                <a 
                  href={network === 'testnet' ? `https://testnet.suivision.xyz/txblock/${txDigest}` : `https://suivision.xyz/txblock/${txDigest}`} 
                  target="_blank" 
                  className="text-electric-blue hover:text-white underline decoration-1 underline-offset-2 transition-colors uppercase whitespace-nowrap"
                >
                  SUIVISION
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
