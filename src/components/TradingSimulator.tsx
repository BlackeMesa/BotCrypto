import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowDown, ArrowUp, Info, DollarSign } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { TradeCard } from "@/components/ui/TradeCard";
import type { Kline, StrategyType, TimeframeType, StrategyParams, TradingSignal } from "@/lib/types";
import { generateSignals, calculateTradingStats } from "@/lib/trading";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TradingSimulatorProps {
  data: Kline[];
  onSignalsGenerated: (signals: TradingSignal[]) => void;
  selectedRange?: { from: number; to: number } | null;
  onReset?: () => void;
}

export function TradingSimulator({ data, onSignalsGenerated, selectedRange, onReset }: TradingSimulatorProps) {
  const [strategyType, setStrategyType] = useState<StrategyType>("ema_cross");
  const [fastEma, setFastEma] = useState(7);
  const [slowEma, setSlowEma] = useState(25);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [rsiOverbought, setRsiOverbought] = useState(70);
  const [rsiOversold, setRsiOversold] = useState(30);
  const [useVolume, setUseVolume] = useState(false);
  const [volumeThreshold, setVolumeThreshold] = useState(1.5);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeType>("all");
  const [showStrategyInfo, setShowStrategyInfo] = useState<{ type: StrategyType } | null>(null);
  const [initialCapital, setInitialCapital] = useState<number>(10000);

  const runSimulation = () => {
    const strategy: StrategyParams = {
      type: strategyType,
      timeframe: selectedTimeframe,
      fastEma: fastEma as 7 | 25 | 99,
      slowEma: slowEma as 7 | 25 | 99,
      rsiPeriod: rsiPeriod as 14 | 21,
      rsiOverbought,
      rsiOversold,
      useVolume,
      volumeThreshold,
    };

    const newSignals = generateSignals(data, strategy);
    setSignals(newSignals);
    setStats(calculateTradingStats(newSignals, initialCapital, data));
    onSignalsGenerated?.(newSignals);
  };

  const resetSimulation = () => {
    setSignals([]);
    setStats(null);
    onSignalsGenerated?.([]);
  };

  const handleCapitalChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      setInitialCapital(numValue);
    }
  };

  const handleSimulation = () => {
    if (!selectedRange) {
      alert("Sélectionnez une période avant de lancer la simulation.");
      return;
    }
    runSimulation();
  };

  // Fonction pour formater la date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    }
    // Reset local state
    setStrategyType('ema-cross');
    setStats(null);
    // ... autres resets nécessaires ...
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Trading Simulator</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleReset}
          >
            Reset
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Période sélectionnée */}
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-4 space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground">
              Période de simulation
            </h3>
            {selectedRange ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Début:</span>
                  <span className="font-medium">{formatDate(selectedRange.from)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fin:</span>
                  <span className="font-medium">{formatDate(selectedRange.to)}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-center py-2 text-muted-foreground">
                Cliquez sur le graphique pour sélectionner une période
              </div>
            )}
          </div>
        </div>

        {/* Capital initial */}
        <div className="space-y-2">
          <Label htmlFor="capital">Capital initial ($)</Label>
          <Input 
            id="capital"
            type="number"
            value={initialCapital}
            onChange={(e) => handleCapitalChange(e.target.value)}
            min={0}
            step={1000}
          />
        </div>

        {/* Stratégie */}
        <div className="space-y-2">
          <Label htmlFor="strategy">Stratégie</Label>
          <Select
            value={strategyType}
            onValueChange={(value: StrategyType) => setStrategyType(value)}
          >
            <SelectTrigger id="strategy">
              <SelectValue placeholder="Sélectionnez une stratégie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ema_cross">
                <div className="flex flex-col">
                  <span className="flex items-center gap-2">
                    EMA Crossover
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowStrategyInfo({ type: "ema_cross" });
                      }}
                    >
                      <Info className="h-3 w-3" />
                    </Button>
                  </span>
                  <span className="text-xs text-muted-foreground">Croisement de moyennes mobiles</span>
                </div>
              </SelectItem>
              <SelectItem value="rsi_oversold">
                <div className="flex flex-col">
                  <span>RSI Strategy</span>
                  <span className="text-xs text-muted-foreground">Surachat/Survente avec divergences</span>
                </div>
              </SelectItem>
              <SelectItem value="macd_cross">
                <div className="flex flex-col">
                  <span>MACD Strategy</span>
                  <span className="text-xs text-muted-foreground">Momentum et tendance</span>
                </div>
              </SelectItem>
              <SelectItem value="multi">
                <div className="flex flex-col">
                  <span>Multi-Strategy</span>
                  <span className="text-xs text-muted-foreground">Combinaison de stratégies</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button 
          onClick={handleSimulation}
          disabled={!selectedRange} 
          className="w-full"
          variant={selectedRange ? "default" : "secondary"}
        >
          {!selectedRange ? "Sélectionnez une période" : "Lancer la simulation"}
        </Button>

        {/* Résultats */}
        {stats && (
          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                title="Capital Final"
                value={`$${stats.finalCapital.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                trend={stats.finalCapital >= initialCapital}
                icon={stats.finalCapital >= initialCapital ? <ArrowUp /> : <ArrowDown />}
                tooltip="Capital après tous les trades"
              />
              <StatCard title="Profit Total" value={`${stats.profitPercentage.toFixed(2)}%`} trend={stats.profitPercentage >= 0} tooltip="Pourcentage total des gains/pertes" />
              <StatCard title="Win Rate" value={`${stats.winRate.toFixed(2)}%`} trend={stats.winRate > 50} tooltip="Pourcentage de trades gagnants" />
              <StatCard title="Drawdown Max" value={`${stats.maxDrawdown.toFixed(2)}%`} trend={false} tooltip="Perte maximale depuis un pic de performance" />
              <StatCard
                title="Capital Final (Hold)"
                value={`$${stats.holdFinalCapital.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                trend={stats.holdFinalCapital >= initialCapital}
                icon={stats.holdFinalCapital >= initialCapital ? <ArrowUp /> : <ArrowDown />}
                tooltip="Capital si on avait juste acheté et gardé"
                variant="purple"
              />
              <StatCard
                title="Différence vs Hold"
                value={`${(stats.profitPercentage - stats.holdProfitPercentage).toFixed(2)}%`}
                trend={stats.profitPercentage > stats.holdProfitPercentage}
                tooltip="Différence de performance avec Buy & Hold"
                variant="purple"
              />
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                Derniers Trades
                <InfoTooltip content="Les 5 dernières transactions effectuées" />
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border p-2">
                {stats.trades
                  .slice(-5)
                  .reverse()
                  .map((trade, index) => (
                    <TradeCard key={index} trade={trade} />
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Strategy info dialog remains the same... */}
      </CardContent>
    </Card>
  );
}
