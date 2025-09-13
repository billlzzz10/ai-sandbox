#!/usr/bin/env python3
import sys, os, re
from typing import Any, Dict, List, Optional, Callable

# ---- Tool Implementations (Stubs) ----
from tools.core_logic import *
from tools.api_stubs import *
from tools.standard_tools import * # Import the new standard tool stubs

# Master map to link tool names to their functions
MASTER_TOOL_MAP: Dict[str, Callable[..., Any]] = {
    # Core Memory Tools
    "prompt_cache": prompt_cache,
    "file_manager": file_manager,
    "user_profile_manager": user_profile_manager,
    # AI Tutor Tools
    "create_learning_plan": create_learning_plan,
    "find_analogy": find_analogy,
    "generate_quiz": generate_quiz,
    "evaluate_answer": evaluate_answer,
    # GPT Actions Tools
    "write_python": write_python,
    "write_typescript": write_typescript,
    "refactor_code": refactor_code,
    "read_code": read_code,
    "fix_github_actions": fix_github_actions,
    "commit_message_thai": commit_message_thai,
    "deep_research": deep_research,
    "create_mind_map": create_mind_map,
    "memory_store": memory_store,
    "think_deeper": think_deeper,
    "web_search": web_search,
    # Standard Tools from original agents
    "read_file": read_file,
    "write_file": write_file,
    "delete_file": delete_file,
    "execute_code": execute_code,
    "open_in_vscode": open_in_vscode,
    "search": search,
}


# ---- YAML Loader ----
def _yaml_load(text: str) -> Dict[str, Any]:
    try:
        import yaml
        return yaml.safe_load(text) or {}
    except Exception:
        print("Warning: PyYAML not found or failed. Using a minimal fallback parser.", file=sys.stderr)
        data: Dict[str, Any] = {}
        cur_key = None
        for line in text.splitlines():
            if not line.strip() or line.strip().startswith("#"): continue
            if re.match(r"^\s*-\s+", line):
                if cur_key is None: raise ValueError("List item without key")
                data.setdefault(cur_key, []).append(line.strip()[2:].strip())
            elif ":" in line:
                k, v = line.split(":", 1)
                k, v = k.strip(), v.strip()
                if v == "":
                    cur_key = k
                    data[k] = []
                else:
                    cur_key = k
                    data[k] = re.sub(r'^[\'"]|[\'"]$', "", v)
        return data

def load_yaml_file(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return _yaml_load(f.read())

def load_text_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

# ---- Models ----
class Tool:
    def __init__(self, name: str, spec: Dict[str, Any], implementation: Optional[Callable[..., Any]] = None):
        self.name = name
        self.spec = spec
        self.implementation = implementation

    @property
    def description(self) -> str:
        return self.spec.get("description", "")

class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, Tool] = {}

    def register(self, tool: Tool):
        self._tools[tool.name] = tool

    def get_tool(self, name: str) -> Optional[Tool]:
        return self._tools.get(name)

    def get_all_tools(self) -> List[Tool]:
        return list(self._tools.values())

class Agent:
    def __init__(self, name: str, description: str, persona: Optional[Dict[str, Any]], rules: List[str], tool_specs: List[Dict[str, Any]]):
        self.name = name
        self.description = description
        self.persona = persona or {}
        self.rules = rules
        self.tools = ToolRegistry()
        for spec in tool_specs:
            tool_name = spec.get("name")
            if not tool_name:
                continue
            implementation = MASTER_TOOL_MAP.get(tool_name)
            if implementation is None:
                print(f"Warning: No implementation found for tool '{tool_name}'.", file=sys.stderr)

            self.tools.register(Tool(name=tool_name, spec=spec, implementation=implementation))

    def run_tool(self, tool_name: str, *args, **kwargs) -> Any:
        tool = self.tools.get_tool(tool_name)
        if not tool:
            return f"Error: Tool '{tool_name}' not found in agent's registry."
        if not tool.implementation:
            return f"Error: Tool '{tool_name}' has no implementation."

        print(f"\n--- Running Tool: {tool_name} ---")
        try:
            result = tool.implementation(*args, **kwargs)
            print(f"--- Tool '{tool_name}' Finished ---")
            return result
        except Exception as e:
            return f"Error executing tool '{tool_name}': {e}"

