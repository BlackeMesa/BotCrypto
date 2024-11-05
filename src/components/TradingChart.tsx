import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createChart, ColorType, IChartApi, LineStyle, CrosshairMode, Time, ChartOptions, DeepPartial, ISeriesApi } from "lightweight-charts";
import type { Kline, TradingSignal } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { calculateEMA, calculateRSI, calculateMACD } from "@/lib/trading";
import { compareWithHoldStrategy } from "@/lib/strategies/compareStrategies";


interface TradingChartProps {
  data: Kline[];
  signals: TradingSignal[];
  showSignalLabels?: boolean;
  onTimeRangeSelect?: (from: number, to: number) => void;
  selectedRange?: { from: number; to: number };
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

function prepareChartData(data: Kline[]) {
  // Remove duplicates and ensure ascending order
  const uniqueData = Array.from(new Map(data.map((item) => [item.time, item])).values());
  return uniqueData.sort((a, b) => a.time - b.time);
}

export function TradingChart({ data, signals, showSignalLabels = true, onTimeRangeSelect, selectedRange }: TradingChartProps) {
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

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);

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

  useEffect(() => {
    if (!mainChartRef.current || !data.length) return;

    console.log("Début de la création du graphique");

    // Préparer les données
    const chartData = prepareChartData(data);
    if (chartData.length === 0) return;

    // Create main chart avec les options directement
    const mainHeight = showIndicators.rsi || showIndicators.macd ? 300 : 500;
    const mainChart = createChart(mainChartRef.current, {
      width: mainChartRef.current.clientWidth,
      height: mainHeight,
      layout: {
        background: { type: ColorType.Solid, color: "white" },
        textColor: "black",
      },
      grid: {
        vertLines: { color: "rgba(70, 70, 70, 0.2)" },
        horzLines: { color: "rgba(70, 70, 70, 0.2)" },
      },
      timeScale: {
        rightOffset: 50,
        leftOffset: 50,
        barSpacing: 12,
        minBarSpacing: 2,
        fixLeftEdge: true,
        fixRightEdge: true,
        borderColor: "rgba(70, 70, 70, 0.4)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    console.log("Graphique créé avec options:", mainChart.timeScale().options());

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
      chartData.map((d) => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );


    // Add signals markers
    if (signals.length > 0) {
      // Fonction utilitaire pour s'assurer que le timestamp est valide
      const ensureValidTime = (time: number): Time => {
        const timestamp = time * (time < 1e12 ? 1000 : 1);
        return Math.floor(timestamp / 1000) as Time;
      };

      // Créer tous les marqueurs
      const allMarkers = [
        // Marqueurs des signaux
        ...signals.map((signal) => ({
          time: ensureValidTime(signal.time),
          position: signal.type === "buy" ? "belowBar" : "aboveBar",
          color: signal.type === "buy" ? "#22c55e" : "#ef4444",
          shape: signal.type === "buy" ? "arrowUp" : "arrowDown",
          text: showSignalLabels ? signal.reason : undefined,
          size: 2,
        }))
      ];

      // Ajouter les marqueurs Buy & Hold si on a des signaux
      // (cela signifie qu'une simulation a été lancée)
      if (signals.length > 0) {
        // Trouver le premier et le dernier signal pour déterminer la plage
        const firstSignalTime = Math.min(...data.map(d => d.time));
        const lastSignalTime = Math.max(...data.map(d => d.time));

        console.log(new Date(firstSignalTime).toLocaleString());
        console.log(new Date(lastSignalTime).toLocaleString());
        

        // Trouver les données correspondantes
       const { from, to } = selectedRange || {};
        if (from && to) {
          allMarkers.push(
            {
              time: ensureValidTime(from),
              position: "belowBar",
              color: "#9333ea",
              shape: "arrowUp",
              text: "Buy & Hold Entry",
              size: 2,
            },
            {
              time: ensureValidTime(to),
              position: "aboveBar",
              color: "#9333ea",
              shape: "arrowDown",
              text: "Buy & Hold Exit",
              size: 2,
            }
          );
        }
      }

      // Trier les marqueurs par ordre chronologique
      const sortedMarkers = allMarkers.sort((a, b) => {
        const timeA = typeof a.time === 'number' ? a.time : 0;
        const timeB = typeof b.time === 'number' ? b.time : 0;
        return timeA - timeB;
      });

      // Appliquer les marqueurs triés
      candlestickSeries.setMarkers(sortedMarkers);
    }

    // Add EMA indicators to main chart
    const emaSeriesArray: ISeriesApi<"Line">[] = [];
    if (showIndicators.ema7) {
      const ema7Series = mainChart.addLineSeries({
        color: "#22c55e",
        lineWidth: 1,
        title: "EMA 7",
      });
      const ema7Values = calculateEMA(chartData, 7);
      ema7Series.setData(ema7Values.map((v) => ({ time: v.time as Time, value: v.value })));
      emaSeriesArray.push(ema7Series);
    }

    if (showIndicators.ema25) {
      const ema25Series = mainChart.addLineSeries({
        color: "#ef4444",
        lineWidth: 1,
        title: "EMA 25",
      });
      const ema25Values = calculateEMA(chartData, 25);
      ema25Series.setData(ema25Values.map((v) => ({ time: v.time as Time, value: v.value })));
      emaSeriesArray.push(ema25Series);
    }

    if (showIndicators.ema99) {
      const ema99Series = mainChart.addLineSeries({
        color: "#3b82f6",
        lineWidth: 1,
        title: "EMA 99",
      });
      const ema99Values = calculateEMA(chartData, 99);
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

      const rsiValues = calculateRSI(chartData, 14);
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

      const macdData = calculateMACD(chartData);
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

    // Gestionnaire de redimensionnement
    const handleResize = () => {
      if (mainChartRef.current) {
        mainChart.applyOptions({
          width: mainChartRef.current.clientWidth,
        });
        mainChart.timeScale().fitContent();
      }
    };

    // Ajouter le gestionnaire de redimensionnement
    window.addEventListener('resize', handleResize);

    // Force un premier ajustement
    handleResize();

    // Activer le mode de sélection de plage
    mainChart.applyOptions({
      handleScale: {
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
    });

    // Gestionnaires d'événements pour la sélection
    const handleClick = (param: MouseEventParams) => {
      if (!param.time || !onTimeRangeSelect) return;

      if (!isSelecting) {
        setSelectionStart(param.time as number);
        setIsSelecting(true);
      } else {
        setIsSelecting(false);
        if (selectionStart) {
          const from = Math.min(selectionStart, param.time as number);
          const to = Math.max(selectionStart, param.time as number);
          onTimeRangeSelect(from, to);
        }
        setSelectionStart(null);
      }
    };

    mainChart.subscribeClick(handleClick);

    // Nettoyage
    return () => {
      window.removeEventListener('resize', handleResize);
      mainChart.remove();
      mainChart.unsubscribeClick(handleClick);
    };
  }, [data, signals, showSignalLabels, showIndicators, isSelecting, selectionStart]);

  const performance = useMemo(() => {
    if (!data?.length || !signals?.length) return null;
    return compareWithHoldStrategy(data, signals);
  }, [data, signals]);

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
      {isSelecting && (
        <div className="absolute top-0 left-0 right-0 bg-blue-500/10 p-2 text-center text-sm">
          Cliquez pour sélectionner la fin de la période
        </div>
      )}
    </div>
  );
}
