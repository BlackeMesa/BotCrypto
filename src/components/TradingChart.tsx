import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType, IChartApi, LineStyle, CrosshairMode, Time, ChartOptions, DeepPartial, ISeriesApi } from "lightweight-charts";
import type { Kline, TradingSignal } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { calculateEMA, calculateRSI, calculateMACD } from "@/lib/trading";
import { checkMACDSignals } from "@/strategies/MACDStrategy";

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

interface ChartInstance {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick"> | ISeriesApi<"Line">[];
  isDisposed: boolean;
}

export function TradingChart({ data, signals, showSignalLabels = true }: TradingChartProps) {
  const mainChartRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<HTMLDivElement>(null);
  const macdChartRef = useRef<HTMLDivElement>(null);

  const chartsRef = useRef<{
    main?: ChartInstance;
    rsi?: ChartInstance;
    macd?: ChartInstance;
  }>({});

  const [hoveredSignal, setHoveredSignal] = useState<TradingSignal | null>(null);
  const [showIndicators, setShowIndicators] = useState<IndicatorVisibility>({
    ema7: false,
    ema25: false,
    ema99: false,
    rsi: false,
    macd: false,
  });

  const cleanupCharts = useCallback(() => {
    Object.values(chartsRef.current).forEach((chart) => {
      if (chart && !chart.isDisposed) {
        try {
          chart.series = [];
          chart.chart.remove();
          chart.isDisposed = true;
        } catch (error) {
          console.warn("Chart cleanup warning:", error);
        }
      }
    });
    chartsRef.current = {};
  }, []);

  const toggleIndicator = (indicator: keyof IndicatorVisibility) => {
    setShowIndicators((prev) => ({
      ...prev,
      [indicator]: !prev[indicator],
    }));
  };

  const createChartOptions = useCallback(
    (height: number, isMainChart: boolean = false): DeepPartial<ChartOptions> => ({
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
        vertLine: {
          labelVisible: isMainChart,
        },
      },
      rightPriceScale: {
        borderColor: "rgba(70, 70, 70, 0.4)",
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: "rgba(70, 70, 70, 0.4)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 12,
        minBarSpacing: 2,
        fixLeftEdge: true,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true,
        visible: isMainChart,
        borderVisible: isMainChart,
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      height,
    }),
    []
  );

  useEffect(() => {
    if (!mainChartRef.current) return;

    // Cleanup previous charts
    cleanupCharts();

    // Create main chart
    const mainHeight = showIndicators.rsi || showIndicators.macd ? 300 : 500;
    const mainChart = createChart(mainChartRef.current, {
      ...createChartOptions(mainHeight, true),
      width: mainChartRef.current.clientWidth,
    });

    const candlestickSeries = mainChart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    chartsRef.current.main = {
      chart: mainChart,
      series: candlestickSeries,
      isDisposed: false,
    };

    candlestickSeries.setData(
      data.map((d) => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    // Add signals markers
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

    // Add EMA indicators to main chart
    const emaSeriesArray: ISeriesApi<"Line">[] = [];
    if (showIndicators.ema7) {
      const ema7Series = mainChart.addLineSeries({
        color: "#22c55e",
        lineWidth: 1,
        title: "EMA 7",
      });
      const ema7Values = calculateEMA(data, 7);
      ema7Series.setData(ema7Values.map((v) => ({ time: v.time as Time, value: v.value })));
      emaSeriesArray.push(ema7Series);
    }

    if (showIndicators.ema25) {
      const ema25Series = mainChart.addLineSeries({
        color: "#ef4444",
        lineWidth: 1,
        title: "EMA 25",
      });
      const ema25Values = calculateEMA(data, 25);
      ema25Series.setData(ema25Values.map((v) => ({ time: v.time as Time, value: v.value })));
      emaSeriesArray.push(ema25Series);
    }

    if (showIndicators.ema99) {
      const ema99Series = mainChart.addLineSeries({
        color: "#3b82f6",
        lineWidth: 1,
        title: "EMA 99",
      });
      const ema99Values = calculateEMA(data, 99);
      ema99Series.setData(ema99Values.map((v) => ({ time: v.time as Time, value: v.value })));
      emaSeriesArray.push(ema99Series);
    }

    // Create RSI chart
    if (showIndicators.rsi && rsiChartRef.current) {
      const rsiChart = createChart(rsiChartRef.current, {
        ...createChartOptions(100),
        width: rsiChartRef.current.clientWidth,
      });

      const rsiSeries = rsiChart.addLineSeries({
        color: "#3b82f6",
        lineWidth: 1,
        title: "RSI",
        priceFormat: {
          type: "custom",
          minMove: 0.01,
          formatter: (price: number) => price.toFixed(2),
        },
      });

      const rsiUpperLevel = rsiChart.addLineSeries({
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
      });

      const rsiLowerLevel = rsiChart.addLineSeries({
        color: "#22c55e",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
      });

      const rsiValues = calculateRSI(data, 14);
      rsiSeries.setData(rsiValues.map((v) => ({ time: v.time as Time, value: v.value })));
      rsiUpperLevel.setData(rsiValues.map((v) => ({ time: v.time as Time, value: 70 })));
      rsiLowerLevel.setData(rsiValues.map((v) => ({ time: v.time as Time, value: 30 })));

      chartsRef.current.rsi = {
        chart: rsiChart,
        series: [rsiSeries, rsiUpperLevel, rsiLowerLevel],
        isDisposed: false,
      };

      // Sync RSI with main chart
      mainChart.timeScale().subscribeVisibleTimeRangeChange(() => {
        if (!chartsRef.current.rsi?.isDisposed) {
          const mainRange = mainChart.timeScale().getVisibleLogicalRange();
          if (mainRange) {
            rsiChart.timeScale().setVisibleLogicalRange(mainRange);
          }
        }
      });

      rsiChart.timeScale().subscribeVisibleTimeRangeChange(() => {
        if (!chartsRef.current.main?.isDisposed) {
          const rsiRange = rsiChart.timeScale().getVisibleLogicalRange();
          if (rsiRange) {
            mainChart.timeScale().setVisibleLogicalRange(rsiRange);
          }
        }
      });
    }

    // Create MACD chart
    if (showIndicators.macd && macdChartRef.current) {
      const macdChart = createChart(macdChartRef.current, {
        ...createChartOptions(100),
        width: macdChartRef.current.clientWidth,
      });

      const macdSeries = macdChart.addLineSeries({
        color: "#22c55e",
        title: "MACD",
        priceFormat: {
          type: "custom",
          minMove: 0.01,
          formatter: (price: number) => price.toFixed(2),
        },
      });

      const signalSeries = macdChart.addLineSeries({
        color: "#ef4444",
        title: "Signal",
      });

      const macdData = calculateMACD(data);
      macdSeries.setData(macdData.map((v) => ({ time: v.time as Time, value: v.macd })));
      signalSeries.setData(macdData.map((v) => ({ time: v.time as Time, value: v.signal })));

      chartsRef.current.macd = {
        chart: macdChart,
        series: [macdSeries, signalSeries],
        isDisposed: false,
      };

      // Sync MACD with main chart
      mainChart.timeScale().subscribeVisibleTimeRangeChange(() => {
        if (!chartsRef.current.macd?.isDisposed) {
          const mainRange = mainChart.timeScale().getVisibleLogicalRange();
          if (mainRange) {
            macdChart.timeScale().setVisibleLogicalRange(mainRange);
          }
        }
      });

      macdChart.timeScale().subscribeVisibleTimeRangeChange(() => {
        if (!chartsRef.current.main?.isDisposed) {
          const macdRange = macdChart.timeScale().getVisibleLogicalRange();
          if (macdRange) {
            mainChart.timeScale().setVisibleLogicalRange(macdRange);
          }
        }
      });
    }

    // Sync crosshair movement
    const handleCrosshairMove = (param: any) => {
      if (!param.time || chartsRef.current.main?.isDisposed) {
        setHoveredSignal(null);
        return;
      }

      const signal = signals.find((s) => s.time === param.time);
      setHoveredSignal(signal || null);

      // Sync crosshair across all charts
      Object.values(chartsRef.current).forEach(({ chart, isDisposed }) => {
        if (!isDisposed && chart !== mainChart) {
          chart.setCrosshairPosition(param.point?.x, param.point?.y, param.seriesPrices?.get(candlestickSeries));
        }
      });
    };

    mainChart.subscribeCrosshairMove(handleCrosshairMove);

    // Handle window resize
    const handleResize = () => {
      if (!mainChartRef.current) return;
      const width = mainChartRef.current.clientWidth;

      Object.values(chartsRef.current).forEach(({ chart, isDisposed }) => {
        if (!isDisposed) {
          chart.applyOptions({ width });
        }
      });
    };

    window.addEventListener("resize", handleResize);

    // Initial content fit
    mainChart.timeScale().fitContent();
    Object.values(chartsRef.current).forEach(({ chart, isDisposed }) => {
      if (!isDisposed) {
        chart.timeScale().fitContent();
      }
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      cleanupCharts();
    };
  }, [data, signals, showSignalLabels, showIndicators, createChartOptions, cleanupCharts]);

  useEffect(() => {
    if (!macdChartRef.current || !data) return;

    // Vérifier que chartsRef.current.macd existe
    if (!chartsRef.current.macd) return;

    // Récupérer la série MACD
    const macdSeries = chartsRef.current.macd.series[0];
    if (!macdSeries) return;

    // Calculer les signaux MACD
    const macdSignals = checkMACDSignals(data);

    // Créer les marqueurs
    const markers = macdSignals.map(signal => ({
      time: signal.timestamp as Time,
      position: signal.type === 'buy' ? 'belowBar' : 'aboveBar',
      color: signal.type === 'buy' ? '#26a69a' : '#ef5350',
      shape: signal.type === 'buy' ? 'arrowUp' : 'arrowDown',
      text: signal.type === 'buy' ? 'BUY' : 'SELL',
      size: 2
    }));

    // Appliquer les marqueurs à la série MACD
    macdSeries.setMarkers(markers);

    // Logs pour déboguer
    console.log('Signaux MACD détectés:', macdSignals);
    console.log('Marqueurs créés:', markers);
  }, [data]);

  return (
    <div className="relative w-full">
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
      <div className="space-y-1 w-full">
        <div ref={mainChartRef} className="w-full" style={{ height: showIndicators.rsi || showIndicators.macd ? "300px" : "500px" }} />
        {showIndicators.rsi && <div ref={rsiChartRef} className="w-full" style={{ height: "100px" }} />}
        {showIndicators.macd && <div ref={macdChartRef} className="w-full" style={{ height: "100px" }} />}
      </div>
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
