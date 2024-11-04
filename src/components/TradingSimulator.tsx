import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowDown, ArrowUp, Info } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { TradeCard } from '@/components/ui/TradeCard';
import type { Kline, StrategyType, StrategyParams, TradingSignal } from '@/lib/types';
import { generateSignals, calculateTradingStats } from '@/lib/trading';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TradingSimulatorProps {
  data: Kline[];
  onSignalsGenerated?: (signals: TradingSignal[]) => void;
}

export function TradingSimulator({ data, onSignalsGenerated }: TradingSimulatorProps) {
  const [strategyType, setStrategyType] = useState<StrategyType>('ema_cross');
  const [fastEma, setFastEma] = useState(7);
  const [slowEma, setSlowEma] = useState(25);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [rsiOverbought, setRsiOverbought] = useState(70);
  const [rsiOversold, setRsiOversold] = useState(30);
  const [useVolume, setUseVolume] = useState(false);
  const [volumeThreshold, setVolumeThreshold] = useState(1.5);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('all');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showStrategyInfo, setShowStrategyInfo] = useState<{ type: StrategyType } | null>(null);

  const runSimulation = () => {
    const strategy: StrategyParams = {
      type: strategyType,
      fastEma: fastEma as 7 | 25 | 99,
      slowEma: slowEma as 7 | 25 | 99,
      rsiPeriod: rsiPeriod as 14 | 21,
      rsiOverbought,
      rsiOversold,
      useVolume,
      volumeThreshold
    };

    const newSignals = generateSignals(data, strategy);
    setSignals(newSignals);
    setStats(calculateTradingStats(newSignals));
    onSignalsGenerated?.(newSignals);
  };

  const resetSimulation = () => {
    setSignals([]);
    setStats(null);
    onSignalsGenerated?.([]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Trading Simulator</span>
          <Badge variant="outline">{strategyType === 'multi' ? 'Mode avancé' : 'Mode simple'}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Stratégie de Trading</Label>
            <Select value={strategyType} onValueChange={(value: StrategyType) => setStrategyType(value)}>
              <SelectTrigger>
                <SelectValue />
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
                          setShowStrategyInfo({ type: 'ema_cross' });
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
                    <span className="text-xs text-muted-foreground cursor-help group relative">
                      Surachat/Survente avec divergences
                      <div className="hidden group-hover:block absolute left-0 top-full z-50 w-64 p-2 bg-popover text-popover-foreground rounded-md shadow-md text-sm">
                        Utilise l'indicateur RSI (Relative Strength Index) :
                        <ul className="mt-1 list-disc list-inside">
                          <li>Survente (RSI &lt; 30) : signal d'achat potentiel</li>
                          <li>Surachat (RSI &gt; 70) : signal de vente potentiel</li>
                          <li>Confirmation par divergences prix/RSI pour plus de fiabilité</li>
                        </ul>
                      </div>
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="macd_cross">
                  <div className="flex flex-col">
                    <span>MACD Strategy</span>
                    <span className="text-xs text-muted-foreground cursor-help group relative">
                      Momentum et tendance
                      <div className="hidden group-hover:block absolute left-0 top-full z-50 w-64 p-2 bg-popover text-popover-foreground rounded-md shadow-md text-sm">
                        Stratégie basée sur le MACD :
                        <ul className="mt-1 list-disc list-inside">
                          <li>Signal d'achat : MACD croise au-dessus de sa ligne de signal</li>
                          <li>Signal de vente : MACD croise en-dessous de sa ligne de signal</li>
                          <li>Confirmation par l'histogramme MACD</li>
                          <li>Efficace pour identifier les changements de tendance</li>
                        </ul>
                      </div>
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="multi">
                  <div className="flex flex-col">
                    <span>Multi-Strategy</span>
                    <span className="text-xs text-muted-foreground cursor-help group relative">
                      Combinaison de stratégies
                      <div className="hidden group-hover:block absolute left-0 top-full z-50 w-64 p-2 bg-popover text-popover-foreground rounded-md shadow-md text-sm">
                        Combine plusieurs stratégies pour des signaux plus fiables :
                        <ul className="mt-1 list-disc list-inside">
                          <li>EMA Crossover pour la tendance</li>
                          <li>RSI pour la force du mouvement</li>
                          <li>MACD pour la confirmation</li>
                          <li>Signaux générés uniquement lors de l'alignement des indicateurs</li>
                        </ul>
                      </div>
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Période d'analyse</Label>
            <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les données</SelectItem>
                <SelectItem value="1m">Dernier mois</SelectItem>
                <SelectItem value="3m">3 derniers mois</SelectItem>
                <SelectItem value="6m">6 derniers mois</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch checked={useVolume} onCheckedChange={setUseVolume} />
            <Label>Use Volume Filter</Label>
          </div>

          {(strategyType === 'ema_cross' || strategyType === 'multi') && (
            <div className="space-y-2">
              <Label>Paramètres EMA</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">EMA Rapide</Label>
                  <Select value={fastEma.toString()} onValueChange={(v) => setFastEma(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 périodes</SelectItem>
                      <SelectItem value="25">25 périodes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">EMA Lente</Label>
                  <Select value={slowEma.toString()} onValueChange={(v) => setSlowEma(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25 périodes</SelectItem>
                      <SelectItem value="99">99 périodes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {useVolume && (
            <div className="space-y-2">
              <Label>Seuil de Volume</Label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={volumeThreshold}
                  onChange={(e) => setVolumeThreshold(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm">{volumeThreshold}x</span>
                <InfoTooltip content="Multiplicateur du volume moyen requis pour valider un signal" />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={runSimulation} className="flex-1">Run Simulation</Button>
            <Button onClick={resetSimulation} variant="outline" className="flex-1">Reset</Button>
          </div>
        </div>

        {stats && (
          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                title="Profit Total"
                value={`${Math.abs(stats.totalProfit).toFixed(2)}%`}
                trend={stats.totalProfit >= 0}
                icon={stats.totalProfit >= 0 ? <ArrowUp /> : <ArrowDown />}
                tooltip="Pourcentage total des gains/pertes sur l'ensemble des trades. Un profit positif indique une stratégie rentable."
              />
              <StatCard
                title="Win Rate"
                value={`${stats.winRate.toFixed(2)}%`}
                trend={stats.winRate > 50}
                tooltip="Pourcentage de trades gagnants. Un win rate supérieur à 50% indique une stratégie consistante."
              />
              <StatCard
                title="Nombre de Trades"
                value={stats.totalTrades}
                subtitle={`Gagnants: ${stats.winningTrades}`}
                tooltip="Nombre total de trades effectués. Un nombre suffisant de trades est nécessaire pour valider la fiabilité de la stratégie."
              />
              <StatCard
                title="Drawdown Max"
                value={`${stats.maxDrawdown.toFixed(2)}%`}
                trend={false}
                tooltip="Perte maximale depuis un pic de performance. Indique le risque maximal de la stratégie."
              />
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                Derniers Trades
                <InfoTooltip content="Les 5 dernières transactions effectuées" />
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border p-2">
                {stats.trades.slice(-5).reverse().map((trade, index) => (
                  <TradeCard key={index} trade={trade} />
                ))}
              </div>
            </div>
          </div>
        )}

        {showStrategyInfo && (
          <Dialog open={!!showStrategyInfo} onOpenChange={() => setShowStrategyInfo(null)}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {showStrategyInfo.type === 'ema_cross' && "Stratégie EMA Crossover"}
                  {showStrategyInfo.type === 'rsi_oversold' && "Stratégie RSI"}
                  {showStrategyInfo.type === 'macd_cross' && "Stratégie MACD"}
                  {showStrategyInfo.type === 'multi' && "Stratégie Multiple"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {showStrategyInfo.type === 'ema_cross' && (
                  <>
                    <p>Stratégie basée sur le croisement de deux moyennes mobiles exponentielles :</p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>EMA courte (7) : réactivité aux mouvements récents</li>
                      <li>EMA longue (25) : tendance de fond</li>
                      <li>Signal d'achat : EMA courte croise au-dessus de l'EMA longue</li>
                      <li>Signal de vente : EMA courte croise en-dessous de l'EMA longue</li>
                    </ul>
                  </>
                )}
                {showStrategyInfo.type === 'rsi_oversold' && (
                  <>
                    <p>Utilise l'indicateur RSI (Relative Strength Index) :</p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>Survente (RSI &lt; 30) : signal d'achat potentiel</li>
                      <li>Surachat (RSI &gt; 70) : signal de vente potentiel</li>
                      <li>Confirmation par divergences prix/RSI pour plus de fiabilité</li>
                      <li>Particulièrement efficace dans les marchés sans tendance</li>
                    </ul>
                  </>
                )}
                {showStrategyInfo.type === 'macd_cross' && (
                  <>
                    <p>Stratégie basée sur le MACD (Moving Average Convergence Divergence) :</p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>Signal d'achat : MACD croise au-dessus de sa ligne de signal</li>
                      <li>Signal de vente : MACD croise en-dessous de sa ligne de signal</li>
                      <li>Confirmation par l'histogramme MACD</li>
                      <li>Efficace pour identifier les changements de tendance</li>
                    </ul>
                  </>
                )}
                {showStrategyInfo.type === 'multi' && (
                  <>
                    <p>Combine plusieurs stratégies pour des signaux plus fiables :</p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>EMA Crossover pour la tendance</li>
                      <li>RSI pour la force du mouvement</li>
                      <li>MACD pour la confirmation</li>
                      <li>Signaux générés uniquement lors de l'alignement des indicateurs</li>
                      <li>Réduit les faux signaux mais peut manquer certaines opportunités</li>
                    </ul>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}