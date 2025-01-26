import { Logger } from "@serverless-guru/logger";

export const logger = new Logger("Lambda-tracer", "Datadog-tracing");
export const metricUnits = Logger.METRIC_UNITS;
