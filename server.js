require('dotenv').config();
const express = require('express');
const path = require('path');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_ENABLED = Boolean(OPENAI_API_KEY);

function sendJson(res, statusCode, payload) {
  return res.status(statusCode).json(payload);
}

function normalizePerlVariable(value) {
  return value
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, '$1')
    .replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, '$1')
    .replace(/%([A-Za-z_][A-Za-z0-9_]*)/g, '$1');
}

function convertCondition(condition) {
  return normalizePerlVariable(condition)
    .replace(/\beq\b/g, '==')
    .replace(/\bne\b/g, '!=')
    .replace(/\band\b/g, 'and')
    .replace(/\bor\b/g, 'or')
    .replace(/\bnot\b/g, 'not ');
}

function convertPrint(value) {
  const trimmed = value.trim();

  const doubleMatch = trimmed.match(/^"([\s\S]*)"$/);
  if (doubleMatch) {
    const text = doubleMatch[1].replace(/\$(\w+)/g, '{$1}');
    return `print(f"${text}")`;
  }

  const singleMatch = trimmed.match(/^'([\s\S]*)'$/);
  if (singleMatch) {
    const text = singleMatch[1].replace(/\$(\w+)/g, '{$1}');
    return `print(f'${text}')`;
  }

  return `print(${normalizePerlVariable(trimmed)})`;
}

