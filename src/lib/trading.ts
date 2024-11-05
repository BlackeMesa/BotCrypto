import type { Kline, EMAPeriod, IndicatorValue, TradingSignal, StrategyParams, RSIPeriod, TimeframeType } from "./types";

interface TradeResult {
  entryPrice: number;
  exitPrice: number;
  profit: number;
  profitPercentage: number;
  capitalAfterTrade: number;
  quantity: number;
  entryTime: number;
  exitTime: number;
  entryReason?: string;
  exitReason?: string;
}

interface TradingStats {
  totalProfit: number;
  profitPercentage: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  maxDrawdown: number;
  finalCapital: number;
  trades: TradeResult[];
}

export function calculateEMA(data: Kline[], period: EMAPeriod): IndicatorValue[] {
  if (data.length < period) return [];

  const k = 2 / (period + 1);
  let ema = data[0].close;

  return data.map((candle) => {
    ema = candle.close * k + ema * (1 - k);
    return {
      time: candle.time,
      value: ema,
    };
  });
}

export function calculateRSI(data: Kline[], period: RSIPeriod): IndicatorValue[] {
  if (data.length < period + 1) return [];

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(Math.max(0, change));
    losses.push(Math.max(0, -change));
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const rsiValues: IndicatorValue[] = [];
  rsiValues.push({
    time: data[period].time,
    value: 100 - 100 / (1 + avgGain / avgLoss),
  });

  for (let i = period; i < data.length - 1; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    rsiValues.push({
      time: data[i + 1].time,
      value: 100 - 100 / (1 + avgGain / avgLoss),
    });
  }

  return rsiValues;
}

export function calculateMACD(data: Kline[]): { time: number; macd: number; signal: number; histogram: number }[] {
  if (data.length < 26) return [];

  const fastEMA = calculateEMA(data, 12);
  const slowEMA = calculateEMA(data, 26);
  const macdLine = fastEMA.map((fast, i) => ({
    time: fast.time,
    value: fast.value - slowEMA[i].value,
  }));

  const k = 2 / (9 + 1);
  let signal = macdLine[0].value;

  return macdLine.map((macd) => {
    signal = macd.value * k + signal * (1 - k);
    return {
      time: macd.time,
      macd: macd.value,
      signal: signal,
      histogram: macd.value - signal,
    };
  });
}

export function calculateSMA(data: Kline[], period: number): IndicatorValue[] {
  if (data.length < period) return [];

  const smaValues: IndicatorValue[] = [];

  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, candle) => acc + candle.close, 0);
    smaValues.push({
      time: data[i].time,
      value: sum / period,
    });
  }

  return smaValues;
}

function isVolumeSurge(candle: Kline, avgVolume: number, threshold: number): boolean {
  return candle.volume > avgVolume * threshold;
}

function filterDataByTimeframe(data: Kline[], timeframe: TimeframeType): Kline[] {
  if (timeframe === "all") return data;

  const now = Date.now() / 1000; // Convert to seconds
  const timeframes = {
    "1m": 30 * 24 * 60 * 60, // 30 days in seconds
    "3m": 90 * 24 * 60 * 60, // 90 days in seconds
    "6m": 180 * 24 * 60 * 60, // 180 days in seconds
  };

  const timeLimit = timeframes[timeframe];
  return data.filter((candle) => now - candle.time < timeLimit);
}

function generateEMASignals(data: Kline[], fastPeriod: EMAPeriod, slowPeriod: EMAPeriod): TradingSignal[] {
  if (data.length < Math.max(fastPeriod, slowPeriod, 99)) return [];

  const signals: TradingSignal[] = [];
  const fastEma = calculateEMA(data, fastPeriod);
  const slowEma = calculateEMA(data, slowPeriod);
  const trendEma = calculateEMA(data, 99);

  for (let i = 1; i < data.length; i++) {
    if (!fastEma[i] || !slowEma[i] || !trendEma[i]) continue;

    const trend = data[i].close > trendEma[i].value;
    const prevFast = fastEma[i - 1].value;
    const prevSlow = slowEma[i - 1].value;
    const currFast = fastEma[i].value;
    const currSlow = slowEma[i].value;

    const priceConfirmation = trend ? data[i].close > data[i].open : data[i].close < data[i].open;

    if (prevFast <= prevSlow && currFast > currSlow && trend && priceConfirmation) {
      signals.push({
        time: data[i].time,
        type: "buy",
        price: data[i].close,
        reason: `EMA ${fastPeriod} crossed above EMA ${slowPeriod} with trend confirmation`,
      });
    } else if (prevFast >= prevSlow && currFast < currSlow && !trend && priceConfirmation) {
      signals.push({
        time: data[i].time,
        type: "sell",
        price: data[i].close,
        reason: `EMA ${fastPeriod} crossed below EMA ${slowPeriod} with trend confirmation`,
      });
    }
  }
  return signals;
}

function generateRSISignals(data: Kline[], period: RSIPeriod): TradingSignal[] {
  if (data.length < period + 20) return [];

  const signals: TradingSignal[] = [];
  const rsiValues = calculateRSI(data, period);
  const sma20 = calculateSMA(data, 20);

  const startIndex = Math.max(2, period);

  for (let i = startIndex; i < Math.min(rsiValues.length, data.length, sma20.length); i++) {
    const rsi = rsiValues[i]?.value;
    const prevRsi = rsiValues[i - 1]?.value;

    if (!rsi || !prevRsi || !sma20[i]) continue;

    const trend = data[i].close > sma20[i].value;

    if (rsi < 30 && prevRsi < 30 && data[i].low < data[i - 1].low && rsi > prevRsi) {
      signals.push({
        time: data[i].time,
        type: "buy",
        price: data[i].close,
        reason: "RSI bullish divergence",
      });
    }

    if (rsi > 70 && prevRsi > 70 && data[i].high > data[i - 1].high && rsi < prevRsi) {
      signals.push({
        time: data[i].time,
        type: "sell",
        price: data[i].close,
        reason: "RSI bearish divergence",
      });
    }
  }
  return signals;
}

