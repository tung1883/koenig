const { performance } = require("perf_hooks");
const { validateAndApplyMove } = require("../services/chess.service");

function run(iterations) {
  let record = "";
  const legalSequence = [
    [52, 36], // e2e4
    [12, 28], // e7e5
    [62, 45], // g1f3
    [1, 18],  // b8c6
    [61, 34], // f1c4
    [6, 21],  // g8f6
    [60, 62]  // O-O
  ];

  const started = performance.now();
  let okCount = 0;
  for (let i = 0; i < iterations; i += 1) {
    const [from, to] = legalSequence[i % legalSequence.length];
    const res = validateAndApplyMove(record, from, to);
    if (res.ok) {
      record = record ? `${record} ${from},${to}` : `${from},${to}`;
      okCount += 1;
      if (okCount % legalSequence.length === 0) record = "";
    } else {
      record = "";
    }
  }
  const ended = performance.now();
  const total = ended - started;
  const avg = total / iterations;

  console.log(`Iterations: ${iterations}`);
  console.log(`Validations: ${okCount}`);
  console.log(`Total ms: ${total.toFixed(3)}`);
  console.log(`Avg ms/op: ${avg.toFixed(6)}`);
}

run(Number(process.argv[2] || 10000));
