# 🤖 AI Agent Sandbox

Welcome to the AI Agent Sandbox, a repository for designing, managing, and benchmarking standardized AI agents.

## 哲学 (Philosophy)

This project operates on a **"Convention over Configuration"** principle. An agent's capabilities and identity are defined by the structure of its folder within the `/role` directory, rather than a single, complex configuration file. This approach promotes modularity, clarity, and scalability.

## 📂 Directory Structure

- **`/_common`**: A library of reusable resources (Tools, Rules, Docs) that can be shared across multiple agent roles. This is the foundation of our DRY (Don't Repeat Yourself) approach.
- **`/role`**: Contains a directory for each specialized agent. Each folder *is* an agent, defined by the configuration files within it.
- **`README.md`**: You are here.

## ✨ How to Create a New Agent

1.  Create a new sub-directory under `/role` (e.g., `/role/new-agent-name/`).
2.  Inside the new directory, create the standard definition files: `models.yaml`, `prompt.yaml`, `rules.yaml`, and `tools.yaml`.
3.  In the agent's definition files, `import` the required resources from the `/_common` directory.
4.  Add any role-specific configurations needed.
5.  Write a `README.md` for the new agent to describe its purpose.

This structured approach allows us to easily test different AI models against the same role definition, enabling effective benchmarking and continuous improvement.
