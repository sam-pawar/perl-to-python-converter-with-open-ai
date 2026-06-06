const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function heuristicConvert(perlCode) {
  const lines = perlCode
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim() !== '');

  const pythonLines = lines.map(line => {
    let current = line.trim();

    if (/^my\s+\$(\w+)\s*=\s*(.+);\s*$/.test(current)) {
      current = current.replace(/^my\s+\$(\w+)\s*=\s*(.+);\s*$/, '$1 = $2');
    }

    if (/^print\s+"(.+)";\s*$/.test(current)) {
      current = current.replace(/^print\s+"(.+)";\s*$/, (_, text) => {
        const formatted = text.replace(/\$(\w+)/g, (_, name) => `{${name}}`);
        return `print(f"${formatted}")`;
      });
    }

    if (/^print\s+'(.+)';\s*$/.test(current)) {
      current = current.replace(/^print\s+'(.+)';\s*$/, (_, text) => {
        const formatted = text.replace(/\$(\w+)/g, (_, name) => `{${name}}`);
        return `print(f'${formatted}')`;
      });
    }

    if (/^if\s*\(\s*\$(\w+)\s*([<>!=]+)\s*([^\)]+)\s*\)\s*\{\s*$/.test(current)) {
      current = current.replace(/^if\s*\(\s*\$(\w+)\s*([<>!=]+)\s*([^\)]+)\s*\)\s*\{\s*$/, 'if $1 $2 $3:');
    }

    if (/^while\s*\(\s*\$(\w+)\s*([<>!=]+)\s*([^\)]+)\s*\)\s*\{\s*$/.test(current)) {
      current = current.replace(/^while\s*\(\s*\$(\w+)\s*([<>!=]+)\s*([^\)]+)\s*\)\s*\{\s*$/, 'while $1 $2 $3:');
    }

    if (/^for\s*\(\s*my\s+\$(\w+)\s*=\s*([^;]+);\s*\$(\w+)\s*([<>!=]+)\s*([^;]+);\s*\$(\w+)\+\+\s*\)\s*\{\s*$/.test(current)) {
      current = current.replace(/^for\s*\(\s*my\s+\$(\w+)\s*=\s*([^;]+);\s*\$(\w+)\s*([<>!=]+)\s*([^;]+);\s*\$(\w+)\+\+\s*\)\s*\{\s*$/, 'for $1 in range($2, $5):');
    }

    if (/^sub\s+(\w+)\s*\{\s*$/.test(current)) {
      current = current.replace(/^sub\s+(\w+)\s*\{\s*$/, 'def $1():');
    }

    if (/^return\s+\$(\w+);\s*$/.test(current)) {
      current = current.replace(/^return\s+\$(\w+);\s*$/, 'return $1');
    }

    if (/^}\s*$/.test(current)) {
      return '';
    }

    if (/^else\s*\{\s*$/.test(current)) {
      current = 'else:';
    }

    if (/^elsif\s*\(.*\)\s*\{\s*$/.test(current)) {
      current = current.replace(/^elsif\s*\(\s*(.+?)\s*\)\s*\{\s*$/, 'elif $1:');
    }

    return current.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, '$1');
  });

  return pythonLines.filter(Boolean).join('\n').trim();
}

async function convertWithOpenAI(perlCode) {
  if (!OPENAI_API_KEY) {
    return null;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are an expert Perl-to-Python translator. Return only Python code, no explanation.'
        },
        {
          role: 'user',
          content: `Convert this Perl code to Python:\n\n${perlCode}`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && requestUrl.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, message: 'Server is running.' });
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/convert') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', async () => {
      try {
        const { perlCode = '' } = JSON.parse(body || '{}');

        let pythonCode = '';
        let source = 'fallback';

        if (OPENAI_API_KEY) {
          try {
            pythonCode = await convertWithOpenAI(perlCode);
            source = 'openai';
          } catch (error) {
            pythonCode = heuristicConvert(perlCode);
            source = 'fallback';
          }
        } else {
          pythonCode = heuristicConvert(perlCode);
        }

        return sendJson(res, 200, {
          pythonCode: pythonCode || heuristicConvert(perlCode),
          source,
          note: OPENAI_API_KEY ? 'OpenAI conversion is enabled.' : 'OpenAI key not found; using built-in fallback converter.'
        });
      } catch (error) {
        return sendJson(res, 400, { error: 'Invalid request body.' });
      }
    });
    return;
  }

  const safePath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    };

    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
