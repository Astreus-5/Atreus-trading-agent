/**
 * Represents an OHLCV candlestick bar.
 */
export interface KlineBar {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

/**
 * Quantitative Technical Analysis indicators calculated on Binance market data.
 */
export class TechnicalAnalysis {
  /**
   * Computes the Wilder's Relative Strength Index (RSI) for a series of closing prices.
   * @param closes Array of closing price numbers.
   * @param period Smoothing period (default: 14).
   * @returns RSI value between 0.0 and 100.0.
   */
  static calculateRSI(closes: number[], period = 14): number {
    if (!closes || closes.length < period + 1) return 50.0;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) {
        avgGain = (avgGain * (period - 1) + diff) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) - diff) / period;
      }
    }

    if (avgLoss === 0) return 100.0;
    const rs = avgGain / avgLoss;
    return Number((100 - 100 / (1 + rs)).toFixed(2));
  }

  /**
   * Computes the Simple Moving Average (SMA) for a price series.
   * @param data Array of numerical values.
   * @param period Moving average lookback window.
   */
  static calculateSMA(data: number[], period: number): number {
    if (!data || data.length === 0) return 0;
    if (data.length < period) return data[data.length - 1];
    const slice = data.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return Number((sum / period).toFixed(2));
  }
}
