import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: boolean;
  icon?: ReactNode;
  subtitle?: string;
  tooltip: string;
}

export function StatCard({ title, value, trend, icon, subtitle, tooltip }: StatCardProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
            <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
            <div className="flex items-center gap-2 mt-1">
              {icon && <span className="text-lg">{icon}</span>}
              <span className={cn(
                "text-2xl font-bold",
                trend === undefined ? "" : trend ? "text-green-500" : "text-red-500"
              )}>
                {value}
              </span>
            </div>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 