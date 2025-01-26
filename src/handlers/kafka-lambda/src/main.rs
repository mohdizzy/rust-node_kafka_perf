mod kafka_producer;

use aws_lambda_events::http::StatusCode;
use lambda_http::{
    run, service_fn,
    tracing::{self, instrument},
    Body, Error, Request, RequestExt, RequestPayloadExt, Response,Context
};
use observability::{observability, trace_request};
use serde_json::{json, to_string_pretty, Value};
use ::tracing::{info, Instrument};
use serde::{Deserialize, Serialize};
use std::env;
use opentelemetry::global::ObjectSafeSpan;

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, Registry};
use uuid::{ContextV7, Timestamp, Uuid};


use crate::kafka_producer::produce;
#[derive(Serialize,Deserialize)]
pub struct Test {
    pub trace_id: String,
    pub message: String,
    pub span_id: String,
    pub publish_time: String,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    observability().init();

    run(service_fn(|event: Request| async {
        let mut handler_span = trace_request(&event);

        let res = handler(event).await;

        handler_span.end();

        res
    }))
        .await
}

#[instrument(name = "Kafka_Lambda", skip(event))]
async fn handler(event: Request) -> Result<(Response<String>), Error> {

    let broker = env::var("BROKER").expect("Broker string must be set");
    let topic = env::var("TOPIC").expect("Topic string must be set");

    let return_body = json!("").to_string();
    let status_code = StatusCode::OK;
    info!("Broker: {:?}", broker);
    info!("Topic: {:?}", topic);

    // Extract body from request
    let body = match event.body() {
        Body::Empty => "".to_string(),
        Body::Text(body) => body.clone(),
        Body::Binary(body) => String::from_utf8_lossy(body).to_string(),
    };

    let key = Uuid::new_v7(Timestamp::now(ContextV7::new())).to_string();
    let payload = json!({"message":&body,"key":&key});

    produce(&broker, &topic, &payload.to_string(), &key).await;

    let response = Response::builder()
        .status(status_code)
        .header("Content-Type", "application/json")
        .body(return_body)
        .map_err(Box::new)?;
    Ok(response)
}

