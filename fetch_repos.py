import json
import urllib.request
import time

repos = [
    "msitarzewski/agency-agents",
    "paperclipai/paperclip",
    "paperclipai/companies",
    "virattt/dexter",
    "openclaw/openclaw",
    "lightpanda-io/browser",
    "agentscope-ai/agentscope",
    "agentscope-ai/agentscope-samples",
    "anomalyco/opencode",
    "sst/opencode",
    "CefBoud/MonClaw",
    "badrisnarayanan/antigravity-claude-proxy",
    "router-for-me/CLIProxyAPI",
    "atharen/openclaw-plugin-opencode",
    "happycastle114/oh-my-openclaw",
    "Gen-Verse/OpenClaw-RL",
    "modelcontextprotocol/servers",
    "ComposioHQ/secure-openclaw"
]

results = []
for repo in repos:
    url = f"https://api.github.com/repos/{repo}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            res = {
                "name": data.get("full_name"),
                "description": data.get("description"),
                "stars": data.get("stargazers_count"),
                "url": data.get("html_url"),
                "topics": data.get("topics", []),
                "language": data.get("language")
            }
            results.append(res)
            print(f"Fetched {repo}")
    except urllib.error.HTTPError as e:
        print(f"HTTPError fetching {repo}: {e.code}")
        results.append({"name": repo, "error": f"HTTP {e.code}"})
    except Exception as e:
        results.append({
            "name": repo,
            "error": str(e)
        })
        print(f"Error fetching {repo}: {e}")
    time.sleep(0.5)

with open("repos_info.json", "w") as f:
    json.dump(results, f, indent=2)
