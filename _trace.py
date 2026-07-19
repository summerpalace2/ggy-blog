# Trace table logic

# After creation: | A | B | C |
md = "| A | B | C |\n| --- | --- | --- |\n|   |   |   |"
print("=== Created ===")
print(md)
print()

# Parse
lines = md.split("\n")
for l in lines:
    parts = l.split("|")
    filtered = [p.strip() for p in parts[1:-1]]
    print(f"  {l!r} -> {filtered}")

print()
print("=== User types 'hello' in cell (0,0) ===")
# syncToMarkdown reads DOM, gets:
headers = ["A", "B", "C"]
rowTexts = [["hello", "", ""]]
aligns = ["left", "left", "left"]

headerStr = "| " + " | ".join(headers) + " |"
sepParts = []
for a in aligns:
    if a == "center": sepParts.append(" :---: ")
    elif a == "right": sepParts.append(" ---: ")
    else: sepParts.append(" --- ")
sepRow = "|" + "|".join(sepParts) + "|"
dataStr = "\n".join(["| " + " | ".join(r) + " |" for r in rowTexts])
md2 = headerStr + "\n" + sepRow + "\n" + dataStr
print(md2)
print()

# Re-parse
print("=== Re-parse ===")
lines2 = md2.split("\n")
for l in lines2:
    parts = l.split("|")
    filtered = [p.strip() for p in parts[1:-1]]
    print(f"  {l!r} -> {filtered}")

print()
print("=== escapeHtml ===")
import html
escaped = md2.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
print(escaped)
