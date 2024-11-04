import type { 
  Kline, 
  EMAPeriod, 
  IndicatorValue, 
  TradingSignal,
  StrategyParams,
  RSIPeriod
} from './types';

export function calculateEMA(data: Kline[], period: EMAPeriod): IndicatorValue[] {
  const k = 2 / (period + 1);
  let ema = data[0].close;
  
  return data.map((candle) => {
    ema = candle.close * k + ema * (1 - k);
    return {
      time: candle.time,
      value: ema
    };
  });
}

export function calculateRSI(data: Kline[], period: RSIPeriod): IndicatorValue[] {
  const gains: number[] = [];
  const losses: number[] = [];
  
  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(Math.max(0, change));
    losses.push(Math.max(0, -change));
  }

  // Calculate initial averages
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const rsiValues: IndicatorValue[] = [];
  rsiValues.push({
    time: data[period].time,
    value: 100 - (100 / (1 + avgGain / avgLoss))
  });

  // Calculate RSI for remaining periods
  for (let i = period; i < data.length - 1; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    
    rsiValues.push({
      time: data[i + 1].time,
      value: 100 - (100 / (1 + avgGain / avgLoss))
    });
  }

  return rsiValues;
}

export function calculateMACD(data: Kline[]): { time: number; macd: number; signal: number; }[] {
  const fastEMA = calculateEMA(data, 12);
  const slowEMA = calculateEMA(data, 26);
  const macdLine = fastEMA.map((fast, i) => ({
    time: fast.time,
    value: fast.value - slowEMA[i].value
  }));
  
  // Calculate signal line (9-period EMA of MACD line)
  const k = 2 / (9 + 1);
  let signal = macdLine[0].value;
  
  return macdLine.map(macd => {
    signal = macd.value * k + signal * (1 - k);
    return {
      time: macd.time,
      macd: macd.value,
      signal: signal
    };
  });
}

function isVolumeSurge(candle: Kline, avgVolume: number, threshold: number): boolean {
  return candle.volume > avgVolume * threshold;
}

export function generateSignals(data: Kline[], strategy: StrategyParams): TradingSignal[] {
  const signals: TradingSignal[] = [];
  
  if (strategy.type === 'ema_cross' || strategy.type === 'multi') {
    if (!strategy.fastEma || !strategy.slowEma) return signals;
    const emaSignals = generateEMASignals(data, strategy.fastEma, strategy.slowEma);
    signals.push(...emaSignals);
  }
  
  if (strategy.type === 'rsi_oversold' || strategy.type === 'multi') {
    if (!strategy.rsiPeriod) return signals;
    const rsiSignals = generateRSISignals(data, strategy.rsiPeriod);
    signals.push(...rsiSignals);
  }
  
  // Filtre de volume
  if (strategy.useVolume) {
    const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
    return signals.filter(signal => {
      const candle = data.find(d => d.time === signal.time);
      return candle && candle.volume > avgVolume * (strategy.volumeThreshold || 1.5);
    });
  }
  
  return signals.sort((a, b) => a.time - b.time);
}

export function calculateTradingStats(signals: TradingSignal[]) {
  let totalProfit = 0;
  let winningTrades = 0;
  let totalTrades = 0;
  let maxDrawdown = 0;
  let currentDrawdown = 0;
  let peakValue = 0;
  let currentPosition: TradingSignal | null = null;

  const trades: { entry: TradingSignal; exit: TradingSignal; profit: number }[] = [];

  for (const signal of signals) {
    if (!currentPosition) {
      if (signal.type === 'buy') {
        currentPosition = signal;
      }
    } else if (signal.type === 'sell') {
      const profit = ((signal.price - currentPosition.price) / currentPosition.price) * 100;
      
      trades.push({
        entry: currentPosition,
        exit: signal,
        profit
      });

      totalTrades++;
      totalProfit += profit;

      if (profit > 0) winningTrades++;

      // Update drawdown calculations
      if (totalProfit > peakValue) {
        peakValue = totalProfit;
        currentDrawdown = 0;
      } else {
        currentDrawdown = peakValue - totalProfit;
        maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
      }

      currentPosition = null;
    }
  }

  return {
    totalProfit,
    winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
    totalTrades,
    winningTrades,
    maxDrawdown,
    trades
  };
}

function generateEMASignals(data: Kline[], fastPeriod: EMAPeriod, slowPeriod: EMAPeriod): TradingSignal[] {
  const signals: TradingSignal[] = [];
  const fastEma = calculateEMA(data, fastPeriod);
  const slowEma = calculateEMA(data, slowPeriod);
  
  // Ajout d'un filtre de tendance
  const trendEma = calculateEMA(data, 99);
  
  for (let i = 1; i < data.length; i++) {
    const trend = data[i].close > trendEma[i].value;
    const prevFast = fastEma[i - 1].value;
    const prevSlow = slowEma[i - 1].value;
    const currFast = fastEma[i].value;
    const currSlow = slowEma[i].value;

    // Confirmation de la tendance avec le prix
    const priceConfirmation = trend ? 
      data[i].close > data[i].open : // Tendance haussière
      data[i].close < data[i].open;  // Tendance baissière

    if (prevFast <= prevSlow && currFast > currSlow && trend && priceConfirmation) {
      signals.push({
        time: data[i].time,
        type: 'buy',
        price: data[i].close,
        reason: `EMA ${fastPeriod} crossed above EMA ${slowPeriod} with trend confirmation`
      });
    } else if (prevFast >= prevSlow && currFast < currSlow && !trend && priceConfirmation) {
      signals.push({
        time: data[i].time,
        type: 'sell',
        price: data[i].close,
        reason: `EMA ${fastPeriod} crossed below EMA ${slowPeriod} with trend confirmation`
      });
    }
  }
  return signals;
}

function generateRSISignals(data: Kline[], period: RSIPeriod): TradingSignal[] {
  const signals: TradingSignal[] = [];
  const rsiValues = calculateRSI(data, period);
  
  // Ajout d'une moyenne mobile pour confirmer la tendance
  const sma20 = calculateSMA(data, 20);
  
  for (let i = 2; i < rsiValues.length; i++) {
    const rsi = rsiValues[i].value;
    const prevRsi = rsiValues[i - 1].value;
    const trend = data[i].close > sma20[i].value;

    // Divergence haussière
    if (rsi < 30 && prevRsi < 30 && data[i].low < data[i - 1].low && rsi > prevRsi) {
      signals.push({
        time: data[i].time,
        type: 'buy',
        price: data[i].close,
        reason: 'RSI bullish divergence'
      });
    }
    
    // Divergence baissière
    if (rsi > 70 && prevRsi > 70 && data[i].high > data[i - 1].high && rsi < prevRsi) {
      signals.push({
        time: data[i].time,
        type: 'sell',
        price: data[i].close,
        reason: 'RSI bearish divergence'
      });
    }
  }
  return signals;
}

export function calculateSMA(data: Kline[], period: number): IndicatorValue[] {
  const smaValues: IndicatorValue[] = [];
  
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, candle) => acc + candle.close, 0);
    smaValues.push({
      time: data[i].time,
      value: sum / period
    });
  }
  
  return smaValues;
}