#!/usr/bin/env bash
# Bridge to the Figma Dev Mode MCP server over raw Streamable-HTTP,
# for use when the in-session MCP tools fail to bind.
#   usage: figma-mcp.sh <tool_name> '<json_args>'
#   e.g.   figma-mcp.sh get_metadata '{}'
#          figma-mcp.sh get_variable_defs '{"nodeId":"1:23"}'
#          figma-mcp.sh get_design_context '{"nodeId":"1:23"}'
set -euo pipefail
ENDPOINT="http://127.0.0.1:3845/mcp"
TOOL="${1:?tool name required}"
ARGS="${2-}"
[ -n "$ARGS" ] || ARGS='{}'

hdr=(-H "Content-Type: application/json" -H "Accept: application/json, text/event-stream")

# 1. initialize -> capture session id
init_resp=$(curl -s -i -X POST "$ENDPOINT" "${hdr[@]}" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"lyra-bridge","version":"1.0.0"}}}')
SID=$(printf '%s' "$init_resp" | tr -d '\r' | awk -F': ' 'tolower($1)=="mcp-session-id"{print $2; exit}')
[ -n "$SID" ] || { echo "ERROR: no session id" >&2; printf '%s\n' "$init_resp" >&2; exit 1; }

# 2. initialized notification
curl -s -X POST "$ENDPOINT" "${hdr[@]}" -H "Mcp-Session-Id: $SID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}' >/dev/null

# 3. tools/call -> strip SSE framing, pretty-print text content
curl -s -X POST "$ENDPOINT" "${hdr[@]}" -H "Mcp-Session-Id: $SID" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"$TOOL\",\"arguments\":$ARGS}}" \
  | sed 's/^data: //' | grep '^{' \
  | python -c "import sys,json
d=json.load(sys.stdin)
r=d.get('result')
if not r:
    print(json.dumps(d,indent=2)); sys.exit(0)
for c in r.get('content',[]):
    if c.get('type')=='text': print(c['text'])
    else: print('[%s content omitted]'%c.get('type'))"
