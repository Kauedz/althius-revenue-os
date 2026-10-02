export * from './workspaceService';
export * from './agentService';
export * from './executionService';
export * from './approvalService';
export * from './chatService';
export * from './pipelineService';
export * from './creditService';

import { workspaceService } from './workspaceService';
import { agentService } from './agentService';
import { executionService } from './executionService';
import { approvalService } from './approvalService';
import { chatService } from './chatService';
import { pipelineService } from './pipelineService';
import { creditService } from './creditService';

export const althiusApi = {
  workspaces: workspaceService,
  agents: agentService,
  executions: executionService,
  approvals: approvalService,
  chat: chatService,
  pipeline: pipelineService,
  credits: creditService
};

export default althiusApi;
