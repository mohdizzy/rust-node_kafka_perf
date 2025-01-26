
use lambda_http::{
    tracing::{self},
    Request, RequestExt,
};
use opentelemetry::global::BoxedSpan;
use opentelemetry::trace::{
    Span, SpanContext, SpanId, SpanKind, TraceContextExt, TraceFlags, TraceId, TraceState, Tracer,SpanBuilder
};
use opentelemetry::{global, Context, KeyValue};
use opentelemetry_datadog::new_pipeline;
use serde::{Deserialize, Serialize};
use std::env;

use tracing::{info, Subscriber};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing_subscriber::{layer::SubscriberExt, Registry};

mod utils;

pub use utils::parse_name_from_arn;

pub fn observability() -> impl Subscriber + Send + Sync {
    let tracer = new_pipeline()
        .with_service_name(env::var("DD_SERVICE").expect("DD_SERVICE is not set"))
        .with_agent_endpoint("http://127.0.0.1:8126")
        .with_api_version(opentelemetry_datadog::ApiVersion::Version05)
        .with_trace_config(
            opentelemetry_sdk::trace::config()
                .with_sampler(opentelemetry_sdk::trace::Sampler::AlwaysOn)
                .with_id_generator(opentelemetry_sdk::trace::RandomIdGenerator::default()),
        )
        .install_simple()
        .unwrap();

    let telemetry_layer = tracing_opentelemetry::layer().with_tracer(tracer);
    let logger = tracing_subscriber::fmt::layer().json().flatten_event(true);
    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_target(false)
        .without_time();

    Registry::default()
        .with(fmt_layer)
        .with(telemetry_layer)
        .with(logger)
        .with(tracing_subscriber::EnvFilter::from_default_env())
}

pub fn trace_request(event: &Request) -> BoxedSpan {
    let current_span = tracing::Span::current();

    let tracer = global::tracer(env::var("DD_SERVICE").expect("DD_SERVICE is not set"));
    let mut handler_span = tracer
        .span_builder(String::from("aws.lambda"))
        .with_kind(opentelemetry::trace::SpanKind::Internal)
        .start(&tracer);

    current_span
        .set_parent(Context::new().with_remote_span_context(handler_span.span_context().clone()));

    handler_span.set_attribute(KeyValue::new("service", "aws.lambda"));
    handler_span.set_attribute(KeyValue::new("operation_name", "aws.lambda"));
    handler_span.set_attribute(KeyValue::new("init_type", "on-demand"));
    handler_span.set_attribute(KeyValue::new(
        "request_id",
        event.lambda_context().request_id,
    ));

    handler_span.set_attribute(KeyValue::new(
        "base_service",
        env::var("DD_SERVICE").unwrap(),
    ));
    handler_span.set_attribute(KeyValue::new("origin", String::from("lambda")));
    handler_span.set_attribute(KeyValue::new("type", "serverless"));
    handler_span.set_attribute(KeyValue::new(
        "function_arn",
        event.lambda_context().invoked_function_arn,
    ));
    handler_span.set_attribute(KeyValue::new(
        "function_version",
        event.lambda_context().env_config.version.clone(),
    ));

    handler_span
}