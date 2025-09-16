'use strict';

const coreLogic = require('./coreLogic');
const apiStubs = require('./apiStubs');
const standardTools = require('./standardTools');

const MASTER_TOOL_MAP = {
  // Core Memory Tools
  prompt_cache: coreLogic.prompt_cache,
  file_manager: coreLogic.file_manager,
  user_profile_manager: coreLogic.user_profile_manager,
  // AI Tutor Tools
  create_learning_plan: coreLogic.create_learning_plan,
  find_analogy: coreLogic.find_analogy,
  generate_quiz: coreLogic.generate_quiz,
  evaluate_answer: coreLogic.evaluate_answer,
  // GPT Actions Tools
  write_python: apiStubs.write_python,
  write_typescript: apiStubs.write_typescript,
  refactor_code: apiStubs.refactor_code,
  read_code: apiStubs.read_code,
  fix_github_actions: apiStubs.fix_github_actions,
  commit_message_thai: apiStubs.commit_message_thai,
  deep_research: apiStubs.deep_research,
  create_mind_map: apiStubs.create_mind_map,
  memory_store: apiStubs.memory_store,
  think_deeper: apiStubs.think_deeper,
  web_search: apiStubs.web_search,
  // Standard Tools
  read_file: standardTools.read_file,
  write_file: standardTools.write_file,
  delete_file: standardTools.delete_file,
  execute_code: standardTools.execute_code,
  open_in_vscode: standardTools.open_in_vscode,
  search: standardTools.search
};

module.exports = {
  MASTER_TOOL_MAP
};
