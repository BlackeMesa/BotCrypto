import { CandleData } from "../types/CandleData";
import { Signal } from "../types/Signal";
export function checkMACDSignals(data: CandleData[]): Signal[] {
  const signals: Signal[] = [];
  
  // On s'assure d'avoir assez de données
  if (data.length < 2) return signals;
  
  for (let i = 1; i < data.length; i++) {
    const previousMACD = data[i-1].macd;
    const currentMACD = data[i].macd;
    const previousSignal = data[i-1].signal;
    const currentSignal = data[i].signal;
    
    // Vérification que les valeurs ne sont pas undefined ou null
    if (!previousMACD || !currentMACD || !previousSignal || !currentSignal) {
      continue;
    }

    // Signal d'achat : MACD croise au-dessus de la ligne de signal
    if (previousMACD <= previousSignal && currentMACD > currentSignal) {
      signals.push({
        type: 'buy',
        price: data[i].close,
        timestamp: data[i].timestamp,
        strength: Math.abs(currentMACD - currentSignal) // Force du signal
      });
    }
    
    // Signal de vente : MACD croise en-dessous de la ligne de signal
    if (previousMACD >= previousSignal && currentMACD < currentSignal) {
      signals.push({
        type: 'sell',
        price: data[i].close,
        timestamp: data[i].timestamp,
        strength: Math.abs(currentMACD - currentSignal) // Force du signal
      });
    }
  }

  // Filtrer les signaux trop faibles
  const STRENGTH_THRESHOLD = 0.00001;
  return signals.filter(signal => signal.strength > STRENGTH_THRESHOLD);
} 