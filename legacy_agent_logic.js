const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function assertNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string.`);
  }
}

function resolveImport(baseDir, importPath) {
  return path.resolve(baseDir, importPath);
}

function readTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function loadYamlFile(filePath) {
  const content = readTextFile(filePath);
  const parsed = yaml.load(content);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`YAML file at ${filePath} did not contain an object.`);
  }
  return parsed;
}

function loadPromptData(roleDir, promptPath) {
  const resolvedPath = resolveImport(roleDir, promptPath);
  const data = loadYamlFile(resolvedPath);
  return {
    persona: data.persona || null,
    prompt: typeof data.prompt === 'string' ? data.prompt : '',
  };
}

function loadRules(roleDir, rulePaths) {
  return rulePaths.map((rulePath) => {
    const resolvedPath = resolveImport(roleDir, rulePath);
    return readTextFile(resolvedPath);
  });
}

function loadTools(roleDir, toolPaths) {
  return toolPaths.map((toolPath) => {
    const resolvedPath = resolveImport(roleDir, toolPath);
    const tool = loadYamlFile(resolvedPath);
    return {
      name: tool.name || path.basename(toolPath, path.extname(toolPath)),
      description: tool.description || '',
      parameters: Array.isArray(tool.parameters) ? tool.parameters : [],
    };
  });
}

function loadAgent(rolePath) {
  assertNonEmptyString(rolePath, 'rolePath');

  const resolvedRolePath = path.resolve(process.cwd(), rolePath.trim());
  if (!fs.existsSync(resolvedRolePath)) {
    throw new Error(`Role configuration not found at ${resolvedRolePath}`);
  }

  const roleConfig = loadYamlFile(resolvedRolePath);
  const roleDir = path.dirname(resolvedRolePath);

  const promptPaths = (roleConfig.imports && Array.isArray(roleConfig.imports.prompts))
    ? roleConfig.imports.prompts
    : [];
  const rulePaths = (roleConfig.imports && Array.isArray(roleConfig.imports.rules))
    ? roleConfig.imports.rules
    : [];
  const toolPaths = (roleConfig.imports && Array.isArray(roleConfig.imports.tools))
    ? roleConfig.imports.tools
    : [];

  const promptData = promptPaths.map((promptPath) => loadPromptData(roleDir, promptPath));
  const persona = promptData.find((item) => item.persona) || { persona: null, prompt: '' };
  const combinedPrompt = promptData.map((item) => item.prompt).filter(Boolean).join('\n\n');

  const rules = loadRules(roleDir, rulePaths);
  const tools = loadTools(roleDir, toolPaths);

  return {
    name: roleConfig.name || path.basename(roleDir),
    description: roleConfig.description || '',
    persona: persona.persona || null,
    prompt: combinedPrompt,
    rules,
    listTools() {
      return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));
    },
    runTool(toolName) {
      assertNonEmptyString(toolName, 'toolName');
      return {
        success: false,
        error: 'Tool execution is not available in the legacy environment.',
      };
    },
  };
}

function improvePromptStub(prompt) {
  const originalPrompt = typeof prompt === 'string' ? prompt : '';
  const refinedPrompt = originalPrompt.trim() || 'No prompt provided.';
  return { originalPrompt, refinedPrompt };
}

module.exports = {
  loadAgent,
  improvePromptStub,
};
