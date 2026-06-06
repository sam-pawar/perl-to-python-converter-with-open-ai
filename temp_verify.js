function heuristicConvert(perlCode) {
  const lines = perlCode.split('\n').map(line => line.trimEnd()).filter(line => line.trim() !== '');
  const pythonLines = lines.map(line => {
    let current = line.trim();
    if (/^my\s+\$(\w+)\s*=\s*(.+);\s*$/.test(current)) {
      current = current.replace(/^my\s+\$(\w+)\s*=\s*(.+);\s*$/, '$1 = $2');
    }
    if (/^print\s+(.+);\s*$/.test(current)) {
      current = current.replace(/^print\s+(.+);\s*$/, 'print($1)');
    }
    return current.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, '$1');
  });
  return pythonLines.filter(Boolean).join('\n').trim();
}
console.log(heuristicConvert('my $x = 10;\nmy $y = 5;\nmy $sum = $x + $y;\nprint "Sum is $sum";'));
