import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { TradingSignal } from '@/lib/types';

interface TradeCardProps {
  trade: {
    entry: TradingSignal;
    exit: TradingSignal;
    profit: number;
  };
}

export function TradeCard({ trade }: TradeCardProps) {
  return (
    <div className="flex justify-between items-center p-2 border rounded-md">
      <div className="flex items-center gap-2">
        <Badge variant={trade.profit >= 0 ? "default" : "destructive"}>
          {trade.profit >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
        </Badge>
        <div className="text-sm">
          <div>Entry: ${trade.entry.price.toFixed(2)}</div>
          <div>Exit: ${trade.exit.price.toFixed(2)}</div>
        </div>
      </div>
      <Badge variant={trade.profit >= 0 ? "default" : "destructive"}>
        {trade.profit.toFixed(2)}%
      </Badge>
    </div>
  );
} 