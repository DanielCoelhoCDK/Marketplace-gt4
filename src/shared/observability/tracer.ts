import { trace, context, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("marketplace-api", "1.0.0");

export function withSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const span = tracer.startSpan(name);
  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error: any) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error?.message || "Unknown error"
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}

export { tracer };

