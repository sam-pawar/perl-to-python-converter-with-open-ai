const assert = require('assert');
const { heuristicConvert } = require('../server.js');

function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(error);
    process.exit(1);
  }
}

runTest('converts simple assignment and print', () => {
  const perl = `my $x = 10;
my $y = 5;
print "Sum is $x";`;
  const python = heuristicConvert(perl);

  assert.strictEqual(
    python,
    'x = 10\ny = 5\nprint(f"Sum is {x}")'
  );
});

runTest('converts if/else blocks', () => {
  const perl = `if ($x > 0) {
  print "Positive";
} else {
  print "Non-positive";
}`;
  const python = heuristicConvert(perl);

  assert.strictEqual(
    python,
    'if x > 0:\n    print(f"Positive")\nelse:\n    print(f"Non-positive")'
  );
});

runTest('converts for loops', () => {
  const perl = `for (my $i = 0; $i < 3; $i++) {
  print "$i";
}`;
  const python = heuristicConvert(perl);

  assert.strictEqual(
    python,
    'for i in range(0, 3):\n    print(f"{i}")'
  );
});

runTest('converts subroutines and return', () => {
  const perl = `sub add {
  my $a = 1;
  my $b = 2;
  return $a;
}`;
  const python = heuristicConvert(perl);

  assert.strictEqual(
    python,
    'def add():\n    a = 1\n    b = 2\n    return a'
  );
});

console.log('All tests passed.');
