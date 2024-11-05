export function compareWithHoldStrategy(
  data: Kline[],
  signals: TradingSignal[],
  initialCapital: number = 1000
): StrategyPerformance {
  // Vérification des données
  if (!data || data.length === 0 || !signals || signals.length === 0) {
    return {
      totalProfit: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      averageGain: 0,
      maxDrawdown: 0,
      holdPerformance: 0,
      outperformsHold: false
    };
  }

  // Résultats de la stratégie active
  let balance = initialCapital;
  const trades: TradeResult[] = [];
  let inPosition = false;
  let entryPrice = 0;
  let entryTime = 0;

  // Calculer les trades basés sur les signaux
  signals.forEach((signal, index) => {
    if (signal.type === 'buy' && !inPosition) {
      entryPrice = signal.price;
      entryTime = signal.time;
      inPosition = true;
    } 
    else if (signal.type === 'sell' && inPosition) {
      const exitPrice = signal.price;
      const profit = ((exitPrice - entryPrice) / entryPrice) * balance;
      
      trades.push({
        entryPrice,
        exitPrice,
        entryTime,
        exitTime: signal.time,
        profit,
        percentageGain: (exitPrice - entryPrice) / entryPrice * 100
      });

      balance += profit;
      inPosition = false;
    }
  });

  // Calculer la performance Buy & Hold en utilisant la période des signaux
  // Trouver le premier et le dernier signal pour déterminer la période
  const firstPrice = data[0].close;
  const lastPrice = data[data.length - 1].close;

  const holdProfit = ((lastPrice - firstPrice) / firstPrice) * initialCapital;
  const holdPerformance = (lastPrice - firstPrice) / firstPrice * 100;

  // Calculer les métriques de performance
  const totalProfit = balance - initialCapital;
  const winningTrades = trades.filter(t => t.profit > 0).length;
  const losingTrades = trades.filter(t => t.profit <= 0).length;

  // Calculer le drawdown maximum
  let maxDrawdown = 0;
  let peak = -Infinity;
  let tempBalance = initialCapital;

  trades.forEach(trade => {
    tempBalance += trade.profit;
    if (tempBalance > peak) {
      peak = tempBalance;
    }
    const drawdown = (peak - tempBalance) / peak * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  });

  return {
    totalProfit,
    totalTrades: trades.length,
    winningTrades,
    losingTrades,
    winRate: trades.length > 0 ? (winningTrades / trades.length) * 100 : 0,
    averageGain: trades.length > 0 ? trades.reduce((acc, trade) => acc + trade.percentageGain, 0) / trades.length : 0,
    maxDrawdown,
    holdPerformance,
    outperformsHold: totalProfit > holdProfit
  };
} 