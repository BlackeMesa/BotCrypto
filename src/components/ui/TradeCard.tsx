import { ArrowDown, ArrowUp } from "lucide-react";
import { Card } from "./card";
import { cn } from "@/lib/utils";

interface TradeCardProps {
  trade: {
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
  };
}

export function TradeCard({ trade }: TradeCardProps) {
  const isProfit = trade.profit > 0;
  const date = new Date(trade.exitTime * 1000);

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {date.toLocaleDateString()} {date.toLocaleTimeString()}
          </p>
          <div className="flex items-center gap-1">
            {isProfit ? <ArrowUp className="h-4 w-4 text-green-500" /> : <ArrowDown className="h-4 w-4 text-red-500" />}
            <span className={cn("text-sm font-bold", isProfit ? "text-green-500" : "text-red-500")}>
              $
              {Math.abs(trade.profit).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-sm text-muted-foreground">({trade.profitPercentage.toFixed(2)}%)</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">{trade.quantity.toFixed(4)} BTC</p>
          <p className="text-xs text-muted-foreground">
            ${trade.entryPrice.toFixed(2)} → ${trade.exitPrice.toFixed(2)}
          </p>
        </div>
      </div>
      {(trade.entryReason || trade.exitReason) && (
        <div className="mt-2 text-xs text-muted-foreground">
          <p>{trade.entryReason}</p>
          <p>{trade.exitReason}</p>
        </div>
      )}
    </Card>
  );
}
