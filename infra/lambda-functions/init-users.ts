import {
  CloudFormationCustomResourceCreateEvent,
  CloudFormationCustomResourceDeleteEvent,
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
  CloudFormationCustomResourceUpdateEvent,
} from "aws-lambda";
import { DeleteItemCommand, DynamoDBClient, PutItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import * as https from "https";
import * as url from "url";


const secretsManager = new SecretsManagerClient();
const dynamoDB = new DynamoDBClient();

exports.handler = async (event: CloudFormationCustomResourceEvent): Promise<void> => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const loginSecretArn = process.env.LOGIN_SECRET_ARN;
  const loginTableableName = process.env.LOGIN_TABLE_NAME;

  if (!event.RequestType || !loginSecretArn || !loginTableableName) {
    throw new Error("Invalid event: Missing RequestType");
  }
  let physicalResourceId = undefined;
  if (event.RequestType === "Update" || event.RequestType === "Delete") {
    physicalResourceId = event.PhysicalResourceId
  }
  else {
    physicalResourceId = `${event.LogicalResourceId}-${Date.now()}`; 
  }
  try {
    switch (event.RequestType) {
      case "Create":
        await handleCreate(event as CloudFormationCustomResourceCreateEvent, loginSecretArn, loginTableableName);
        break;

      case "Update":
        await handleUpdate(event as CloudFormationCustomResourceUpdateEvent, loginSecretArn, loginTableableName);
        break;

      case "Delete":
        await handleDelete(event as CloudFormationCustomResourceDeleteEvent, loginSecretArn, loginTableableName);
        break;

      default:
        throw new Error(`Unknown RequestType: ${event}`);
    }
    await sendResponse(event, "SUCCESS", "Operation completed successfully", physicalResourceId);
  } catch (error) {
    console.error("Error handling event:", error);
    await sendResponse(event, "FAILED", error instanceof Error ? error.message : "Unknown error", physicalResourceId);
  }
};

async function handleCreate(event: CloudFormationCustomResourceCreateEvent, loginSecretArn: string, loginTableableName: string): Promise<void> {
  console.log("Handling Create event...");
  console.log(event);

  // Fetch secret from Secrets Manager
  const secretValue = await fetchUserSecret(loginSecretArn);

  if (!secretValue) {
    throw new Error("Invalid secret value");
  }
  const params = {
    TableName: loginTableableName,
    Item: {
      username: { S: secretValue.username },
      password: { S: secretValue.password },
    },
  };
  await dynamoDB.send(new PutItemCommand(params));
  console.log("User updated in DynamoDB");
}

async function handleUpdate(event: CloudFormationCustomResourceUpdateEvent, loginSecretArn: string, loginTableableName: string): Promise<void> {
  console.log("Handling Update event...");
  console.log(event);
  const secretValue = await fetchUserSecret(loginSecretArn);
  if (!secretValue) {
    throw new Error("Invalid secret value");
  }
  const params = {
    TableName: loginTableableName,
    Key: {
      username: { S: secretValue.username },
    },
    UpdateExpression: "SET password = :password",
    ExpressionAttributeValues: {
      ":password": { S: secretValue.password },
    },
  };
  await dynamoDB.send(new UpdateItemCommand(params));


}

async function fetchUserSecret(secretArn: string): Promise<{ username: string; password: string } | undefined> {
  if (!secretArn) {
    return;
  }
  const secret = await secretsManager.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!secret.SecretString) return;
  const secretValue = JSON.parse(secret.SecretString || "{}");
  if (!secretValue.username || !secretValue.password)
    return;
  return secretValue;
};


async function handleDelete(event: CloudFormationCustomResourceDeleteEvent, loginSecretArn:string, loginTable:string): Promise<void> {
  console.log("Handling Delete event...");
  console.log(event);
  const secret = await fetchUserSecret(loginSecretArn);
  if (!secret) {
    throw new Error("Invalid secret value");
  }
  const params = {
    TableName: loginTable,
    Key: {
      username: { S: secret.username },
    },
  };
  await dynamoDB.send(new DeleteItemCommand(params));
  console.log("User deleted from DynamoDB");

  console.log("Delete event logic is currently not implemented.");
}

async function sendResponse(
  event: CloudFormationCustomResourceEvent,
  status: string,
  reason: string,
  physicalResourceId: string
): Promise<CloudFormationCustomResourceResponse> {
  const responseBody = {
    Status: status,
    Reason: reason,
    PhysicalResourceId: physicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: {},
  };

  console.log("Response body:", JSON.stringify(responseBody, null, 2));

  const parsedUrl = url.parse(event.ResponseURL);
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.path,
    method: "PUT",
    headers: {
      "Content-Type": "",
      "Content-Length": Buffer.byteLength(JSON.stringify(responseBody)),
    },
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      console.log(`Response status code: ${response.statusCode}`);
    });

    request.on("error", (error) => {
      console.error("Error sending response:", error);
      reject(error);
    });

    request.write(JSON.stringify(responseBody));
    request.end();
  });
}