import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Datadog } from "datadog-cdk-constructs-v2";

export class KafkaLambdaNodeConstruct extends Construct {
  public readonly lambdaARN: string;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const instrumentlayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "otelInstrumentation",
      "arn:aws:lambda:eu-west-1:184161586896:layer:opentelemetry-nodejs-0_11_0:1"
    );

    const collectorlayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "otelCollector",
      "arn:aws:lambda:eu-west-1:184161586896:layer:opentelemetry-collector-arm64-0_12_0:1"
    );
    let lambdaFn = new NodejsFunction(scope, "KafkaNode", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      layers: [instrumentlayer, collectorlayer],
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      vpc: ec2.Vpc.fromLookup(this, "VPC", { isDefault: true }),
      memorySize: 512,
      loggingFormat: lambda.LoggingFormat.JSON,
      vpcSubnets: {
        subnets: [
          ec2.Subnet.fromSubnetId(this, "subnet-xx", "subnet-xx"),
          ec2.Subnet.fromSubnetId(this, "subnet-xx", "subnet-xx"),
        ],
      },
      securityGroups: [
        ec2.SecurityGroup.fromSecurityGroupId(this, "sg-xx", "sg-xx"),
      ],
      functionName: "kafka-lambda-node",
      entry: path.join(__dirname, `../src/handlers/kafka-lambda-node/index.ts`),
      bundling: {
        sourceMap: true,
        minify: true,
        target: "es2020",
        commandHooks: {
          beforeBundling(inputDir: string, outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [
              `cp ${path.join(
                __dirname,
                "../src/handlers/kafka-lambda-node/collector.yaml"
              )} ${outputDir}/collector.yaml`,
            ];
          },
          beforeInstall() {
            return [];
          },
        },
      },
      environment: {
        TOPIC: "test-topic",
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/otel-handler",
        OPENTELEMETRY_COLLECTOR_CONFIG_URI: "/var/task/collector.yaml",
        DD_TRACE_OTEL_ENABLED: "true",
        DD_EXTENSION_VERSION: "next",
        DD_ENV: "dev",
        DD_SITE: "ap1.datadoghq.com",
        DD_API_KEY: "xx", // use secrets manager!
        RUST_LOG: "info",
        DD_SERVICE: "kafka-lambda-node",
        DD_PROFILING_ENABLED: "false",
        DD_SERVERLESS_APPSEC_ENABLED: "false",
        FUNCTION_NAME: "kafka-lambda-node",
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
        BROKER: "",
      },
    });

    const datadogConfig = new Datadog(scope, "DatadogNode", {
      extensionLayerVersion: 67,
      nodeLayerVersion: 67,
      site: "ap1.datadoghq.com",
      apiKey: "xx", // use secrets manager!
      service: "kafka-lambda-node",
      version: "latest",
      env: "dev",
      enableColdStartTracing: true,
      enableDatadogTracing: true,
      captureLambdaPayload: true,
    });
    datadogConfig.addLambdaFunctions([lambdaFn]);

    this.lambdaARN = lambdaFn.functionArn;
  }
}
