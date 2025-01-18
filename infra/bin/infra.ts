#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DataPipelineStack } from '../lib/data-pipeline-stack';

const env = process.env.ENVIRONMENT || 'dev';
const stackPrefix = process.env.STACK_PREFIX || 'smartgarden';

// ADMIN_USER_NAME=admin
// HOST=ah4ynypda2ccs-ats.iot.us-west-2.amazonaws.com
const stackName = `${stackPrefix}-${env}`;
const app = new cdk.App();
new DataPipelineStack(app,`${stackName}-data`);
