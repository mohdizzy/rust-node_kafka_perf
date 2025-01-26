use lambda_http::tracing::info;
use rdkafka::config::ClientConfig;
use rdkafka::producer::{FutureProducer, FutureRecord};
use std::time::Duration;
use tracing::{instrument, Instrument};
#[instrument(name = "producer",skip(payload))]
pub async fn produce(brokers: &str, topic_name: &str, payload: &str, key: &str) {
    let producer_span = tracing::info_span!("Push message");
    let producer: &FutureProducer = &ClientConfig::new()
        .set("bootstrap.servers", brokers)
        .set("message.timeout.ms", "5000")
        .create()
        .expect("Producer creation error");

    let delivery_status = producer
        .send(
            FutureRecord::to(topic_name).payload(payload).key(key),
            Duration::from_secs(0),
        )
        .instrument(producer_span)
        .await;

    match &delivery_status {
        Ok((partition, offset)) => {
            info!(
                kafka.partition = partition,
                kafka.offset = offset,
                kafka.message.key = key,
                "Message delivered successfully"
            );
        }
        Err((err, _)) => {
            info!(
                error = %err,
                kafka.message.key = key,
                "Failed to deliver message"
            );
        }
    }
}
