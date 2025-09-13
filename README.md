# AI Agent Sandbox

Welcome to the AI Agent Sandbox, a repository for designing, managing, and benchmarking standardized AI agents based on a "Five Pillars" architecture.

## The Five Pillars Architecture

This project is built on a modular, configuration-driven architecture composed of five core concepts, or "pillars":

1.  **/role/**: Defines the high-level identity and capabilities of an agent. Each agent has its own directory containing a `role.yaml` file, which acts as the main entry point for loading that agent. It specifies which prompts, rules, and tools the agent uses.

2.  **/prompt/**: Contains the core persona and instruction sets for agents. These are written in YAML and define the agent's personality, tone, and primary directives.

3.  **/rule/**: Contains Markdown files that define specific behavioral guidelines, constraints, or operational rules for an agent. This allows for complex behaviors to be defined in a human-readable way.

4.  **/tool/**: Contains the definitions (`.yaml` files) for all tools available to agents. These definitions specify the tool's name, description, and execution environment, but not its implementation.

5.  **/template/**: Contains master templates for creating new components, ensuring consistency across the architecture.

## Core Engine (`app.py`)

The `app.py` script is the heart of the sandbox. It's a lightweight, dependency-free Python script that can load, parse, and preview any agent defined in the `/role/` directory.

### Usage
To load and preview an agent, run:
```bash
python app.py <path-to-role.yaml> "<user-prompt>"
```
**Example:**
```bash
python app.py role/coder-agent/role.yaml "write a hello world function in python"
```

## How to Add a New Agent

1.  **Create a Directory:** Create a new directory for your agent under `/role/`. For example, `/role/new-agent/`.

2.  **Define a Prompt (Optional):** Create a new `.yaml` file in a relevant subdirectory of `/prompt/`. Define the agent's `persona` and `prompt`.

3.  **Define Rules (Optional):** Create a new `.md` file in a relevant subdirectory of `/rule/`. Add any specific behavioral rules.

4.  **Create the Role File:** Create `role.yaml` inside your agent's directory (`/role/new-agent/role.yaml`). In this file, import the prompt, rules, and any tools the agent needs.

    ```yaml
    name: "new-agent"
    version: "1.0.0"
    description: "A description of the new agent."
    imports:
      prompts:
        - "../../prompt/path/to/your_prompt.yaml"
      rules:
        - "../../rule/path/to/your_rules.md"
      tools:
        - "../../tool/file_system/read_file.yaml"
        - "../../tool/web_search/search.yaml"
    ```

5.  **Test it:** Run `python app.py role/new-agent/role.yaml "test prompt"` to see if it loads correctly.

## How to Add a New Tool

1.  **Define the Tool:** Create a new `.yaml` file for your tool in a relevant subdirectory of `/tool/`. Use the `/template/master/tool_template.yaml` as a reference.

    ```yaml
    # In /tool/new_category/new_tool.yaml
    name: "new_tool_name"
    description: "What this new tool does."
    # ... other fields
    ```

2.  **Implement the Stub:** Open `tools/api_stubs.py` (for API tools) or `tools/core_logic.py` (for internal functions) and add a Python function stub for your new tool.

    ```python
    # In tools/core_logic.py
    def new_tool_name(*args, **kwargs):
        print(f"[TOOL EXECUTED] new_tool_name with args: {args}, {kwargs}")
        return {"status": "success", "result": "some_value"}
    ```

3.  **Register the Tool:** Open `app.py` and add your new function to the `MASTER_TOOL_MAP` dictionary.

    ```python
    # In app.py
    MASTER_TOOL_MAP = {
        # ... other tools
        "new_tool_name": new_tool_name,
    }
    ```

4.  **Add to an Agent:** Add the path to your new tool's `.yaml` file to an agent's `role.yaml` to grant it access.

## Validation

To ensure all configuration files are valid, run the validation script:
```bash
# You may need to install dependencies first: pip install pyyaml jsonschema
python validate.py
```
