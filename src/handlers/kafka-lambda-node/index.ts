import * as kafka from "kafkajs";
import { v7 as uuidv7 } from "uuid";
import { logger } from "./utils/logger";
import { Context, APIGatewayEvent } from "aws-lambda";
const kafkaBrokers = process.env.BROKER || "localhost:9092";
const topic = process.env.TOPIC || "test-topic";

const handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<any> => {
  try {
    const message = JSON.parse(event.body || "{}");
    const kafkaClient = new kafka.Kafka({
      clientId: "my-app",
      brokers: kafkaBrokers.split(","),
    });

    const producer = kafkaClient.producer();
    await producer.connect();

    const kafkaRes = await producer.send({
      topic,
      messages: [{ value: JSON.stringify({ message, id: uuidv7() }) }],
    });

    logger.info("Message sent to Kafka", { kafkaRes });
    await producer.disconnect();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Message sent to Kafka" }),
    };
  } catch (error) {
    logger.error(`Error sending message to Kafka ${error}`);
  }
};

module.exports = { handler };
