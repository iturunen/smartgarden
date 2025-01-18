#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DataPipelineStack } from '../lib/data-pipeline-stack';
import { SecretStack } from '../lib/secrets-stack';

const env = process.env.ENVIRONMENT || 'dev';
const stackPrefix = process.env.STACK_PREFIX || 'smartgarden';
const adminUserName = process.env.ADMIN_USER_NAME || 'admin';


//TODO mod all cdk.RemovalPolicy.DESTROY
const stackName = `${stackPrefix}-${env}`;
const app = new cdk.App();
new SecretStack(app,`${stackName}-secrets`, {});
new DataPipelineStack(app,`${stackName}-data`, {adminUserName: adminUserName});
