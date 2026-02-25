# Pocock Loop

A streamlined autonomous issue processor inspired by [Matt Pocock's approach](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum).

## Philosophy

1. **Simple over complex** - The prompt is ~100 lines, not 400
2. **Learnings persist** - Each iteration leaves notes for the next
3. **Context via commits** - Recent git history provides awareness
4. **One issue, one commit** - Focused, atomic changes
5. **Fight entropy** - Leave the codebase better than you found it

## Files

| File             | Purpose                                               |
| ---------------- | ----------------------------------------------------- |
| `prompt.md`      | Main instructions (minimal, focused)                  |
| `progress.md`    | Rolling context - learnings, roadblocks, decisions    |
| `once.sh`        | Run single iteration                                  |
| `loop.sh`        | Run multiple iterations locally                       |
| `loop-custom.sh` | Run alternative prompts in a loop                     |
| `afk.sh`         | Run in Docker sandbox (requires Docker Desktop 4.50+) |
| `loops/`         | Alternative loop prompts                              |

## Usage

### Single iteration

```bash
./.pocock/once.sh
./.pocock/once.sh --epic Beaver-Bathroom-a2h
```

### Multiple iterations (local)

```bash
./.pocock/loop.sh 10
./.pocock/loop.sh 5 --epic Beaver-Bathroom-a2h
```

### Alternative loops

```bash
# Polish loop - focus on juice and feel
./.pocock/loop-custom.sh 10 .pocock/loops/polish.md
```

### AFK mode (Docker sandbox)

**Requires Docker Desktop 4.50+** with AI features enabled.

```bash
./.pocock/afk.sh 20
./.pocock/afk.sh 10 --epic Beaver-Bathroom-a2h
```

## Current Epic

The main epic for this project is `Beaver-Bathroom-a2h` with these child issues:

- `Beaver-Bathroom-a2h.1` - Visual Art Style Overhaul
- `Beaver-Bathroom-a2h.2` - Gameplay Mechanics Deep Dive
- `Beaver-Bathroom-a2h.3` - Sound & Music Design
- `Beaver-Bathroom-a2h.4` - Story & Theme Enhancement
- `Beaver-Bathroom-a2h.5` - Polish & Juice

## Task Prioritization

The agent chooses tasks based on this priority:

1. **Architectural decisions** - Core abstractions, patterns
2. **Integration points** - Where modules connect
3. **Unknown unknowns** - Spike work, risky experiments
4. **Standard features** - Normal implementation
5. **Polish/quick wins** - Easy stuff last

Fail fast on risky work. Save easy wins for later.
