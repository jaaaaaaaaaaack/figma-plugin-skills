<p align="center">
  <img src=".github/repo-header.png" alt="Figma Plugin API skill — agent skills & resources for developing Figma plugins & widgets with less drama" width="100%">
</p>

# figma-plugin-skills

A skill that teaches AI coding assistants (GitHub Copilot, Claude Code, and other agent-mode tools) how to build, modify, and debug **Figma plugins, widgets, and Dev Mode extensions**. Aimed at designers who code — concrete examples over abstract API descriptions, one small step at a time, real file changes instead of pseudocode.

The repo contains one skill, `figma-plugin-development/`, with:

- `SKILL.md` — routing logic (plugin vs widget vs Dev Mode), six top-mistakes list, and team-context notes.
- `references/` — searchable reference docs for the Plugin API, Widget API, UI/messaging, setup/publishing, and Dev Mode/codegen.
- `assets/starter-plugin/` and `assets/starter-widget/` — minimal copy-and-run scaffolds.


# Installation tutorial:
## https://screen.studio/share/CD2rFvuU

---

## Before you start

You need:

- **macOS** (these instructions are Mac-specific).
- **VS Code** with the GitHub Copilot extension installed and signed in.
- **Agent mode enabled** in Copilot (Cmd+Shift+P → "Chat: Open Chat" → switch the mode dropdown to **Agent**). Agent skills only load in agent mode.
- **Git** installed. To check: open Terminal (Spotlight: ⌘+Space, type "Terminal", Enter) and run `git --version`. If you see "command not found", install it by running `xcode-select --install` and following the prompt.

---

## Decide: global install or project install?

There are two ways to install this skill. Pick based on who needs it.

| | **Global install** | **Project install** |
|---|---|---|
| Where it lives | Your home folder (`~/.copilot/skills/`) | Inside a specific repo (`.github/skills/`) |
| Who gets it | Just you, in every VS Code workspace you open | Everyone who clones that repo |
| Best for | Personal use across many side projects | A team plugin repo where everyone should have the same knowledge |
| Updates | You re-run the install command | A git pull on the repo |
| Committed to git? | No (lives outside any repo) | Yes (lives in the repo) |

**Default recommendation:** Install **globally** if you're the only one on your team writing plugins, or if you want the skill available the moment you open any Figma-plugin repo. Install at **project level** if your design team has a shared plugin repo and you want everyone to get this skill automatically the moment they clone.

You can do both — they don't conflict.

---


## Option A — Install globally (recommended for individuals)

This puts the skill in `~/.copilot/skills/figma-plugin-development/`. VS Code's Copilot auto-discovers it on every workspace.

### 1. Open Terminal

Press ⌘+Space, type `Terminal`, press Enter.

### 2. Run this block

Copy the whole block, paste it into Terminal, press Enter. It creates the skills folder if it doesn't exist, downloads this repo, and copies just the skill folder into place.

```bash
mkdir -p ~/.copilot/skills
git clone --depth 1 https://github.com/jaaaaaaaaaaack/figma-plugin-skills.git /tmp/figma-plugin-skills
rm -rf ~/.copilot/skills/figma-plugin-development
mv /tmp/figma-plugin-skills/figma-plugin-development ~/.copilot/skills/
rm -rf /tmp/figma-plugin-skills
echo "✓ Installed to ~/.copilot/skills/figma-plugin-development"
```

If you'd rather have it work across **both** GitHub Copilot **and** Claude Code from the same location, install into `~/.claude/skills/` instead — Copilot reads from there too:

```bash
mkdir -p ~/.claude/skills
git clone --depth 1 https://github.com/jaaaaaaaaaaack/figma-plugin-skills.git /tmp/figma-plugin-skills
rm -rf ~/.claude/skills/figma-plugin-development
mv /tmp/figma-plugin-skills/figma-plugin-development ~/.claude/skills/
rm -rf /tmp/figma-plugin-skills
echo "✓ Installed to ~/.claude/skills/figma-plugin-development"
```

### 3. Reload VS Code

In VS Code, press ⌘+Shift+P, type **Developer: Reload Window**, press Enter. Copilot scans skills directories on startup, so the reload is what makes the new skill visible.

---

## Option B — Install for a specific project (recommended for teams)

This commits the skill into a repo, so anyone who clones that repo gets it automatically.

### 1. Open Terminal and `cd` into your project

