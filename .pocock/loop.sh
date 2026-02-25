#!/bin/bash
#
# Pocock Loop - Iterative Issue Processing
# Inspired by Matt Pocock's approach - simple, focused, learning-driven
#
# Usage:
#   ./.pocock/loop.sh <iterations>              # Run N iterations on any ready issues
#   ./.pocock/loop.sh <iterations> --epic <id>  # Run N iterations on an epic
#
# Example:
#   ./.pocock/loop.sh 10                        # Process up to 10 issues
#   ./.pocock/loop.sh 5 --epic Beaver-Bathroom-a2h  # Process 5 issues from the polish epic
#

set -e

cd "$(dirname "$0")/.."

# Require iteration count
if [[ -z "$1" ]]; then
    echo "Usage: ./.pocock/loop.sh <iterations> [--epic <id>]"
    exit 1
fi

MAX_ITERATIONS=$1
shift

# Parse optional epic filter
EPIC_FILTER=""
BD_CMD="bd ready"
while [[ $# -gt 0 ]]; do
    case $1 in
        --epic|-e)
            EPIC_FILTER="$2"
            BD_CMD="bd ready --parent $2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

echo "=========================================="
echo "Pocock Loop - Starting"
echo "Max iterations: $MAX_ITERATIONS"
echo "Issue filter: $BD_CMD"
echo "=========================================="
echo ""

for i in $(seq 1 $MAX_ITERATIONS); do
    echo "=========================================="
    echo "ITERATION $i of $MAX_ITERATIONS"
    echo "$(date '+%Y-%m-%d %H:%M:%S')"
    echo "=========================================="

    # Get ready issues from Beads
    ISSUES=$($BD_CMD 2>/dev/null || echo "")

    if [[ -z "$ISSUES" ]]; then
        echo "No issues found - scope complete"
        break
    fi

    # Get recent git context
    RECENT_COMMITS=$(git log --oneline -10 2>/dev/null || echo "No commits")

    # Build prompt
    PROMPT="$ISSUES

## Recent Commits (for context)
$RECENT_COMMITS

@.pocock/progress.md @.pocock/prompt.md"

    # Run Claude and capture output
    OUTPUT=$(claude --dangerously-skip-permissions "$PROMPT" 2>&1) || true
    echo "$OUTPUT"

    # Check for completion signal
    if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
        echo ""
        echo "=========================================="
        echo "COMPLETE signal detected - all issues done"
        echo "=========================================="
        break
    fi

    echo ""
    sleep 3
done

echo ""
echo "=========================================="
echo "Pocock Loop - Finished"
echo "=========================================="
bd stats 2>/dev/null || true
