export function evaluateStaticCode(challenge, source) {
  const code = String(source || '').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const results = challenge.tests.map((test) => {
    let passed = false;
    let details = '';
    try {
      passed = new RegExp(test.pattern, 'im').test(code);
      details = passed ? 'Check passed.' : test.hint || 'The required code pattern was not found yet.';
    } catch {
      details = 'This authored check is invalid.';
    }
    return { label: test.label, passed, details };
  });
  return report(results);
}

export function evaluateJavaScriptSource(challenge, source) {
  const results = [];
  let candidate;
  try {
    candidate = new Function(`"use strict";\n${String(source || '')}\nreturn typeof ${challenge.functionName} === "function" ? ${challenge.functionName} : null;`)();
    if (typeof candidate !== 'function') throw new Error(`Define a function named ${challenge.functionName}.`);
  } catch (error) {
    return report([{ label: 'Code compiles', passed: false, details: cleanError(error) }]);
  }

  for (const test of challenge.tests) {
    try {
      const args = clone(test.args);
      const before = clone(args);
      const actual = candidate(...args);
      const valuePassed = deepEqual(actual, test.expected);
      const mutationPassed = !test.unchanged || deepEqual(args, before);
      results.push({
        label: test.label,
        passed: valuePassed && mutationPassed,
        details: !valuePassed
          ? `Expected ${preview(test.expected)}, received ${preview(actual)}.`
          : !mutationPassed
            ? 'The input was mutated.'
            : `Returned ${preview(actual)}.`,
      });
    } catch (error) {
      results.push({ label: test.label, passed: false, details: cleanError(error) });
    }
  }
  return report(results);
}

export async function runCodeChallenge(challenge, source, timeoutMs = 1200) {
  if (challenge.language !== 'javascript') return evaluateStaticCode(challenge, source);
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined') return evaluateJavaScriptSource(challenge, source);

  const workerSource = `
    const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
    const deepEqual = (a, b) => {
      if (Object.is(a, b)) return true;
      if (typeof a !== typeof b || a === null || b === null) return false;
      if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
      if (typeof a === 'object') {
        const ak = Object.keys(a), bk = Object.keys(b);
        return ak.length === bk.length && ak.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]));
      }
      return false;
    };
    const preview = (value) => {
      if (value === undefined) return 'undefined';
      try { const text = JSON.stringify(value); return text.length > 100 ? text.slice(0, 97) + '…' : text; }
      catch { return String(value); }
    };
    const cleanError = (error) => String(error && error.message || error || 'Unknown error').slice(0, 180);
    self.fetch = undefined;
    self.XMLHttpRequest = undefined;
    self.WebSocket = undefined;
    self.importScripts = undefined;
    self.onmessage = ({ data }) => {
      const results = [];
      let candidate;
      try {
        candidate = new Function('"use strict";\\n' + data.source + '\\nreturn typeof ' + data.functionName + ' === "function" ? ' + data.functionName + ' : null;')();
        if (typeof candidate !== 'function') throw new Error('Define a function named ' + data.functionName + '.');
      } catch (error) {
        self.postMessage({ passed: false, results: [{ label: 'Code compiles', passed: false, details: cleanError(error) }] });
        return;
      }
      for (const test of data.tests) {
        try {
          const args = clone(test.args);
          const before = clone(args);
          const actual = candidate(...args);
          const valuePassed = deepEqual(actual, test.expected);
          const mutationPassed = !test.unchanged || deepEqual(args, before);
          results.push({
            label: test.label,
            passed: valuePassed && mutationPassed,
            details: !valuePassed ? 'Expected ' + preview(test.expected) + ', received ' + preview(actual) + '.' : !mutationPassed ? 'The input was mutated.' : 'Returned ' + preview(actual) + '.',
          });
        } catch (error) {
          results.push({ label: test.label, passed: false, details: cleanError(error) });
        }
      }
      self.postMessage({ passed: results.every((item) => item.passed), results });
    };
  `;

  const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
  const worker = new Worker(url);
  try {
    return await new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        worker.terminate();
        resolve(report([{ label: 'Code finishes', passed: false, details: 'Execution timed out. Check for an infinite loop.' }]));
      }, timeoutMs);
      worker.onmessage = ({ data }) => {
        window.clearTimeout(timeout);
        worker.terminate();
        resolve(data);
      };
      worker.onerror = (event) => {
        window.clearTimeout(timeout);
        worker.terminate();
        resolve(report([{ label: 'Code runs', passed: false, details: String(event.message || 'Worker error').slice(0, 180) }]));
      };
      worker.postMessage({ source: String(source || ''), functionName: challenge.functionName, tests: challenge.tests });
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function report(results) {
  return { passed: results.length > 0 && results.every((item) => item.passed), results };
}

function clone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => deepEqual(value, b[index]));
  if (typeof a === 'object') {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return aKeys.length === bKeys.length && aKeys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]));
  }
  return false;
}

function preview(value) {
  if (value === undefined) return 'undefined';
  try {
    const text = JSON.stringify(value);
    return text.length > 100 ? `${text.slice(0, 97)}…` : text;
  } catch {
    return String(value);
  }
}

function cleanError(error) {
  return String(error?.message || error || 'Unknown error').slice(0, 180);
}