function generateMACDSignals(data: Kline[]): TradingSignal[] {
  if (data.length < 26) return [];

  const signals: TradingSignal[] = [];
  const macdData = calculateMACD(data);

  for (let i = 1; i < macdData.length; i++) {
    const prevMACD = macdData[i - 1];
    const currMACD = macdData[i];

    if (!prevMACD || !currMACD) continue;

    if (prevMACD.macd <= prevMACD.signal && currMACD.macd > currMACD.signal && currMACD.histogram > 0) {
      signals.push({
        time: data[i].time,
        type: "buy",
        price: data[i].close,
        reason: "MACD crossed above signal line with positive momentum",
      });
    }

    if (prevMACD.macd >= prevMACD.signal && currMACD.macd < currMACD.signal && currMACD.histogram < 0) {
      signals.push({
        time: data[i].time,
        type: "sell",
        price: data[i].close,
        reason: "MACD crossed below signal line with negative momentum",
      });
    }
  }

  return signals;
}

export function generateSignals(data: Kline[], strategy: StrategyParams): TradingSignal[] {
  if (data.length < 2) return [];

  const filteredData = filterDataByTimeframe(data, strategy.timeframe);
  if (filteredData.length < 2) return [];

  const signals: TradingSignal[] = [];

  if (strategy.type === "ema_cross" || strategy.type === "multi") {
    if (strategy.fastEma && strategy.slowEma) {
      const emaSignals = generateEMASignals(filteredData, strategy.fastEma, strategy.slowEma);
      signals.push(...emaSignals);
    }
  }

  if (strategy.type === "rsi_oversold" || strategy.type === "multi") {
    if (strategy.rsiPeriod) {
      const rsiSignals = generateRSISignals(filteredData, strategy.rsiPeriod);
      signals.push(...rsiSignals);
    }
  }

  if (strategy.type === "macd_cross" || strategy.type === "multi") {
    const macdSignals = generateMACDSignals(filteredData);
    signals.push(...macdSignals);
  }

  if (strategy.useVolume && signals.length > 0) {
    const avgVolume = filteredData.reduce((sum, d) => sum + d.volume, 0) / filteredData.length;
    return signals.filter((signal) => {
      const candle = filteredData.find((d) => d.time === signal.time);
      return candle && isVolumeSurge(candle, avgVolume, strategy.volumeThreshold || 1.5);
    });
  }

  const validatedSignals = signals
    .sort((a, b) => a.time - b.time)
    .filter((signal, index) => {
      if (index === 0) return signal.type === "buy";
      return signal.type !== signals[index - 1].type;
    });

  return validatedSignals;
}

export function calculateTradingStats(signals: TradingSignal[], initialCapital: number = 10000): TradingStats {
  let currentCapital = initialCapital;
  let peakCapital = initialCapital;
  let maxDrawdown = 0;
  let winningTrades = 0;

  const trades: TradeResult[] = [];
  const validSignals = signals.filter((signal, index) => {
    if (index === 0) return signal.type === "buy";
    return signal.type !== signals[index - 1].type;
  });

  for (let i = 0; i < validSignals.length - 1; i += 2) {
    const buySignal = validSignals[i];
    const sellSignal = validSignals[i + 1];

    if (!buySignal || !sellSignal || buySignal.type !== "buy" || sellSignal.type !== "sell") {
      continue;
    }

    const quantity = currentCapital / buySignal.price;
    const tradeProfitAmount = quantity * (sellSignal.price - buySignal.price);
    const tradeProfitPercentage = ((sellSignal.price - buySignal.price) / buySignal.price) * 100;

    currentCapital += tradeProfitAmount;

    if (currentCapital > peakCapital) {
      peakCapital = currentCapital;
    } else {
      const currentDrawdown = ((peakCapital - currentCapital) / peakCapital) * 100;
      maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
    }

    if (tradeProfitAmount > 0) winningTrades++;

    trades.push({
      entryPrice: buySignal.price,
      exitPrice: sellSignal.price,
      profit: tradeProfitAmount,
      profitPercentage: tradeProfitPercentage,
      capitalAfterTrade: currentCapital,
      quantity,
      entryTime: buySignal.time,
      exitTime: sellSignal.time,
      entryReason: buySignal.reason,
      exitReason: sellSignal.reason,
    });
  }

  const totalProfit = currentCapital - initialCapital;
  const profitPercentage = ((currentCapital - initialCapital) / initialCapital) * 100;

  // Calcul Buy & Hold
  const firstPrice = signals[0]?.price || 0;
  const lastPrice = signals[signals.length - 1]?.price || 0;
  const holdProfitPercentage = ((lastPrice - firstPrice) / firstPrice) * 100;
  const holdFinalCapital = initialCapital * (1 + holdProfitPercentage / 100);

  return {
    totalProfit,
    profitPercentage,
    winRate: trades.length > 0 ? (winningTrades / trades.length) * 100 : 0,
    totalTrades: trades.length,
    winningTrades,
    maxDrawdown,
    finalCapital: currentCapital,
    trades,
    holdProfitPercentage,
    holdFinalCapital,
  };
}
