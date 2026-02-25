#!/bin/bash
#
# Pocock AFK Loop - Docker Sandbox Version
# Runs Claude in an isolated Docker sandbox for truly unattended operation.
#
# PREREQUISITES:
#   - Docker Desktop 4.50+ (experimental sandboxes feature)
#   - Enable: Docker Desktop > Settings > Features in development > Enable Docker AI features
#   - First run: `docker sandbox run claude` to authenticate
#
# Usage:
#   ./.pocock/afk.sh <iterations>              # Run N iterations on any ready issues
#   ./.pocock/afk.sh <iterations> --epic <id>  # Run N iterations on an epic
#

set -e

cd "$(dirname "$0")/.."

# Check for docker sandbox support
if ! docker sandbox --help &>/dev/null; then
    echo "ERROR: 'docker sandbox' not available."
    echo ""
    echo "Docker Sandboxes requires Docker Desktop 4.50+ with AI features enabled:"
    echo "  1. Update Docker Desktop to 4.50 or later"
    echo "  2. Go to Settings > Features in development"
    echo "  3. Enable 'Docker AI features'"
    echo "  4. Restart Docker Desktop"
    echo ""
    echo "Alternatively, use ./.pocock/loop.sh for local execution."
    exit 1
fi

# Require iteration count
if [[ -z "$1" ]]; then
    echo "Usage: ./.pocock/afk.sh <iterations> [--epic <id>]"
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
echo "Pocock AFK Loop (Docker Sandbox)"
echo "Max iterations: $MAX_ITERATIONS"
echo "Issue filter: $BD_CMD"
echo "=========================================="
echo ""

trap 'rm -f /tmp/pocock_output_$$.txt' EXIT

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

    # Create temp file for output
    TMPFILE="/tmp/pocock_output_$$.txt"
    > "$TMPFILE"

    # Build inline prompt (sandbox needs all context inline)
    PROMPT="$ISSUES

## Recent Commits (for context)
$RECENT_COMMITS

$(cat .pocock/progress.md)

---

$(cat .pocock/prompt.md)"

    # Run Claude in Docker sandbox
    echo "Running Claude in Docker sandbox..."

    docker sandbox run \
        --credentials host \
        claude \
        --dangerously-skip-permissions \
        "$PROMPT" \
        2>&1 | tee "$TMPFILE"

    # Check for completion signal
    if grep -q "<promise>COMPLETE</promise>" "$TMPFILE" 2>/dev/null; then
        echo ""
        echo "=========================================="
        echo "COMPLETE signal detected - all issues done"
        echo "=========================================="
        rm -f "$TMPFILE"
        break
    fi

    rm -f "$TMPFILE"
    echo ""
    sleep 3
done

echo ""
echo "=========================================="
echo "Pocock AFK Loop - Finished"
echo "=========================================="
bd stats 2>/dev/null || true
