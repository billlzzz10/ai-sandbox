#!/usr/bin/env node
'use strict';

const path = require('path');
const { loadAgent, improvePromptStub } = require('../server');

function main() {
  try {
    const rolePath = path.join('role', 'coder-agent', 'role.yaml');
    const agent = loadAgent(rolePath);
    const { refinedPrompt } = improvePromptStub('smoke test prompt');
    const tools = agent.listTools();

    console.log(JSON.stringify({
      agentName: agent.name,
      toolCount: tools.length,
      refinedPrompt
    }, null, 2));
  } catch (error) {
    console.error('[SMOKE TEST FAILED]', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
