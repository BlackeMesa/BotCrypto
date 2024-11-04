import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, LineStyle, CrosshairMode, Time, ChartOptions, DeepPartial } from "lightweight-charts";
import type { Kline, TradingSignal } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { calculateEMA, calculateRSI, calculateMACD } from "@/lib/trading";

interface TradingChartProps {
  data: Kline[];
  signals: TradingSignal[];
  showSignalLabels?: boolean;
}

interface IndicatorVisibility {
  ema7: boolean;
  ema25: boolean;
  ema99: boolean;
  rsi: boolean;
  macd: boolean;
}

export function TradingChart({ data, signals, showSignalLabels = true }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const [hoveredSignal, setHoveredSignal] = useState<TradingSignal | null>(null);
  const [showIndicators, setShowIndicators] = useState<IndicatorVisibility>({
    ema7: false,
    ema25: false,
    ema99: false,
    rsi: false,
    macd: false,
  });

  const toggleIndicator = (indicator: keyof IndicatorVisibility) => {
    setShowIndicators((prev) => ({
      ...prev,
      [indicator]: !prev[indicator],
    }));
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartOptions: DeepPartial<ChartOptions> = {
      layout: {
        background: { type: ColorType.Solid, color: "white" },
        textColor: "black",
      },
      grid: {
        vertLines: { color: "rgba(70, 70, 70, 0.2)" },
        horzLines: { color: "rgba(70, 70, 70, 0.2)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "rgba(70, 70, 70, 0.4)",
      },
      timeScale: {
        borderColor: "rgba(70, 70, 70, 0.4)",
        timeVisible: true,
      },
    };

    chart.current = createChart(chartContainerRef.current, chartOptions);
    const candlestickSeries = chart.current.addCandlestickSeries();

    // Ajout des données
    candlestickSeries.setData(
      data.map((d) => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    // Ajout des markers pour les signaux
    if (signals.length > 0) {
      candlestickSeries.setMarkers(
        signals.map((signal) => ({
          time: signal.time as Time,
          position: signal.type === "buy" ? "belowBar" : "aboveBar",
          color: signal.type === "buy" ? "#22c55e" : "#ef4444",
          shape: signal.type === "buy" ? "arrowUp" : "arrowDown",
          text: showSignalLabels ? signal.reason : undefined,
          size: 2,
        }))
      );
    }

    // Ajout du tooltip personnalisé
    chart.current.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setHoveredSignal(null);
        return;
      }

      const signal = signals.find((s) => s.time === param.time);
      setHoveredSignal(signal || null);
    });

    // Ajustement de la vue
    chart.current.timeScale().fitContent();

    // EMA indicators
    if (showIndicators.ema7) {
      const ema7Series = chart.current.addLineSeries({
        color: "#22c55e",
        lineWidth: 1,
        title: "EMA 7",
      });
      const ema7Values = calculateEMA(data, 7);
      ema7Series.setData(ema7Values.map((v) => ({ time: v.time as Time, value: v.value })));
    }

    if (showIndicators.ema25) {
      const ema25Series = chart.current.addLineSeries({
        color: "#ef4444",
        lineWidth: 1,
        title: "EMA 25",
      });
      const ema25Values = calculateEMA(data, 25);
      ema25Series.setData(ema25Values.map((v) => ({ time: v.time as Time, value: v.value })));
    }

    if (showIndicators.ema99) {
      const ema99Series = chart.current.addLineSeries({
        color: "#3b82f6",
        lineWidth: 1,
        title: "EMA 99",
      });
      const ema99Values = calculateEMA(data, 99);
      ema99Series.setData(ema99Values.map((v) => ({ time: v.time as Time, value: v.value })));
    }

    // RSI indicator
    if (showIndicators.rsi) {
      const rsiSeries = chart.current.addLineSeries({
        color: "#3b82f6",
        lineWidth: 1,
        title: "RSI",
        priceFormat: {
          type: "custom",
          minMove: 0.01,
          formatter: (price: number) => price.toFixed(2),
        },
        pane: 1,
        scaleMargins: {
          top: 0.2,
          bottom: 0.2,
        },
        autoscaleInfoProvider: () => ({
          priceRange: {
            minValue: 0,
            maxValue: 100,
          },
        }),
      });

      // Add RSI levels
      const rsiUpperLevel = chart.current.addLineSeries({
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        pane: 1,
        scaleMargins: {
          top: 0.2,
          bottom: 0.2,
        },
      });
      const rsiLowerLevel = chart.current.addLineSeries({
        color: "#22c55e",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        pane: 1,
        scaleMargins: {
          top: 0.2,
          bottom: 0.2,
        },
      });

      const rsiValues = calculateRSI(data, 14);
      rsiSeries.setData(rsiValues.map((v) => ({ time: v.time as Time, value: v.value })));

      // Set constant levels for overbought/oversold
      rsiUpperLevel.setData(rsiValues.map((v) => ({ time: v.time as Time, value: 70 })));
      rsiLowerLevel.setData(rsiValues.map((v) => ({ time: v.time as Time, value: 30 })));
    }

    // MACD indicator
    if (showIndicators.macd) {
      const macdSeries = chart.current.addLineSeries({
        color: "#22c55e",
        title: "MACD",
        priceFormat: {
          type: "custom",
          minMove: 0.01,
          formatter: (price: number) => price.toFixed(2),
        },
        pane: 2,
        scaleMargins: {
          top: 0.2,
          bottom: 0.2,
        },
      });

      const signalSeries = chart.current.addLineSeries({
        color: "#ef4444",
        title: "Signal",
        pane: 2,
        scaleMargins: {
          top: 0.2,
          bottom: 0.2,
        },
      });

      const macdData = calculateMACD(data);
      macdSeries.setData(
        macdData.map((v) => ({
          time: v.time as Time,
          value: v.macd,
        }))
      );
      signalSeries.setData(
        macdData.map((v) => ({
          time: v.time as Time,
          value: v.signal,
        }))
      );
    }

    return () => {
      chart.current?.remove();
    };
  }, [data, signals, showSignalLabels, showIndicators]);

  return (
    <div className="relative">
      <div className="mb-4 flex gap-2 flex-wrap">
        <Button variant={showIndicators.ema7 ? "default" : "outline"} size="sm" onClick={() => toggleIndicator("ema7")}>
          EMA 7
        </Button>
        <Button variant={showIndicators.ema25 ? "default" : "outline"} size="sm" onClick={() => toggleIndicator("ema25")}>
          EMA 25
        </Button>
        <Button variant={showIndicators.ema99 ? "default" : "outline"} size="sm" onClick={() => toggleIndicator("ema99")}>
          EMA 99
        </Button>
        <Button variant={showIndicators.rsi ? "default" : "outline"} size="sm" onClick={() => toggleIndicator("rsi")}>
          RSI
        </Button>
        <Button variant={showIndicators.macd ? "default" : "outline"} size="sm" onClick={() => toggleIndicator("macd")}>
          MACD
        </Button>
      </div>
      <div ref={chartContainerRef} className="h-[500px]" />
      {hoveredSignal && (
        <div className="absolute top-4 right-4 bg-popover p-3 rounded-md shadow-lg border">
          <div className="font-semibold mb-1">Signal {hoveredSignal.type === "buy" ? "d'achat" : "de vente"}</div>
          <div className="text-sm text-muted-foreground">Prix: ${hoveredSignal.price.toFixed(2)}</div>
          <div className="text-sm text-muted-foreground">Raison: {hoveredSignal.reason}</div>
        </div>
      )}
    </div>
  );
}
