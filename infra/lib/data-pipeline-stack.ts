import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as dotenv from "dotenv";
dotenv.config();
// TODO:  env vars props?
const adminUserName = process.env.ADMIN_USER_NAME;

export class DataPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const stackName = id;

    // DynamoDB Table 1: smartgarden_readings
    const readingsTable = new dynamodb.Table(this, 'SmartGardenReadings', {
      tableName: `${stackName}-readings`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'datetimeid', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      //removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // DynamoDB Table 2: smartgarden_status
    const statusTable = new dynamodb.Table(this, 'SmartGardenStatus', {
      tableName: `${stackName}-status`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'datetimeid', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      //removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const loginTable = new dynamodb.Table(this, 'SmartGardenUsers', {
      tableName: `${stackName}-users`,
      partitionKey: { name: 'username', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'password', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      //removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // intialize the table with some user data
    const loginSecret = new secretsmanager.Secret(this, 'SmartGardenLoginSecret', {
      secretName: 'smartgarden/login',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: adminUserName,
        }),
        generateStringKey: 'password',
        passwordLength: 16,
        includeSpace: false,
        excludePunctuation: true,
        requireEachIncludedType: true,
      },
    });

  const initializerFunction = new NodejsFunction(this, 'SmartGardenAdminUserInitializer', {
    runtime: lambda.Runtime.NODEJS_22_X,
    timeout: cdk.Duration.seconds(30),
    entry: 'lambda-functions/init-users.ts',
    environment: {
      LOGIN_SECRET_ARN: loginSecret.secretArn,
      LOGIN_TABLE_NAME: loginTable.tableName,
    },
  });

  loginSecret.grantRead(initializerFunction);
  loginTable.grantWriteData(initializerFunction);

  new cdk.CustomResource(this, 'InitUserResource', {
    serviceToken: initializerFunction.functionArn,
    resourceType: "Custom::InitUserCustomResource",
  });

    const iotRole = new iam.Role(this, 'IotDynamoDBRole', {
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
    });

    readingsTable.grantReadWriteData(iotRole);
    readingsTable.grantReadWriteData(iotRole);
    statusTable.grantReadWriteData(iotRole);


    new iot.CfnTopicRule(this, 'IotRuleReadings', {
      topicRulePayload: {
        sql: `SELECT * FROM 'smartgarden/readings'`,
        actions: [
          {
            dynamoDBv2: {
              putItem: {tableName: readingsTable.tableName},
              roleArn: iotRole.roleArn,
            },
          },
        ],
      },
    });

    // IoT Rule to read/write from/to smartgarden_status2
    new iot.CfnTopicRule(this, 'IotRuleStatus', {
      topicRulePayload: {
        sql: `SELECT * FROM 'smartgarden/status'`,
        actions: [
          {
            dynamoDBv2: {
              putItem: {tableName: statusTable.tableName},
              roleArn: iotRole.roleArn,
            },
          },
        ],
      },
    });
  }
}
