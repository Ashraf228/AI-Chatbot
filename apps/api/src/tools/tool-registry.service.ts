import { Injectable } from '@nestjs/common';

import { getToolDefinition, TOOL_REGISTRY } from './tool-registry';

@Injectable()
export class ToolRegistryService {
  list() {
    return TOOL_REGISTRY;
  }

  get(toolName: string) {
    return getToolDefinition(toolName);
  }

  assertKnown(toolName: string) {
    const definition = this.get(toolName);
    if (!definition) {
      return null;
    }
    return definition;
  }
}
