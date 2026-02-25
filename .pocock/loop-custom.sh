#!/bin/bash
#
# Pocock Custom Loop - Run any prompt in a loop
#
# Usage:
#   ./.pocock/loop-custom.sh <iterations> <prompt-file>
#
# Example:
#   ./.pocock/loop-custom.sh 10 .pocock/loops/coverage.md
#   ./.pocock/loop-custom.sh 20 .pocock/loops/entropy.md
#

set -e

cd "$(dirname "$0")/.."

if [[ -z "$1" || -z "$2" ]]; then
    echo "Usage: ./.pocock/loop-custom.sh <iterations> <prompt-file>"
    echo ""
    echo "Available prompts:"
    ls -1 .pocock/loops/*.md 2>/dev/null | sed 's/^/  /'
    exit 1
fi

MAX_ITERATIONS=$1
PROMPT_FILE=$2

if [[ ! -f "$PROMPT_FILE" ]]; then
    echo "ERROR: Prompt file not found: $PROMPT_FILE"
    exit 1
fi

echo "=========================================="
echo "Pocock Custom Loop"
echo "Max iterations: $MAX_ITERATIONS"
echo "Prompt: $PROMPT_FILE"
echo "=========================================="
echo ""

for i in $(seq 1 $MAX_ITERATIONS); do
    echo "=========================================="
    echo "ITERATION $i of $MAX_ITERATIONS"
    echo "$(date '+%Y-%m-%d %H:%M:%S')"
    echo "=========================================="

    # Get recent git context
    RECENT_COMMITS=$(git log --oneline -10 2>/dev/null || echo "No commits")

    # Build prompt with context
    PROMPT="## Recent Commits (for context)
$RECENT_COMMITS

$(cat .pocock/progress.md)

---

$(cat "$PROMPT_FILE")"

    # Run Claude and capture output
    OUTPUT=$(claude --dangerously-skip-permissions "$PROMPT" 2>&1) || true
    echo "$OUTPUT"

    # Check for completion signal
    if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
        echo ""
        echo "=========================================="
        echo "COMPLETE signal detected"
        echo "=========================================="
        break
    fi

    echo ""
    sleep 3
done

echo ""
echo "=========================================="
echo "Custom Loop - Finished"
echo "=========================================="
