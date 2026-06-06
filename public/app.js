const perlInput = document.getElementById('perlInput');
const pythonOutput = document.getElementById('pythonOutput');
const convertBtn = document.getElementById('convertBtn');
const clearBtn = document.getElementById('clearBtn');
const sampleBtn = document.getElementById('sampleBtn');
const statusText = document.getElementById('statusText');
const modeBadge = document.getElementById('modeBadge');

const sampleCode = `my $x = 10;
my $y = 5;
my $sum = $x + $y;
if ($sum > 10) {
  print "Large sum";
}`;

function setStatus(message) {
  statusText.textContent = message;
}

async function convertCode() {
  const perlCode = perlInput.value.trim();
  if (!perlCode) {
    setStatus('Please enter some Perl code first.');
    return;
  }

  setStatus('Converting...');
  convertBtn.disabled = true;
  modeBadge.textContent = 'Working';

  try {
    const response = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ perlCode })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || 'Conversion request failed');
    }

    pythonOutput.textContent = data.pythonCode || 'No output returned.';
    modeBadge.textContent = data.source === 'openai' ? 'OpenAI' : 'Fallback';
    setStatus(data.note || 'Conversion complete.');
  } catch (error) {
    pythonOutput.textContent = 'Conversion failed.';
    modeBadge.textContent = 'Error';
    setStatus(error?.message || 'Unable to contact the conversion endpoint.');
  } finally {
    convertBtn.disabled = false;
  }
}

sampleBtn.addEventListener('click', () => {
  perlInput.value = sampleCode;
  setStatus('Loaded a math-friendly example.');
});

clearBtn.addEventListener('click', () => {
  perlInput.value = '';
  pythonOutput.textContent = 'Your converted code will appear here.';
  modeBadge.textContent = 'Idle';
  setStatus('Input cleared.');
});

convertBtn.addEventListener('click', convertCode);
