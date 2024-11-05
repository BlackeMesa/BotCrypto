import { useEffect, useState } from 'react';
import { TradingChart } from './TradingChart';
import { TradingSimulator } from './TradingSimulator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ArrowDown, ArrowUp, Bitcoin } from 'lucide-react';
import type { Kline, TradingSignal } from '@/lib/types';

const INTERVALS = {
  '1d': { ws: '1d', api: '1d', limit: 1460 },
  '1M': { ws: '1M', api: '1M', limit: 48 },
  '1h': { ws: '1h', api: '1h', limit: 1000 },
};

type IntervalKey = keyof typeof INTERVALS;

export function TradingDashboard() {
  const [candlesticks, setCandlesticks] = useState<Kline[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [interval, setInterval] = useState<IntervalKey>('1d');
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<{from: number, to: number} | null>(null);
  const [simulationData, setSimulationData] = useState<Kline[]>([]);

  const fetchHistoricalData = async (selectedInterval: IntervalKey) => {
    try {
      const endTime = Date.now();
      const startTime = endTime - (4 * 365 * 24 * 60 * 60 * 1000);

      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${INTERVALS[selectedInterval].api}&startTime=${startTime}&endTime=${endTime}&limit=${INTERVALS[selectedInterval].limit}`
      );
      
      const data = await response.json();
      const formattedData = data.map((d: any) => ({
        time: d[0] / 1000,
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
      }));

      setCandlesticks(formattedData);
      setCurrentPrice(formattedData[formattedData.length - 1].close);
      setPriceChange(
        ((formattedData[formattedData.length - 1].close - formattedData[formattedData.length - 1].open) /
          formattedData[formattedData.length - 1].open) *
          100
      );
    } catch (error) {
      console.error('Error fetching historical data:', error);
    }
  };

  useEffect(() => {
    if (wsConnection) {
      wsConnection.close();
    }

    fetchHistoricalData(interval);

    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/btcusdt@kline_${INTERVALS[interval].ws}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.k.x) {
        const newCandle: Kline = {
          time: data.k.t / 1000,
          open: parseFloat(data.k.o),
          high: parseFloat(data.k.h),
          low: parseFloat(data.k.l),
          close: parseFloat(data.k.c),
          volume: parseFloat(data.k.v),
        };
        setCandlesticks((prev) => [...prev.slice(1), newCandle]);
      }
      const newPrice = parseFloat(data.k.c);
      setCurrentPrice(newPrice);
      setPriceChange(((newPrice - parseFloat(data.k.o)) / parseFloat(data.k.o)) * 100);
    };

    setWsConnection(ws);
    return () => ws.close();
  }, [interval]);

  const getTimeframeLabel = (key: IntervalKey) => {
    switch (key) {
      case '1d': return 'Daily';
      case '1M': return 'Monthly';
      case '1h': return 'Hourly';
      default: return key;
    }
  };

  const handleTimeRangeSelect = (from: number, to: number) => {
    const selectedData = candlesticks.filter(
      candle => candle.time >= from && candle.time <= to
    );

    if (selectedData.length > 0) {
      setSelectedTimeRange({ from, to });
      setSimulationData(selectedData);
    }
  };

  const handleReset = () => {
    setSelectedTimeRange(null);
    setSignals([]);
    // Recharger les données initiales si nécessaire
    fetchHistoricalData(selectedInterval);
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Bitcoin className="h-8 w-8 text-yellow-500" />
          <h1 className="text-2xl font-bold">BTC/USDT</h1>
          <Badge variant={priceChange >= 0 ? "default" : "destructive"} className="ml-2">
            {priceChange >= 0 ? <ArrowUp className="h-4 w-4 mr-1" /> : <ArrowDown className="h-4 w-4 mr-1" />}
            {Math.abs(priceChange).toFixed(2)}%
          </Badge>
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">${currentPrice.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end mb-4">
        <ToggleGroup type="single" value={interval} onValueChange={(value: IntervalKey) => value && setInterval(value)}>
          {(Object.keys(INTERVALS) as IntervalKey[]).map((key) => (
            <ToggleGroupItem key={key} value={key} aria-label={`Toggle ${key}`}>
              {getTimeframeLabel(key)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <TradingChart data={candlesticks} signals={signals} onTimeRangeSelect={handleTimeRangeSelect} selectedRange={selectedTimeRange || undefined} />
        </div>
        <div className="lg:col-span-1">
          <TradingSimulator data={simulationData.length > 0 ? simulationData : candlesticks} onSignalsGenerated={setSignals} selectedRange={selectedTimeRange || undefined} onReset={handleReset} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(candlesticks[candlesticks.length - 1]?.volume || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Period High</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">${Math.max(...candlesticks.map((c) => c.high)).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Period Low</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">${Math.min(...candlesticks.map((c) => c.low)).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}