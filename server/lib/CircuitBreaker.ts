// server/lib/CircuitBreaker.ts

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold: number; // Number of consecutive failures before opening the circuit
  successThreshold: number; // Number of consecutive successes in HALF_OPEN before closing
  timeout: number; // Time in ms before the circuit transitions from OPEN to HALF_OPEN
  volumeThreshold: number; // Minimum number of requests before the circuit breaker can trip
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private options: CircuitBreakerOptions;
  private requestCount = 0;

  constructor(options?: Partial<CircuitBreakerOptions>) {
    this.options = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000, // 30 seconds
      volumeThreshold: 10, // At least 10 requests before tripping
      ...options,
    };
  }

  public async fire<T>(func: () => Promise<T>): Promise<T> {
    this.requestCount++;

    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.options.timeout) {
        this.halfOpen();
      } else {
        throw new Error('CircuitBreaker: Circuit is OPEN');
      }
    }

    try {
      const result = await func();
      this.success(result);
      return result;
    } catch (error) {
      this.fail(error);
      throw error;
    }
  }

  // ✅ Backwards-compat alias – existing code using `.execute()` will still work
  public async execute<T>(func: () => Promise<T>): Promise<T> {
    return this.fire(func);
  }

  private close(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    console.log('CircuitBreaker: State changed to CLOSED');
  }

  private open(): void {
    this.state = CircuitBreakerState.OPEN;
    this.lastFailureTime = Date.now();
    console.log('CircuitBreaker: State changed to OPEN');
  }

  private halfOpen(): void {
    this.state = CircuitBreakerState.HALF_OPEN;
    this.successCount = 0;
    console.log('CircuitBreaker: State changed to HALF_OPEN');
  }

  private success<T>(_result: T): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.close();
      }
    } else {
      // Reset failures on success in CLOSED state
      this.failureCount = 0;
    }
  }

  private fail(_error: any): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.open(); // Fail immediately if in HALF_OPEN
    } else if (this.state === CircuitBreakerState.CLOSED) {
      if (
        this.requestCount >= this.options.volumeThreshold &&
        this.failureCount >= this.options.failureThreshold
      ) {
        this.open();
      }
    }
  }

  public getState(): CircuitBreakerState {
    return this.state;
  }
}