```bash
cd ~/path/to/your-plugin-repo
```

(Replace with the real path. Tip: in Finder, you can right-click a folder and "Copy as Pathname" while holding ⌥ Option.)

### 2. Add the skill

```bash
mkdir -p .github/skills
git clone --depth 1 https://github.com/jaaaaaaaaaaack/figma-plugin-skills.git /tmp/figma-plugin-skills
rm -rf .github/skills/figma-plugin-development
mv /tmp/figma-plugin-skills/figma-plugin-development .github/skills/
rm -rf /tmp/figma-plugin-skills
echo "✓ Installed to $(pwd)/.github/skills/figma-plugin-development"
```

### 3. Commit it

```bash
git add .github/skills/figma-plugin-development
git commit -m "Add figma-plugin-development agent skill"
git push
```

Now anyone on the team who clones the repo and opens it in VS Code will get the skill automatically (after their own VS Code reload).

### Why `.github/skills/` and not another folder?

GitHub Copilot in VS Code searches three project locations: `.github/skills/`, `.claude/skills/`, and `.agents/skills/`. They all work, but they have different trade-offs:

- **`.github/skills/`** — Copilot-native, sits next to other GitHub conventions like `.github/workflows/`. Best when the project is Copilot-first.
- **`.claude/skills/`** — Picked up by both Copilot and Claude Code. Best for mixed-tool teams.
- **`.agents/skills/`** — Tool-neutral convention picked up by most agent CLIs. Best when you want maximum portability.

Default to `.github/skills/` unless someone on the team uses Claude Code (in which case use `.claude/skills/`).

---

## Verify the install worked

In VS Code:

1. Open Copilot Chat (⌘+Ctrl+I, or the chat icon in the sidebar).
2. Make sure the mode dropdown says **Agent**.
3. Ask: *"Do you have a figma-plugin-development skill available? If so, what's it for?"*

If the install worked, Copilot will name the skill and summarise it. If it doesn't, double-check:

- The path: `~/.copilot/skills/figma-plugin-development/SKILL.md` should exist. Run `ls ~/.copilot/skills/figma-plugin-development/SKILL.md` in Terminal.
- VS Code was reloaded after the install (⌘+Shift+P → Developer: Reload Window).
- You're in **Agent** mode, not Ask or Edit mode.

---

## Updating later

The install commands above are idempotent — they remove the existing folder before copying the new version. To update, just re-run the same block from Option A (global) or Option B (project), then reload VS Code.

---

## Using the skill in other tools

The same skill works in other agent tools without modification:

| Tool | Location |
|---|---|
| **GitHub Copilot in VS Code** | `~/.copilot/skills/` or any of `.github/skills/`, `.claude/skills/`, `.agents/skills/` in a repo |
| **GitHub Copilot CLI** | Same paths as VS Code |
| **Claude Code** | `~/.claude/skills/` (global) or `.claude/skills/` (project) |
| **Codex CLI / Cursor / other agent tools** | Most read from `~/.agents/skills/` or the `.agents/skills/` project folder |

If you use more than one tool, the cleanest setup is to install once into `~/.claude/skills/` — VS Code Copilot, Claude Code, and most other agent CLIs all read from there.

---

## What the skill assumes about your team

The skill is calibrated for the **Belong design team** — specifically, it knows the team does not have access to the Figma MCP server. This doesn't block plugin development (the Plugin API runs inside Figma desktop, not via MCP), but it changes how the agent suggests workflows. See `figma-plugin-development/SKILL.md` § "Belong design team context" for the full note. If you're outside Belong, that section is safe to ignore — it's surfaced to the agent, not enforced.

---

## Troubleshooting

**Copilot doesn't see the skill after install**
→ Reload VS Code (⌘+Shift+P → Developer: Reload Window). Check you're in **Agent** mode.

**`git: command not found`**
→ Install Apple's command line tools: `xcode-select --install`, then re-run.

**"Permission denied" when running the install commands**
→ Don't use `sudo`. The skills directory lives in your home folder, which is yours to write to. If you get this error, you've probably mistyped the path — copy-paste the block as-is.

**Can't see `~/.copilot/` or `~/.claude/` in Finder**
→ They're hidden (dot-prefixed). In Finder, press ⌘+Shift+. (period) to toggle hidden files. Or in any Finder window, press ⌘+Shift+G and type `~/.copilot/skills/` to jump straight there.