function convertPerlLine(line) {
  let current = line.trim();

  if (!current || /^use\s+(strict|warnings)\b/.test(current)) {
    return { output: '', blockStart: false, blockClose: false };
  }

  if (/^\}\s*$/.test(current)) {
    return { output: '', blockStart: false, blockClose: true };
  }

  current = current.replace(/;\s*$/, '');

  const declarationMatch = current.match(/^my\s+\$(\w+)\s*=\s*(.+)$/);
  if (declarationMatch) {
    return {
      output: `${declarationMatch[1]} = ${normalizePerlVariable(declarationMatch[2])}`,
      blockStart: false,
      blockClose: false,
    };
  }

  const closeElsifMatch = current.match(/^\}\s*elsif\s*\((.+)\)\s*\{\s*$/);
  if (closeElsifMatch) {
    return { output: `elif ${convertCondition(closeElsifMatch[1])}:`, blockStart: true, blockClose: false, dedentBefore: true };
  }

  const closeElseMatch = current.match(/^\}\s*else\s*\{\s*$/);
  if (closeElseMatch) {
    return { output: 'else:', blockStart: true, blockClose: false, dedentBefore: true };
  }

  const elsifMatch = current.match(/^elsif\s*\((.+)\)\s*\{\s*$/);
  if (elsifMatch) {
    return { output: `elif ${convertCondition(elsifMatch[1])}:`, blockStart: true, blockClose: false, dedentBefore: true };
  }

  if (/^else\s*\{\s*$/.test(current)) {
    return { output: 'else:', blockStart: true, blockClose: false, dedentBefore: true };
  }

  const ifMatch = current.match(/^if\s*\((.+)\)\s*\{\s*$/);
  if (ifMatch) {
    return { output: `if ${convertCondition(ifMatch[1])}:`, blockStart: true, blockClose: false };
  }

  const whileMatch = current.match(/^while\s*\((.+)\)\s*\{\s*$/);
  if (whileMatch) {
    return { output: `while ${convertCondition(whileMatch[1])}:`, blockStart: true, blockClose: false };
  }

  const forMatch = current.match(/^for\s*\(\s*my\s+\$(\w+)\s*=\s*([^;]+);\s*\$\1\s*([<>]=?)\s*([^;]+);\s*\$\1\+\+\s*\)\s*\{\s*$/);
  if (forMatch) {
    const iterator = forMatch[1];
    const start = normalizePerlVariable(forMatch[2]);
    const op = forMatch[3];
    const end = normalizePerlVariable(forMatch[4]);
    const rangeEnd = op === '<=' ? `${end} + 1` : end;
    return { output: `for ${iterator} in range(${start}, ${rangeEnd}):`, blockStart: true, blockClose: false };
  }

  const foreachMatch = current.match(/^foreach\s+my\s+\$(\w+)\s*\(\s*(@\w+)\s*\)\s*\{\s*$/);
  if (foreachMatch) {
    return { output: `for ${foreachMatch[1]} in ${normalizePerlVariable(foreachMatch[2])}:`, blockStart: true, blockClose: false };
  }

  const subMatch = current.match(/^sub\s+(\w+)\s*\{\s*$/);
  if (subMatch) {
    return { output: `def ${subMatch[1]}():`, blockStart: true, blockClose: false };
  }

  const returnMatch = current.match(/^return\s+\$(\w+)\s*$/);
  if (returnMatch) {
    return { output: `return ${returnMatch[1]}`, blockStart: false, blockClose: false };
  }

  const printMatch = current.match(/^print\s+(.+)$/s);
  if (printMatch) {
    return { output: convertPrint(printMatch[1]), blockStart: false, blockClose: false };
  }

  const chompMatch = current.match(/^chomp\s*\(\s*\$(\w+)\s*\)\s*$/);
  if (chompMatch) {
    return { output: `${chompMatch[1]} = ${chompMatch[1]}.rstrip("\n")`, blockStart: false, blockClose: false };
  }

  return { output: normalizePerlVariable(current), blockStart: false, blockClose: false };
}

function heuristicConvert(perlCode) {
  const lines = perlCode.split('\n');
  let indentLevel = 0;
  const pythonLines = [];

  for (const rawLine of lines) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) {
      pythonLines.push('');
      continue;
    }

    const converted = convertPerlLine(trimmedLine);
    if (converted.blockClose) {
      indentLevel = Math.max(indentLevel - 1, 0);
      continue;
    }

    if (converted.dedentBefore) {
      indentLevel = Math.max(indentLevel - 1, 0);
    }

    if (converted.output) {
      pythonLines.push('    '.repeat(indentLevel) + converted.output);
    }

    if (converted.blockStart) {
      indentLevel += 1;
    }
  }

  return pythonLines.join('\n').replace(/[ \t]+$/gm, '').trim();
}

async function convertWithOpenAI(perlCode) {
  if (!OPENAI_ENABLED) {
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
    const text = await response.text();
    throw new Error(`OpenAI request failed ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

const app = express();

app.use(express.json({ limit: '256kb' }));
app.use(express.static(PUBLIC_DIR, { extensions: ['html'], fallthrough: false }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  next();
});

app.get('/api/health', (req, res) => sendJson(res, 200, { ok: true, message: 'Server is running.' }));

app.post('/api/convert', async (req, res) => {
  const perlCode = typeof req.body?.perlCode === 'string' ? req.body.perlCode : '';

  if (!perlCode.trim()) {
    return sendJson(res, 400, { error: 'The perlCode field is required.' });
  }

  let pythonCode = heuristicConvert(perlCode);
  let source = 'fallback';
  let note = 'Built-in fallback conversion was used.';

  if (OPENAI_ENABLED) {
    try {
      const openaiResult = await convertWithOpenAI(perlCode);
      if (openaiResult) {
        pythonCode = openaiResult;
        source = 'openai';
        note = 'OpenAI conversion succeeded.';
      } else {
        note = 'OpenAI returned no code; fallback converter was used.';
      }
    } catch (error) {
      console.error('OpenAI conversion failed:', error?.message || error);
      note = 'OpenAI conversion failed; fallback converter was used.';
    }
  }

  return sendJson(res, 200, {
    pythonCode,
    source,
    note,
    openaiEnabled: OPENAI_ENABLED,
  });
});

app.use((req, res) => {
  res.status(404).send('Not found');
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return sendJson(res, 400, { error: 'Invalid JSON payload.' });
  }

  console.error('Unhandled server error:', err);
  return sendJson(res, 500, { error: 'Internal server error.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = { heuristicConvert, app };
