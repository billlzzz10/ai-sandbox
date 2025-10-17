const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { MASTER_TOOL_MAP } = require('./tools');

const BASE_DATA_DIR = path.resolve(__dirname);

class Tool {
  constructor({ name, spec, implementation }) {
    this.name = name;
    this.spec = spec || {};
    this.implementation = implementation;
  }

  get description() {
    return typeof this.spec.description === 'string' ? this.spec.description : '';
  }
}

class ToolRegistry {
  constructor() {
    this._tools = new Map();
  }

  register(tool) {
    if (tool && tool.name) {
      this._tools.set(tool.name, tool);
    }
  }

  get(name) {
    return this._tools.get(name);
  }

  getAll() {
    return Array.from(this._tools.values());
  }
}

class Agent {
  constructor({ name, description, persona, rules, toolSpecs }) {
    this.name = name;
    this.description = description;
    this.persona = persona || {};
    this.rules = rules;
    this.tools = new ToolRegistry();

    for (const spec of toolSpecs) {
      if (!spec || typeof spec !== 'object') {
        continue;
      }
      const toolName = spec.name;
      if (!toolName) {
        continue;
      }
      const implementation = MASTER_TOOL_MAP[toolName];
      if (!implementation) {
        console.warn(`[WARN] No implementation found for tool '${toolName}'.`);
      }
      this.tools.register(new Tool({ name: toolName, spec, implementation }));
    }
  }

  listTools() {
    return this.tools.getAll().map((tool) => {
      const executionEnvironment = tool.spec?.execution_environment || {};
      const executionPolicy = tool.spec?.execution_policy || {};
      return {
        name: tool.name,
        description: tool.description,
        executionEnvironment: executionEnvironment.type || 'n/a',
        defaultMode: executionPolicy.default_mode || 'n/a',
        implemented: typeof tool.implementation === 'function'
      };
    });
  }

  runTool(toolName, args = []) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { success: false, error: `Tool '${toolName}' not found in agent's registry.` };
    }
    if (typeof tool.implementation !== 'function') {
      return { success: false, error: `Tool '${toolName}' has no implementation.` };
    }

    const safeArgs = Array.isArray(args) ? args : [args];

    try {
      const result = tool.implementation(...safeArgs);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: `Error executing tool '${toolName}': ${error.message}` };
    }
  }
}

function ensureWithinBase(targetPath) {
  const relative = path.relative(BASE_DATA_DIR, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Access to the requested path is not permitted.');
  }
}

function resolveRelativeFile(base, relativePath) {
  if (typeof relativePath !== 'string' || relativePath.trim() === '') {
    throw new Error('Import paths must be non-empty strings.');
  }

  const baseDir = fs.existsSync(base) && fs.statSync(base).isDirectory()
    ? base
    : path.dirname(base);
  const absolutePath = path.resolve(baseDir, relativePath);
  ensureWithinBase(absolutePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing import: ${relativePath}`);
  }

  return absolutePath;
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function loadYamlFile(filePath) {
  try {
    const raw = readFile(filePath);
    const parsed = yaml.load(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    const relative = path.relative(BASE_DATA_DIR, filePath) || filePath;
    throw new Error(`Failed to parse YAML file at ${relative}: ${error.message}`);
  }
}

function loadTextFile(filePath) {
  return readFile(filePath);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function loadAgent(rolePath) {
  const roleFile = resolveRelativeFile(BASE_DATA_DIR, rolePath);
  const roleDoc = loadYamlFile(roleFile);

  const roleDir = path.dirname(roleFile);
  const name = typeof roleDoc.name === 'string' && roleDoc.name.trim()
    ? roleDoc.name.trim()
    : path.basename(roleDir);
  const description = typeof roleDoc.description === 'string' ? roleDoc.description : '';
  const imports = roleDoc.imports && typeof roleDoc.imports === 'object' ? roleDoc.imports : {};

  let persona = null;
  for (const promptPath of asArray(imports.prompts)) {
    const promptFile = resolveRelativeFile(roleDir, promptPath);
    const promptDoc = loadYamlFile(promptFile);
    if (promptDoc && typeof promptDoc.persona === 'object') {
      persona = promptDoc.persona;
    }
  }

  const rules = [];
  for (const rulePath of asArray(imports.rules)) {
    const ruleFile = resolveRelativeFile(roleDir, rulePath);
    rules.push(loadTextFile(ruleFile));
  }

  const toolSpecs = [];
  for (const toolPath of asArray(imports.tools)) {
    const toolFile = resolveRelativeFile(roleDir, toolPath);
    const spec = loadYamlFile(toolFile);
    if (spec && typeof spec === 'object') {
      toolSpecs.push(spec);
    }
  }

  return new Agent({
    name,
    description,
    persona,
    rules,
    toolSpecs
  });
}

function improvePromptStub(rawPrompt = '') {
  const promptText = typeof rawPrompt === 'string' ? rawPrompt : String(rawPrompt ?? '');
  console.log('\\n--- Running Prompt Improvement Assistant (Stub) ---');
  console.log(`Original Prompt: '${promptText}'`);
  const refinedPrompt = `As an expert, provide a detailed answer for the following, including examples: '${promptText}' [REFINED]`;
  console.log(`Refined Prompt: '${refinedPrompt}'`);
  console.log('--- Prompt Improvement Finished ---\\n');
  return {
    originalPrompt: promptText,
    refinedPrompt
  };
}

module.exports = {
    loadAgent,
    improvePromptStub
}