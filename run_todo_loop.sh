#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/root/storemate_pos"
TODO_FILE="$REPO_DIR/To-Do.md"
PLAN_FILE="$REPO_DIR/IMPLEMENTATION_PLAN.md"

if [[ ! -f "$TODO_FILE" ]]; then
  echo "Error: $TODO_FILE not found." >&2
  exit 1
fi

echo "=== Starting StoreMate POS Task Loop (Hermes Orchestrator -> OpenCode Coder) ==="

while grep -q '^- \[ \]' "$TODO_FILE"; do
  line=$(grep -m 1 '^- \[ \]' "$TODO_FILE")
  task=$(echo "$line" | sed 's/^- \[ \] //')

  echo ""
  echo "=================================================="
  echo "▶ Processing feature: $task"
  echo "=================================================="

  # 1. Hermes: Draft Plan
  echo "--- Step 1: Hermes drafting implementation plan ---"
  hermes -z "Draft a comprehensive implementation plan for feature: '${task}' in StoreMate POS. Inspect existing files, define schemas, API endpoints, and UI components. Write the plan to '$PLAN_FILE'." --yolo --in "$REPO_DIR"

  if [[ ! -f "$PLAN_FILE" ]]; then
    echo "Warning: Plan file not created, creating default plan outline."
    echo "# Plan: ${task}" > "$PLAN_FILE"
  fi

  # 2. Delegate to OpenCode: Execute Plan
  echo "--- Step 2: OpenCode executing implementation plan ---"
  opencode run "Read '$PLAN_FILE' and execute the complete implementation of '${task}' in StoreMate POS. Make all necessary code, database, and UI changes according to the plan." --dir "$REPO_DIR" --auto

  # 3. Verify
  echo "--- Step 3: Verifying implementation ---"
  if ! npm --prefix "$REPO_DIR" run build; then
    echo "Build failed. OpenCode fixing build errors..."
    opencode run "Build failed after implementing '${task}' in StoreMate POS. Run 'npm run build', diagnose and fix all build/type errors until the build succeeds." --dir "$REPO_DIR" --auto
  fi

  # 4. Hermes: Final verification and update To-Do list
  echo "--- Step 4: Hermes verifying and updating To-Do ---"
  hermes -z "Verify that feature '${task}' in StoreMate POS is implemented and the build passes. Once verified, update '$TODO_FILE' by marking '- [x] ${task}'. Do not modify other lines." --yolo --in "$REPO_DIR"

  # Safety check
  if grep -qF -- "- [x] $task" "$TODO_FILE"; then
    echo "✔ Successfully completed and verified: $task"
    rm -f "$PLAN_FILE"
  else
    echo "✖ Failed: task '$task' was not marked completed in $TODO_FILE. Stopping loop." >&2
    exit 1
  fi
done

echo ""
echo "=== All tasks in $TODO_FILE completed! ==="
