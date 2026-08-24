import os
import codecs

with codecs.open(r'C:\Users\yrish\.gemini\antigravity\scratch\baton-web-client\scratch.py', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("open(", "codecs.open(").replace("'w')", "'w', encoding='utf-8')").replace("import os", "import os\nimport codecs")

with codecs.open(r'C:\Users\yrish\.gemini\antigravity\scratch\baton-web-client\scratch.py', 'w', encoding='utf-8') as f:
    f.write(code)
