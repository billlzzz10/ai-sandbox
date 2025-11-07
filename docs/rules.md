---
title: AI Sandbox Framework Rules
version: 1.0
description: Strict conventions to enforce consistency, security, and scalability. Separate from the 5 Pillars (Role, Prompt, Rule, Tool, Template). Violations auto-fail via linters/validators.
---

# Framework Rules

These rules define the enforced structure and style for all configurations, code, and workflows in AI Sandbox. They ensure modularity and predictability, akin to Cursor's standards. 

Use `npm run validate --rules` to check compliance. Contribute by proposing additions via issues.

| Category          | Rule                                                                 | Example                                                                 | Rationale                                                                 |
|-------------------|----------------------------------------------------------------------|-------------------------------------------------------------------------|---------------------------------------------------------------------------|
| **Naming Convention** | All YAML keys: lowercase_with_underscores (snake_case). JS functions: camelCase. File names: kebab-case (e.g., agent-role.yaml). No abbreviations unless standard (e.g., api_key). | YAML: `agent_role: "Developer"`<br>JS: `function loadAgentConfig()`<br>File: `tool-file-system.js` | Ensures scannability and IDE autocomplete. Reduces errors from inconsistent naming, making grep/refactor 10x faster – core to Cursor's clean ecosystem. |
| **Formatting**    | YAML: 2-space indent, no trailing commas. Markdown: # for H1 only, bullet lists for steps. JSON logs: {level, message, timestamp: ISO string}. Use Prettier for auto-format. | YAML:<br>```yaml<br>agent:<br>  role: "AI Assistant"<br>  description: "Handles queries"<br>```<br>Log: `{"level":"info","message":"Agent loaded","timestamp":"2025-11-07T07:46:00Z"}` | Promotes readability across devices (e.g., mobile diffs). Aligns with YAML/JSON standards to prevent parse errors; Cursor uses this for seamless collab. |
| **Mandatory Fields** | Every YAML file must start with `version: 1.0` (top-level) and `description` (string, <200 chars). Tools must have `input_schema` (JSON Schema format). | ```yaml<br>version: 1.0<br>description: "Config for coder agent"<br>agent:<br>  role: "Coder"<br>``` | Provides versioning for backward compat and quick context. Prevents incomplete configs from runtime fails; builds user trust like Cursor's required props. |
| **Security Baseline** | Sanitize all inputs with validator.js (escape HTML/JS). No hardcoded secrets (use env vars). Tools must reject non-JSON inputs. | JS: `const sanitized = validator.escape(input);`<br>YAML: `api_key: ${process.env.OPENAI_API_KEY}` | Mitigates injection/XSS risks in agent execution. Essential for production safety; Cursor enforces this to protect user data in AI workflows. |
| **Error Handling** | Throw custom errors: `new Error('AI_SANDBOX: [context] [message]')` with full stack trace. Log all errors in JSON format. No silent fails – always retry once. | JS: `throw new Error('AI_SANDBOX: Tool execution [file_read] failed: Permission denied');` | Unified debugging across logs/tools. Enables quick triage (e.g., search "AI_SANDBOX"); matches Cursor's robust error surfaces for reliable iteration. |
| **Performance Guard** | Tools: timeout 30s max (use Promise.race). Cache responses >5s (in-memory or Redis). Limit concurrent calls to 5. | JS: `const result = await Promise.race([toolFn(), timeout(30000)]);`<br>Cache: `if (cache.has(key)) return cache.get(key);` | Prevents hangs/resource exhaustion in long-running agents. Ensures fast feedback loops; Cursor prioritizes this for real-time coding experiences. |

## Enforcement Tools
- **Linters**: ESLint + yamllint + Prettier (run via `npm run lint`).
- **Validator**: Extended `validate.js` checks all rules on load.
- **Hooks**: Husky pre-commit auto-enforces.

For questions, see [Troubleshooting](/docs/troubleshooting.md). Update this doc via PRs following these rules!

---
*Last updated: 2025-11-07*