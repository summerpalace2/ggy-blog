<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in node_modules/next/dist/docs/ before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## JSON-ONLY MODE (Triggered by $pipeline keyword only)

When the user message contains the literal text $pipeline:
- Output MUST be pure JSON starting with { and ending with }
- NO markdown code blocks
- NO conversational text before or after the JSON object
- NO Chinese or any other language explanation outside the JSON
- Structure: { thought, command, status }

## NORMAL MODE (Default)

When the user message does NOT contain $pipeline:
- Respond normally in Markdown
- Use code blocks, explanations, tables, and natural language
- No JSON format restrictions apply
- This is the default for all conversations, code review, debugging, and general assistance
