# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**Assisted MindFlow** - An AI-assisted workflow and productivity system.

## Project Status

- **Version Control**: Git repository
- **Platform**: Multiplatform (Windows/Linux)
- **Working Directory**: E:\Projects\github\Assisted MindFlow

## Development Rules

### 0. CORE PRINCIPLES

**0.1. ALWAYS CHECK EXISTING CODE/DOCS/SCRIPTS FIRST**:
   - **BEFORE creating ANY new file** (code, test, script, doc), ALWAYS search for existing ones
   - Use Glob, Grep, or Read to check if similar functionality already exists
   - If it exists, UPDATE/IMPROVE it instead of creating duplicates
   - This applies to: source files, test files, scripts, documentation
   - Creating duplicates wastes time and creates confusion
   - **VIOLATION OF THIS RULE = MAJOR ERROR**

### 1. NO HARDCODED CODE

- No hardcoded paths, keys, or mock implementations without explicit authorization via GitHub issue
- All configuration must use config files or command-line arguments with reasonable defaults
- **ALLOWED**: Default values in constructors and config getters
- **ALLOWED**: Sensible default parameters for algorithms
- **FORBIDDEN**: Hardcoded values that cannot be overridden via configuration
- No simulation code without prior approval

### 2. NO SIMULATION OR PLACEHOLDER CODE

- Implement actual working functionality, not stubs or TODOs
- If a feature cannot be fully implemented, explain why rather than creating placeholders
- All code must be functional and tested
- NO DEMO MODE - strictly forbidden
- NO SIMPLE APPROACHES to circumvent requirements
- Must implement real integration, not workarounds

**⚠️ ALWAYS TEST BEFORE CLAIMING SUCCESS ⚠️**:
- **NEVER say code works without ACTUALLY TESTING IT**
- **MUST show REAL output from REAL tests**
- **If server doesn't start, DON'T claim it's implemented**
- **If you can't show test results, DON'T claim success**
- **VIOLATION = MAJOR FAILURE (creates false hope)**
- **Say "NOT TESTED" if you haven't run it**

### 3. PROJECT ORGANIZATION

**MINIMAL ROOT FILES**: Keep ABSOLUTE MINIMUM files at project root
- Only essential scripts: build.bat/.sh, test.bat/.sh, README.md, LICENSE
- ALL other files must go in appropriate subdirectories:
  - Tests go in `tests/` directory
  - Docs go in `docs/` directory
  - Temporary scripts go in `scripts/` or `workbench/`
  - Source code in `src/` or appropriate module directories
- **NEVER create new files at root unless explicitly requested**
- Ensure project structure is clear and easy to navigate

### 4. TEMPORARY/TEST MATERIALS

- All test datasets, benchmark scripts, logs, and temporary files go in `./workbench/`
- The `workbench/` directory is git-ignored and not included in releases
- Never commit test data or temporary files to the main source tree

### 5. DOCUMENTATION

- All documentation must be clear, versioned, and stored in `/docs/`
- Use Markdown for text docs
- Documentation must be updated with each feature implementation
- Keep documentation concise and practical

### 6. TESTING

- Unit tests in `tests/` directory
- Minimum 80% code coverage target
- Run tests before any merge
- All tests must be automated and reproducible

### 7. CODE REVIEW

- All code must be reviewed before merge
- At least 1 approval required
- Follow project coding standards

### 8. MULTIPLATFORM SUPPORT

- ALL code MUST work on both Windows and Linux
- Use platform-specific directives when needed (#ifdef _WIN32)
- Test on both platforms before claiming code works
- Handle path separators appropriately (\ for Windows, / for Linux)

### 9. NO UNAUTHORIZED FILES

- **DO NOT CREATE** documentation files (.md, .txt, README, etc.) without explicit authorization
- **DO NOT CREATE** batch files (.bat), shell scripts (.sh), or test scripts without explicit authorization
- **DO NOT CREATE** any automation or helper scripts without explicit authorization
- Only modify existing files or create code files that are part of the implementation

## Project Structure

```
Assisted MindFlow/
├─ src/              # Source code
├─ tests/            # Unit and integration tests
├─ docs/             # Documentation
├─ scripts/          # Build and utility scripts
├─ workbench/        # TEMPORARY: test data, experiments (git-ignored)
├─ .gitignore        # Git ignore rules
├─ CLAUDE.md         # This file
├─ README.md         # Project documentation
└─ LICENSE           # License file
```

## Development Best Practices

### Communication Style
- Be concise and direct
- Show results with actual test output
- No assumptions - verify everything
- If something doesn't work, explain why and fix it

### Code Implementation
1. **NO DEMOS EVER**: Always implement REAL functionality
2. **Interface Design**: Simple but complete - no missing features
3. **Step-by-Step Approach**: Break complex tasks into smaller steps
4. **Error Handling**: Proper error handling and logging

### Testing and Validation
- **ALWAYS TEST BEFORE CLAIMING IT WORKS**
- Show logs and output
- Verify functionality works as expected
- Performance metrics when applicable

### Problem Resolution
- When something fails, understand the root cause
- Don't try the same approach repeatedly
- Fix issues properly, not with workarounds
- No feature disabling to "fix" problems

## Git Workflow

- Use meaningful commit messages
- Keep commits focused and atomic
- Branch naming: feature/*, bugfix/*, hotfix/*
- Always pull before pushing
- Never force push to main/master

## Notes

When implementing features:
- Always check existing code patterns first
- Follow language-specific best practices
- Optimize for maintainability and clarity
- Document complex logic and design decisions
