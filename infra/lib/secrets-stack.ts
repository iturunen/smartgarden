import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as fs from "fs";
import * as path from "path";

import {
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
const client = new SecretsManagerClient();

const credentialsDir = path.join(__dirname, "../../credentials");

// Lue tiedostot paikallisesta hakemistosta
const certificate = fs.readFileSync(
  path.join(credentialsDir, "certificate.pem.crt"),
  "utf8"
);
const privateKey = fs.readFileSync(
  path.join(credentialsDir, "private.pem.key"),
  "utf8"
);
const rootCertificate = fs.readFileSync(
  path.join(credentialsDir, "rootca.pem"),
  "utf8"
);
const host = fs.readFileSync(path.join(credentialsDir, "host.txt"), "utf8");

export class SecretStack extends cdk.Stack {
  secretName: string;
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);
    const stackName = id;
    this.secretName = `${stackName}-iot-certificate`;
    // create secret for certificates that are read by the iot devices
    // certificate.pem.crt, private.pem.key, and public.pem.key
    // init by coppying from local files credentials directory
    const secret = new secretsmanager.Secret(this, "SmartGardenIotCertSecret", {
      secretName: this.secretName,
      secretObjectValue: {
        certificate: cdk.SecretValue.unsafePlainText(""),
        privateKey: cdk.SecretValue.unsafePlainText(""),
        rootCertificate: cdk.SecretValue.unsafePlainText(""),
        host: cdk.SecretValue.unsafePlainText(""),
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // hack to update secret value if it is empty so no need to laboriously update it with custom resource
    // or expose it in plain text in the stack template
    this.updateSecretValue(this.secretName, certificate, privateKey, rootCertificate, host);
  }
  // get secret and update it if it exists and values are ''
  async updateSecretValue(
    secretName: string,
    certificate: string,
    privateKey: string,
    rootCertificate: string,
    host: string
  ) {
    const getSecretValueCommand = new GetSecretValueCommand({
      SecretId: secretName,
    });
    const data = await client.send(getSecretValueCommand);

    const jsonData = JSON.parse(data.SecretString || "{}");
    if (
      jsonData.certificate === "" &&
      jsonData.privateKey === "" &&
      jsonData.rootCertificate === "" &&
      jsonData.host === ""
    ) {
      const putSecretValueCommand = new PutSecretValueCommand({
        SecretId: secretName,
        SecretString: JSON.stringify({
          certificate: certificate,
          privateKey: privateKey,
          rootCertificate: rootCertificate,
          host: host,
        }),
      });
      client
        .send(putSecretValueCommand)
        .then((data) => {
          console.log(data);
        })
        .catch((error) => {
          console.log(error);
        });
    }
  }
}

