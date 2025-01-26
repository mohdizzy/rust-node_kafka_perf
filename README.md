# Rust vs Node performance testing

Performance comparison framework between Rust and Node.js Lambda functions using Artillery and Datadog.

## Prerequisites

- Docker
- AWS CDK
- AWS CLI configured with appropriate credentials
- Datadog account with API credentials

## Features

- Artillery-based load testing
- OpenTelemetry instrumentation for Lambda functions
- Datadog metrics integration
- AWS Lambda deployment using CDK
- Rust vs Node.js performance metrics

## Setup

1. Configure AWS credentials
2. Set Datadog credentials as environment variables
3. Create MSK cluster and use the broker strings in the environment variables
4. Install Artillery on your computer and run the test by pointing the config file provided at the root

## Deployment

With docker running,

```bash
sudo cdk deploy --profile <profile_name>
```

## License

MIT