# ---- Loader ----
def resolve_path(base_file: str, rel: str) -> str:
    base_dir = os.path.dirname(base_file)
    abs_path = os.path.normpath(os.path.join(base_dir, rel))
    if not os.path.exists(abs_path):
        raise FileNotFoundError(f"Missing import: {rel} -> {abs_path}")
    return abs_path

def load_agent(role_file: str) -> Agent:
    role = load_yaml_file(role_file)
    name = role.get("name") or os.path.basename(os.path.dirname(role_file))
    description = role.get("description", "")
    imports = role.get("imports", {})

    persona = None
    for p in imports.get("prompts", []) or []:
        pfile = resolve_path(role_file, p)
        pdoc = load_yaml_file(pfile)
        persona = pdoc.get("persona", persona)

    rule_bodies: List[str] = []
    for r in imports.get("rules", []) or []:
        rfile = resolve_path(role_file, r)
        rule_bodies.append(load_text_file(rfile))

    tool_specs: List[Dict[str, Any]] = []
    for t in imports.get("tools", []) or []:
        tfile = resolve_path(role_file, t)
        tool_specs.append(load_yaml_file(tfile))

    return Agent(name=name, description=description, persona=persona, rules=rule_bodies, tool_specs=tool_specs)

# ---- Runtime Preview ----
def preview_agent(agent: Agent) -> None:
    print(f"Agent: {agent.name}")
    if agent.description:
        print(f"Description: {agent.description}")
    if agent.persona:
        role = agent.persona.get("role")
        print(f"Persona.role: {role}" if role else "Persona: defined")

    print("\nLoaded Rules:", len(agent.rules))
    print("Loaded Tools:", len(agent.tools.get_all_tools()))

    for i, tool in enumerate(agent.tools.get_all_tools(), 1):
        spec = tool.spec
        tname = tool.name
        tdesc = tool.description
        env = (spec.get("execution_environment") or {}).get("type", "n/a")
        policy = spec.get("execution_policy", {})
        default_mode = policy.get("default_mode", "n/a")
        status = "✅" if tool.implementation else "❌"
        print(f"  [{i}] {status} {tname}  ({env}, default_mode={default_mode})  - {tdesc}")

def improve_prompt_stub(raw_prompt: str) -> str:
    """
    A placeholder function to simulate the Prompt Improvement Assistant's logic.
    """
    print("\n--- Running Prompt Improvement Assistant (Stub) ---")
    print(f"Original Prompt: '{raw_prompt}'")
    # In a real scenario, this would involve an LLM call to the prompt-improver agent.
    refined_prompt = f"As an expert, provide a detailed answer for the following, including examples: '{raw_prompt}' [REFINED]"
    print(f"Refined Prompt: '{refined_prompt}'")
    print("--- Prompt Improvement Finished ---\n")
    return refined_prompt

def main():
    if len(sys.argv) < 3:
        print("usage: python app.py <path-to-role.yaml> \"<raw-user-prompt>\"")
        sys.exit(1)

    role_file = sys.argv[1]
    user_prompt = sys.argv[2]

    # --- 1. Pre-processing Step with Prompt Improver ---
    refined_prompt = improve_prompt_stub(user_prompt)

    # --- 2. Load and run the main agent ---
    print(f"--- Loading Main Agent from: {role_file} ---")
    try:
        agent = load_agent(role_file)
        preview_agent(agent)
        print(f"\n✅ SUCCESS: Core Engine is ready to run agent '{agent.name}' with the refined prompt.")
    except Exception as e:
        print(f"\n--- ❌ Error loading agent from '{role_file}' ---", file=sys.stderr)
        print(e, file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
