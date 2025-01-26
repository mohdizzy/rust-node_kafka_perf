import { Duration } from "aws-cdk-lib";
import { Architecture, LoggingFormat } from "aws-cdk-lib/aws-lambda";
import { RustFunction } from "cargo-lambda-cdk";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Datadog } from "datadog-cdk-constructs-v2";
export class KafkaLambdaConstruct extends Construct {
  public readonly lambdaARN: string;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const datadogConfig = new Datadog(scope, "DatadogRust", {
      extensionLayerVersion: 67,
      site: "ap1.datadoghq.com",
      apiKey: "xx", // use secret manager!
      service: "kafka-lambda-rust",
      version: "latest",
      env: "dev",
      enableColdStartTracing: true,
      enableDatadogTracing: true,
      captureLambdaPayload: true,
    });

    const kafkaLambda = new RustFunction(scope, "KafkaRust", {
      architecture: Architecture.ARM_64,
      functionName: "kafka-lambda-rust",
      manifestPath: "./src",
      memorySize: 256,
      binaryName: "kafka-lambda",
      loggingFormat: LoggingFormat.JSON,
      timeout: Duration.seconds(30),
      environment: {
        DD_EXTENSION_VRSION: "next",
        DD_ENV: "dev",
        DD_SITE: "ap1.datadoghq.com",
        DD_API_KEY: "xx", // use secret manager!
        RUST_LOG: "info",
        DD_SERVICE: "kafka-lambda-rust",
        FUNCTION_NAME: "kafka-lambda-rust",
        TOPIC: "test-topic",
        BROKER: "",
      },
      vpc: ec2.Vpc.fromLookup(this, "VPC", { isDefault: true }),
      securityGroups: [
        ec2.SecurityGroup.fromSecurityGroupId(this, "sg-xx", "sg-xx"),
      ],
      vpcSubnets: {
        subnets: [
          ec2.Subnet.fromSubnetId(this, "subnet-xx", "subnet-xx"),
          ec2.Subnet.fromSubnetId(this, "subnet-xx", "subnet-xx"),
        ],
      },
      bundling: {
        commandHooks: {
          // required for Kafka lib
          beforeBundling(inputDir: string, outputDir: string): string[] {
            return [
              "apt-get update",
              "apt-get install -y cmake gcc g++ build-essential pkg-config libssl-dev zlib1g-dev",
              "export CMAKE_PREFIX_PATH=/usr/lib/cmake",
            ];
          },
          afterBundling(): string[] {
            return [];
          },
        },
      },
    });

    datadogConfig.addLambdaFunctions([kafkaLambda]);
    this.lambdaARN = kafkaLambda.functionArn;
  }
}
