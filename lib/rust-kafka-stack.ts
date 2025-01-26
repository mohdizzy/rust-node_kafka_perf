import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { KafkaLambdaConstruct } from "../constructs/kafka-lambda-rust";
import { KafkaLambdaNodeConstruct } from "../constructs/kafka-lambda-node";
import * as api from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";

export class RustKafkaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const rustLambda = new KafkaLambdaConstruct(this, "RustLambdaProducer");

    const nodeLambda = new KafkaLambdaNodeConstruct(this, "NodeLambdaProducer");

    const endpoint = new api.RestApi(this, "ArtilleryAPI", {
      restApiName: "ArtilleryAPI",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowOrigins: api.Cors.ALL_ORIGINS,
        allowMethods: api.Cors.ALL_METHODS,
        allowHeaders: api.Cors.DEFAULT_HEADERS,
      },
    });

    const rustResource = endpoint.root.addResource("rust");
    const nodeResource = endpoint.root.addResource("node");

    const rustLambdaRef = lambda.Function.fromFunctionArn(
      this,
      "RustLambda",
      rustLambda.lambdaARN
    );
    const nodeLambdaRef = lambda.Function.fromFunctionArn(
      this,
      "NodeLambda",
      nodeLambda.lambdaARN
    );

    const apigwrole = new cdk.aws_iam.Role(this, "ApiGatewayLambdaRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("apigateway.amazonaws.com"),
      inlinePolicies: {
        LambdaInvokePolicy: new cdk.aws_iam.PolicyDocument({
          statements: [
            new cdk.aws_iam.PolicyStatement({
              actions: ["lambda:InvokeFunction"],
              resources: [rustLambda.lambdaARN, nodeLambda.lambdaARN],
              effect: cdk.aws_iam.Effect.ALLOW,
            }),
          ],
        }),
      },
    });

    const rustLambdaIntegration = new api.LambdaIntegration(rustLambdaRef, {
      proxy: true,
      credentialsRole: apigwrole,
    });

    rustResource.addMethod("POST", rustLambdaIntegration);

    const nodeLambdaIntegration = new api.LambdaIntegration(nodeLambdaRef, {
      proxy: true,
      credentialsRole: apigwrole,
    });

    nodeResource.addMethod("POST", nodeLambdaIntegration);

    new cdk.CfnOutput(this, "ArtilleryEndpoint", {
      value: endpoint.url,
      description: "Artillery API Endpoint",
    });
  }
}
