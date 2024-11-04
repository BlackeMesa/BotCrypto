export interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBook {
  bids: [string, string][];
  asks: [string, string][];
}

export type EMAPeriod = 7 | 25 | 99;
export type RSIPeriod = 14 | 21;
export type MACDParams = {
  fast: 12;
  slow: 26;
  signal: 9;
};

export interface TradingSignal {
  time: number;
  type: 'buy' | 'sell';
  price: number;
  reason?: string;
}

export interface IndicatorValue {
  time: number;
  value: number;
}

export type StrategyType = 'ema_cross' | 'rsi_oversold' | 'macd_cross' | 'multi';

export interface StrategyParams {
  type: StrategyType;
  fastEma?: EMAPeriod;
  slowEma?: EMAPeriod;
  rsiPeriod?: RSIPeriod;
  rsiOverbought?: number;
  rsiOversold?: number;
  macd?: MACDParams;
  useVolume?: boolean;
  volumeThreshold?: number;
}