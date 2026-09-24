import { createRng } from './engine.mjs';

const choice = (id, course, topic, difficulty, type, prompt, choices, answer, explanation, source) => ({
  id, course, topic, difficulty, type, prompt, choices, answer, explanation, source,
});

const input = (id, course, topic, difficulty, prompt, answer, explanation, source, placeholder = 'Type your answer') => ({
  id, course, topic, difficulty, type: 'input', prompt, answer, explanation, source, placeholder,
});

const order = (id, course, topic, difficulty, prompt, choices, answer, explanation, source) => ({
  id, course, topic, difficulty, type: 'order', prompt, choices, answer, explanation, source,
});

const code = (id, course, topic, difficulty, prompt, language, starter, tests, explanation, source, functionName = null) => ({
  id, course, topic, difficulty, type: 'code', prompt, language, starter, tests, explanation, source, functionName,
});

const boss = (id, course, topic, difficulty, prompt, steps, explanation, source) => ({
  id, course, topic, difficulty, type: 'boss', prompt, steps, explanation, source,
});

export const TOPICS = Object.freeze({
  '1521-mips': { label: 'MIPS & memory', course: 'comp1521', source: 'w3l1' },
  '1521-data': { label: 'Integers, bits & floats', course: 'comp1521', source: 'w4l1' },
  '1521-files': { label: 'Files & Unicode', course: 'comp1521', source: 'w7l1' },
  '1521-processes': { label: 'Processes, pipes & threads', course: 'comp1521', source: 'w9l1' },
  '1531-foundations': { label: 'JavaScript, Git & requirements', course: 'comp1531', source: 'c31w2l2' },
  '1531-quality': { label: 'Testing, types & CI', course: 'comp1531', source: 'c31w3l1' },
  '1531-web': { label: 'HTTP, persistence & auth', course: 'comp1531', source: 'c31w5l1' },
  '1531-design': { label: 'Models, design & delivery', course: 'comp1531', source: 'c31w8l1' },
});

export const AUTHORED_CHALLENGES = [
  // COMP1521 — MIPS and memory
  choice('1521-mips-01', 'comp1521', '1521-mips', 1, 'trace', 'After `jal helper`, which register contains the return address?', ['$a0', '$sp', '$ra', '$v0'], 2, '`jal` jumps and writes the address of the following instruction into `$ra`.', 'w3l1'),
  choice('1521-mips-02', 'comp1521', '1521-mips', 1, 'choice', 'Which register selects the MIPS syscall service?', ['$a0', '$v0', '$ra', '$t0'], 1, 'The service number goes in `$v0`; arguments such as an integer to print go in `$a0`.', 'w1l2'),
  choice('1521-mips-03', 'comp1521', '1521-mips', 2, 'trace', 'Given `$t0 = 4` and `$t1 = 4`, what happens at `bne $t0, $t1, skip`?', ['The branch is taken', 'Execution falls through', 'A syscall runs', '$t0 becomes 0'], 1, '`bne` branches only when the values are not equal. Equal values fall through.', 'w1l2'),
  input('1521-mips-04', 'comp1521', '1521-mips', 2, 'An `int` array starts at address 0x1000. What is the address of element 6?', ['0x1018', '4120'], 'Each `int` is four bytes, so the offset is 6 × 4 = 24 = 0x18.', 'w2l2', 'Hex or decimal address'),
  choice('1521-mips-05', 'comp1521', '1521-mips', 2, 'diagnose', 'A program executes `lw $t0, 2($s0)` when `$s0` is word-aligned. What is the likely result?', ['A normal load', 'An alignment fault', 'A stack overflow', 'The value is rounded'], 1, 'A word load needs an address divisible by four. Adding two makes it misaligned.', 'w2l1'),
  choice('1521-mips-06', 'comp1521', '1521-mips', 2, 'choice', 'Which register must a callee restore if it changes it?', ['$t2', '$a1', '$s2', '$v0'], 2, 'Saved registers (`$s0`–`$s7`) belong to the caller across a function call, so the callee preserves them.', 'w3l1'),
  order('1521-mips-07', 'comp1521', '1521-mips', 3, 'Put a conventional non-leaf function frame in order.', ['Save `$ra`', 'Allocate/push frame', 'Run function body', 'Restore frame and `$ra`', 'Return with `jr $ra`'], ['Allocate/push frame', 'Save `$ra`', 'Run function body', 'Restore frame and `$ra`', 'Return with `jr $ra`'], 'A non-leaf function builds its frame, saves what it must preserve, performs the work, restores state, then returns.', 'w3l2'),
  code('1521-code-mips-sum', 'comp1521', '1521-mips', 2, 'Complete `sum_to_n`. Input `$a0` is a non-negative integer; return 1 + … + n in `$v0`.', 'mips', `sum_to_n:
    # write your loop here
    jr   $ra`, [
    { label: 'Initialises the result', pattern: '\\b(li|move)\\s+\\$v0\\s*,\\s*(0|\\$zero)\\b' },
    { label: 'Accumulates into $v0', pattern: '\\badd(u)?\\s+\\$v0\\s*,\\s*\\$v0\\s*,\\s*\\$a0\\b' },
    { label: 'Moves the loop toward zero', pattern: '\\baddi(u)?\\s+\\$a0\\s*,\\s*\\$a0\\s*,\\s*-1\\b' },
    { label: 'Branches or jumps through a loop', pattern: '\\b(b(gtz|nez)|j)\\b' },
    { label: 'Returns through $ra', pattern: '\\bjr\\s+\\$ra\\b' },
  ], 'A working loop initialises `$v0`, adds the current `$a0`, decrements it, repeats while needed, then returns through `$ra`.', 'w3l1'),
  code('1521-code-mips-frame', 'comp1521', '1521-mips', 3, 'Write the prologue and epilogue for a non-leaf MIPS function that calls `helper` without losing its return address.', 'mips', `work:
    # prologue
    jal  helper
    # epilogue`, [
    { label: 'Allocates stack space', pattern: '\\baddi(u)?\\s+\\$sp\\s*,\\s*\\$sp\\s*,\\s*-\\d+\\b' },
    { label: 'Saves $ra before the call', pattern: '\\bsw\\s+\\$ra\\s*,\\s*\\d+\\(\\$sp\\)' },
    { label: 'Restores $ra after the call', pattern: '\\blw\\s+\\$ra\\s*,\\s*\\d+\\(\\$sp\\)' },
    { label: 'Releases stack space', pattern: '\\baddi(u)?\\s+\\$sp\\s*,\\s*\\$sp\\s*,\\s*\\d+\\b' },
    { label: 'Returns to the caller', pattern: '\\bjr\\s+\\$ra\\b' },
  ], 'A non-leaf function allocates a frame, saves `$ra` before `jal`, restores it afterward, releases the frame, and returns.', 'w3l2'),
  code('1521-code-mips-array', 'comp1521', '1521-mips', 2, 'Write MIPS that loads `array[index]` into `$v0`. `$a0` holds the base address and `$a1` holds the index.', 'mips', `load_item:
    # calculate the byte offset and load the word
    jr   $ra`, [
    { label: 'Multiplies the index by four', pattern: '\\b(sll\\s+\\$[a-z0-9]+\\s*,\\s*\\$a1\\s*,\\s*2|mul\\s+\\$[a-z0-9]+\\s*,\\s*\\$a1\\s*,\\s*4)\\b' },
    { label: 'Adds the offset to the base', pattern: '\\badd(u)?\\s+\\$[a-z0-9]+\\s*,\\s*\\$a0\\s*,\\s*\\$[a-z0-9]+\\b' },
    { label: 'Loads a word into $v0', pattern: '\\blw\\s+\\$v0\\s*,\\s*0\\(\\$[a-z0-9]+\\)' },
    { label: 'Returns through $ra', pattern: '\\bjr\\s+\\$ra\\b' },
  ], 'Integer elements are four bytes: shift the index left by two, add it to the base, then load the word.', 'w2l2'),

  // COMP1521 — data representation
  input('1521-data-01', 'comp1521', '1521-data', 1, 'Write −1 as an 8-bit two’s-complement bit pattern.', ['11111111', '0b11111111'], 'Two’s complement represents −1 with every bit set.', 'w4l1', '8 bits'),
  choice('1521-data-02', 'comp1521', '1521-data', 2, 'trace', 'An unsigned 8-bit value containing 255 is incremented once. What value remains?', ['256', '0', '-1', 'Undefined in all C contexts'], 1, 'Unsigned arithmetic wraps modulo 2⁸, so 255 + 1 becomes 0.', 'w4l1'),
  choice('1521-data-03', 'comp1521', '1521-data', 2, 'trace', 'The 32-bit value 0x12345678 is stored little-endian. Which byte is at the lowest address?', ['0x12', '0x34', '0x56', '0x78'], 3, 'Little-endian stores the least-significant byte first.', 'w4l1'),
  input('1521-data-04', 'comp1521', '1521-data', 2, 'What hexadecimal mask sets bit 5 without changing any other bit?', ['0x20', '32'], 'Shift 1 left by five positions: `1 << 5` is binary 0010 0000, or 0x20.', 'w4l2', 'Hex mask'),
  choice('1521-data-05', 'comp1521', '1521-data', 1, 'trace', 'For a non-negative integer `x`, what does `x << 3` usually compute when no bits overflow?', ['x + 3', 'x × 3', 'x × 8', 'x ÷ 8'], 2, 'A left shift by three multiplies by 2³.', 'w4l2'),
  choice('1521-data-06', 'comp1521', '1521-data', 2, 'choice', 'Why can binary floating point not represent decimal 0.1 exactly?', ['It needs a sign bit', 'Its binary fraction repeats forever', 'The exponent is always negative', 'IEEE 754 forbids decimals'], 1, 'Like one third in decimal, 0.1 has a repeating expansion in base two and must be rounded.', 'w5l1'),
  choice('1521-data-07', 'comp1521', '1521-data', 3, 'trace', 'At sufficiently large IEEE-754 values, why can `a + 1 == a` be true?', ['Integer overflow', 'The spacing between representable values exceeds 1', 'NaN compares equal', 'The sign bit is lost'], 1, 'Floating-point spacing grows with magnitude; eventually the next representable value is more than one away.', 'w5l2'),

  // COMP1521 — files and Unicode
  choice('1521-files-01', 'comp1521', '1521-files', 2, 'diagnose', '`open("out", O_WRONLY | O_CREAT)` is called without a third argument. What is missing?', ['A buffer size', 'The new file permission mode', 'The file descriptor', 'SEEK_SET'], 1, 'When `O_CREAT` is present, `open` also needs the mode used for the new file.', 'w7l1'),
  choice('1521-files-02', 'comp1521', '1521-files', 2, 'diagnose', 'Why must the result of `fgetc` be stored in an `int`, not a `char`?', ['Characters are always 32-bit', 'It must represent every byte plus EOF', 'It stores a file descriptor', 'It returns Unicode code points'], 1, '`fgetc` needs an extra sentinel value for EOF in addition to all possible unsigned-byte values.', 'w7l1'),
  choice('1521-files-03', 'comp1521', '1521-files', 2, 'trace', 'A program writes through buffered stdio and crashes before `fflush` or `fclose`. What can happen?', ['The buffer may never reach the file', 'The kernel reconstructs every byte', 'The file becomes a directory', 'The write is automatically retried'], 0, 'Userspace stdio buffering can retain data that is lost when the process terminates abnormally.', 'w7l2'),
  input('1521-files-04', 'comp1521', '1521-files', 1, 'What octal mode gives the owner rwx and everyone else r-x?', ['0755', '755'], 'Owner 7 is rwx; group and other 5 are r-x.', 'w7l2', 'Octal mode'),
  choice('1521-files-05', 'comp1521', '1521-files', 1, 'choice', 'How many bytes can one UTF-8 code point occupy?', ['Always 1', 'Always 4', '1 to 4', '1 to 8'], 2, 'UTF-8 is variable-width: ASCII uses one byte and other code points use up to four.', 'w8l1'),
  choice('1521-files-06', 'comp1521', '1521-files', 2, 'trace', 'Why can `strlen("🦥a")` be larger than 2?', ['It counts UTF-8 bytes, not human-visible characters', 'It includes the pointer', 'It counts pixels', 'It always returns seven'], 0, '`strlen` counts bytes before the null terminator; UTF-8 characters may use multiple bytes.', 'w8l2'),
  code('1521-code-set-bit', 'comp1521', '1521-data', 2, 'Complete this C function so it returns `value` with bit `bit` set.', 'c', `unsigned set_bit(unsigned value, unsigned bit) {
    // your code
}`, [
    { label: 'Builds a one-bit mask', pattern: '1(u|U)?\\s*<<\\s*bit' },
    { label: 'Combines the mask with value', pattern: 'value\\s*\\|' },
    { label: 'Returns the result', pattern: '\\breturn\\b' },
  ], 'The mask is `1u << bit`; bitwise OR sets that bit while preserving every other bit.', 'w4l2'),
  code('1521-code-write-all', 'comp1521', '1521-files', 3, 'Complete `write_all` so partial writes are retried until every byte is written or an error occurs.', 'c', `ssize_t write_all(int fd, const void *buf, size_t count) {
    size_t written = 0;
    // your loop
}`, [
    { label: 'Loops until written reaches count', pattern: '\\bwhile\\s*\\([^)]*written\\s*<\\s*count' },
    { label: 'Calls write with the remaining buffer', pattern: '\\bwrite\\s*\\(\\s*fd\\s*,\\s*[^,]+\\+\\s*written\\s*,\\s*count\\s*-\\s*written\\s*\\)' },
    { label: 'Handles a negative write result', pattern: '\\b(if|while)\\s*\\([^)]*(<\\s*0|==\\s*-1)' },
    { label: 'Advances by the bytes actually written', pattern: 'written\\s*\\+=\\s*' },
    { label: 'Returns the completed byte count', pattern: '\\breturn\\s+written\\s*;' },
  ], '`write` may succeed partially. Advance by its return value and retry the remaining slice; stop on an error.', 'w7l1'),
  code('1521-code-pipe-close', 'comp1521', '1521-processes', 2, 'Fill the child branch of a one-way pipe: close the unused write end, read from the read end, then close it.', 'c', `if (pid == 0) {
    // pipefd[0] reads; pipefd[1] writes
    char buffer[128];
}`, [
    { label: 'Closes the child write end', pattern: '\\bclose\\s*\\(\\s*pipefd\\s*\\[\\s*1\\s*\\]\\s*\\)' },
    { label: 'Reads from the pipe read end', pattern: '\\bread\\s*\\(\\s*pipefd\\s*\\[\\s*0\\s*\\]' },
    { label: 'Closes the read end after use', pattern: '\\bclose\\s*\\(\\s*pipefd\\s*\\[\\s*0\\s*\\]\\s*\\)' },
  ], 'A reader must close its inherited write descriptor or EOF may never arrive, then close the read descriptor after use.', 'w9l1'),

  // COMP1521 — processes, pipes and concurrency
  choice('1521-process-01', 'comp1521', '1521-processes', 1, 'trace', 'A successful `fork()` returns how many times across the two processes?', ['Once', 'Twice', 'Three times', 'It never returns'], 1, 'The parent receives the child PID and the child receives zero, so execution returns twice.', 'w8l2'),
  choice('1521-process-02', 'comp1521', '1521-processes', 1, 'choice', 'What does a successful `execve` do?', ['Creates a sibling process', 'Replaces the current process image', 'Waits for a child', 'Duplicates the current stack'], 1, '`execve` keeps the process identity but replaces its running program.', 'w8l2'),
  choice('1521-process-03', 'comp1521', '1521-processes', 2, 'diagnose', 'Why should `waitpid` status be decoded with macros such as `WIFEXITED` and `WEXITSTATUS`?', ['The status word contains more than an exit code', 'The status is a pointer', 'Exit codes are UTF-8', 'The child owns the status forever'], 0, 'The status word also records signals and how the child changed state; it is not the raw exit code.', 'w9l1'),
  choice('1521-process-04', 'comp1521', '1521-processes', 3, 'diagnose', 'A pipe reader never sees EOF even though the writer finished. What is the first thing to inspect?', ['Whether any process still has a write end open', 'The filename extension', 'The child PID parity', 'The stdio font'], 0, 'EOF arrives only when every descriptor referring to the pipe’s write end is closed.', 'w9l1'),
  choice('1521-process-05', 'comp1521', '1521-processes', 2, 'choice', 'Which memory is private to each thread?', ['Heap', 'Global variables', 'Open file descriptors', 'Stack and registers'], 3, 'Threads share one address space and descriptors, but each has its own stack and execution registers.', 'w9l2'),

  // COMP1531 — foundations
  choice('1531-found-01', 'comp1531', '1531-foundations', 1, 'diagnose', 'Why is `===` preferred to `==` in JavaScript?', ['It performs assignment', 'It avoids implicit type coercion', 'It compares only strings', 'It is faster in every engine'], 1, 'Strict equality compares type and value instead of silently converting operands.', 'c31w1l1'),
  choice('1531-found-02', 'comp1531', '1531-foundations', 1, 'choice', 'Which array method transforms every element and returns a new array?', ['filter', 'reduce', 'map', 'find'], 2, '`map` applies a function to every element and collects the transformed results.', 'c31w4l2'),
  order('1531-found-03', 'comp1531', '1531-foundations', 1, 'Put the basic local-to-remote Git flow in order.', ['git add', 'git commit', 'git push'], ['git add', 'git commit', 'git push'], 'Stage changes, commit the staged snapshot locally, then push commits to the remote.', 'c31w1l2'),
  order('1531-found-04', 'comp1531', '1531-foundations', 2, 'Put a team feature workflow in order.', ['Create issue', 'Create branch', 'Implement and test', 'Open merge request', 'Review and merge'], ['Create issue', 'Create branch', 'Implement and test', 'Open merge request', 'Review and merge'], 'The course workflow makes the task visible, isolates work, checks it, then reviews before main changes.', 'c31w2l1'),
  choice('1531-found-05', 'comp1531', '1531-foundations', 1, 'choice', '“The API must respond within 200 ms” is what kind of requirement?', ['Functional', 'Non-functional', 'A user story', 'A merge conflict'], 1, 'It constrains a quality of the system rather than describing a capability.', 'c31w2l2'),
  choice('1531-found-06', 'comp1531', '1531-foundations', 1, 'diagnose', 'Which user story follows the course template?', ['The app has buttons', 'As a student, I want to view deadlines so I can plan my week', 'Use TypeScript everywhere', 'GET /deadlines returns 200'], 1, 'A user story names the actor, goal and reason: “As a…, I want…, so that…”.', 'c31w2l2'),
  choice('1531-found-07', 'comp1531', '1531-foundations', 2, 'choice', 'Why commit the npm lockfile but not `node_modules`?', ['The lockfile reproduces exact versions without vendoring dependencies', 'The lockfile runs the server', '`node_modules` cannot contain JavaScript', 'Git ignores JSON'], 0, 'The lockfile records the resolved dependency graph; installed packages can be recreated from it.', 'c31w2l2'),
  code('1531-code-positive-sum', 'comp1531', '1531-foundations', 2, 'Implement `sumPositive(numbers)`. Return the sum of only the positive values without mutating the input.', 'javascript', `function sumPositive(numbers) {
  // your code
}`, [
    { label: 'mixed values', args: [[3, -2, 5, 0]], expected: 8, unchanged: true },
    { label: 'no positive values', args: [[-4, 0, -1]], expected: 0, unchanged: true },
    { label: 'empty input', args: [[]], expected: 0, unchanged: true },
  ], 'Filter or conditionally accumulate values greater than zero. Starting the total at zero also handles an empty array.', 'c31w1l1', 'sumPositive'),
  code('1531-code-normalise-user', 'comp1531', '1531-foundations', 2, 'Implement `normaliseUser(user)`. Return a new object with a trimmed, lowercase `email`; do not mutate the input.', 'javascript', `function normaliseUser(user) {
  // your code
}`, [
    { label: 'normalises email', args: [{ name: 'Ada', email: '  ADA@EXAMPLE.COM ' }], expected: { name: 'Ada', email: 'ada@example.com' }, unchanged: true },
    { label: 'preserves other fields', args: [{ id: 7, email: 'X@Y.COM' }], expected: { id: 7, email: 'x@y.com' }, unchanged: true },
  ], 'Use object spread to create a new object, then replace `email` with `user.email.trim().toLowerCase()`.', 'c31w1l1', 'normaliseUser'),

  // COMP1531 — quality
  choice('1531-quality-01', 'comp1531', '1531-quality', 1, 'choice', 'A test calls only the exported function and ignores its implementation. What style is this?', ['White-box', 'Black-box', 'Static verification', 'Deployment testing'], 1, 'Black-box tests observe behavior through the public interface.', 'c31w3l1'),
  choice('1531-quality-02', 'comp1531', '1531-quality', 2, 'diagnose', 'A line ran during tests, but one side of its `if` never ran. Which metric reveals this gap?', ['Statement formatting', 'Branch coverage', 'Package coverage', 'Latency'], 1, 'Branch coverage checks whether each decision outcome was exercised.', 'c31w3l1'),
  choice('1531-quality-03', 'comp1531', '1531-quality', 2, 'choice', 'Which TypeScript type represents a value that may be a string or a number?', ['string & number', 'string | number', 'any[]', 'unknown?'], 1, 'A union uses `|` to permit either constituent type.', 'c31w3l2'),
  choice('1531-quality-04', 'comp1531', '1531-quality', 2, 'diagnose', 'Which tool should catch passing a string to a function that requires a number before execution?', ['eslint formatting only', 'tsc', 'git push', 'c8'], 1, 'The TypeScript compiler performs static type checking.', 'c31w3l2'),
  choice('1531-quality-05', 'comp1531', '1531-quality', 1, 'choice', 'What is a linter best suited to catch?', ['A missing production database', 'Style and suspicious code patterns', 'Every runtime bug', 'A slow network'], 1, 'Linters enforce conventions and flag patterns; they do not prove runtime correctness.', 'c31w3l2'),
  order('1531-quality-06', 'comp1531', '1531-quality', 2, 'Put a simple CI pipeline in a sensible fail-fast order.', ['Install dependencies', 'Type-check and lint', 'Run tests', 'Report result'], ['Install dependencies', 'Type-check and lint', 'Run tests', 'Report result'], 'The runner first recreates the environment, then performs cheap checks before the test suite.', 'c31w4l1'),
  code('1531-code-is-valid-name', 'comp1531', '1531-quality', 2, 'Implement `isValidName(name)`. A valid name is a string whose trimmed length is from 2 to 40 characters.', 'javascript', `function isValidName(name) {
  // your code
}`, [
    { label: 'ordinary name', args: ['  Ada  '], expected: true },
    { label: 'too short after trimming', args: [' x '], expected: false },
    { label: 'wrong type', args: [42], expected: false },
    { label: 'upper boundary', args: ['a'.repeat(40)], expected: true },
    { label: 'over boundary', args: ['a'.repeat(41)], expected: false },
  ], 'Guard the type first, trim once, then test both inclusive length boundaries. The tests deliberately exercise each branch.', 'c31w3l1', 'isValidName'),
  code('1531-code-find-by-id', 'comp1531', '1531-quality', 2, 'Implement `findById(items, id)`. Return the matching object, or `null` when no item has that id.', 'javascript', `function findById(items, id) {
  // your code
}`, [
    { label: 'finds a match', args: [[{ id: 1 }, { id: 2, name: 'B' }], 2], expected: { id: 2, name: 'B' } },
    { label: 'missing id', args: [[{ id: 1 }], 9], expected: null },
    { label: 'strict comparison', args: [[{ id: 1 }], '1'], expected: null },
  ], '`find` returns `undefined` when nothing matches; convert that case to `null` and use strict equality for the id.', 'c31w3l1', 'findById'),

  // COMP1531 — web, persistence and auth
  choice('1531-web-01', 'comp1531', '1531-web', 1, 'choice', 'A callback passed to `map` is an example of what?', ['A file descriptor', 'A first-class function', 'A status code', 'A database row'], 1, 'Functions can be stored and passed like other values; `map` receives one as an argument.', 'c31w4l2'),
  choice('1531-web-02', 'comp1531', '1531-web', 2, 'choice', 'Which route shape best identifies one book by id?', ['GET /books?id=42 only', 'GET /books/42', 'POST /books/list', 'DELETE /books'], 1, 'A path parameter naturally identifies one resource; query parameters are better for optional filtering.', 'c31w5l1'),
  choice('1531-web-03', 'comp1531', '1531-web', 2, 'diagnose', 'Why should a password not appear in a GET query string even over HTTPS?', ['HTTPS rejects GET', 'URLs are recorded at endpoints and in history/logs', 'Queries are never encrypted in transit', 'Passwords cannot contain punctuation'], 1, 'HTTPS protects transit, but the browser and server still see and may retain the URL.', 'c31w5l1'),
  choice('1531-web-04', 'comp1531', '1531-web', 1, 'choice', 'Where does an Express POST route normally read JSON input?', ['req.params', 'req.body', 'res.status', 'process.argv'], 1, 'POST data belongs in the request body after JSON middleware parses it.', 'c31w5l1'),
  choice('1531-web-05', 'comp1531', '1531-web', 1, 'choice', 'A requested book id does not exist. Which response is appropriate?', ['200', '400', '404', '503'], 2, '404 means the requested resource was not found.', 'c31w5l1'),
  choice('1531-web-06', 'comp1531', '1531-web', 2, 'diagnose', 'A valid user token tries to edit another user’s private record. Which status best fits?', ['400', '401', '403', '500'], 2, 'The caller is authenticated but not authorised, so the request is forbidden: 403.', 'c31w5l2'),
  choice('1531-web-07', 'comp1531', '1531-web', 2, 'choice', 'A useful HTTP test should assert which pair?', ['Only console output', 'Body and status code', 'Coverage and Git branch', 'Port and font'], 1, 'Both the response payload and HTTP status are part of the endpoint contract.', 'c31w5l2'),
  choice('1531-web-08', 'comp1531', '1531-web', 2, 'choice', 'What trade-off comes from reading a JSON data file on every request?', ['Current data but more I/O', 'No persistence and no I/O', 'Automatic transactions', 'Guaranteed scalability'], 0, 'Per-request reads avoid stale in-memory state but repeat disk work.', 'c31w7l1'),
  choice('1531-web-09', 'comp1531', '1531-web', 2, 'choice', 'What does EAFP suggest?', ['Validate every possibility before trying', 'Try the operation and handle the exception', 'Exit on all bad input', 'Ignore failures'], 1, 'Easier to ask forgiveness than permission means attempt the operation and catch expected failures.', 'c31w7l1'),
  choice('1531-web-10', 'comp1531', '1531-web', 1, 'choice', 'Why hash stored passwords rather than encrypt them for later recovery?', ['Hashing is intended to be one-way', 'Hashes are always shorter', 'Encryption cannot use keys', 'HTTP requires hashes'], 0, 'Authentication needs comparison, not recovery of the original password; one-way storage reduces breach impact.', 'c31w7l2'),
  code('1531-code-http-class', 'comp1531', '1531-web', 2, 'Implement `httpClass(status)`. Return `"success"` for 2XX, `"client"` for 4XX, `"server"` for 5XX, otherwise `"other"`.', 'javascript', `function httpClass(status) {
  // your code
}`, [
    { label: 'success lower edge', args: [200], expected: 'success' },
    { label: 'success upper edge', args: [299], expected: 'success' },
    { label: 'client error', args: [404], expected: 'client' },
    { label: 'server error', args: [503], expected: 'server' },
    { label: 'redirect is other', args: [302], expected: 'other' },
  ], 'HTTP classes are half-open ranges: 200–299, 400–499, and 500–599. Check both boundaries explicitly.', 'c31w5l1', 'httpClass'),
  code('1531-code-authorise', 'comp1531', '1531-web', 3, 'Implement `canEdit(session, record)`. Return true only when a session exists and its `userId` strictly equals `record.ownerId`.', 'javascript', `function canEdit(session, record) {
  // your code
}`, [
    { label: 'owner may edit', args: [{ userId: 7 }, { ownerId: 7 }], expected: true },
    { label: 'another user may not edit', args: [{ userId: 8 }, { ownerId: 7 }], expected: false },
    { label: 'missing session', args: [null, { ownerId: 7 }], expected: false },
    { label: 'no coercion', args: [{ userId: '7' }, { ownerId: 7 }], expected: false },
  ], 'Authentication is required before authorisation. Optional chaining can guard a missing session; strict equality prevents id coercion.', 'c31w5l2', 'canEdit'),

  // COMP1531 — design and delivery
  choice('1531-design-01', 'comp1531', '1531-design', 1, 'choice', 'Which model describes the shape of code classes?', ['ER diagram', 'UML class diagram', 'State diagram', 'Deployment log'], 1, 'UML class diagrams are structural models of code; ER diagrams model stored data.', 'c31w8l1'),
  choice('1531-design-02', 'comp1531', '1531-design', 2, 'diagnose', 'A team builds a flexible plugin system for a single fixed requirement that may never change. Which principle warns against this?', ['DRY', 'YAGNI', 'Authentication', 'Branch coverage'], 1, 'You Aren’t Gonna Need It warns against speculative capability that adds accidental complexity.', 'c31w8l1'),
  choice('1531-design-03', 'comp1531', '1531-design', 2, 'choice', 'Verification asks “built right”; what does validation ask?', ['Was the right thing built?', 'Was the code pushed?', 'Were all lines covered?', 'Was the server restarted?'], 0, 'Validation checks that the product actually meets user needs.', 'c31w9l1'),
  choice('1531-design-04', 'comp1531', '1531-design', 2, 'choice', 'What separates continuous delivery from continuous deployment?', ['Delivery requires a human release decision', 'Delivery has no tests', 'Deployment cannot use staging', 'Deployment never reaches users'], 0, 'Continuous delivery keeps the release decision manual; continuous deployment releases automatically after gates pass.', 'c31w9l1'),
  choice('1531-design-05', 'comp1531', '1531-design', 2, 'diagnose', 'A monitoring dashboard is dominated by 4XX responses. What is the first interpretation?', ['The server is certainly broken', 'Clients are making invalid or unauthorised requests', 'The database is corrupt', 'CI failed'], 1, '4XX codes attribute the problem to the request; 5XX codes indicate server failure.', 'c31w9l1'),

  // Boss encounters — three steps each
  boss('1521-boss-mips', 'comp1521', '1521-mips', 3, 'Boss: repair a nested MIPS function before `$ra` is lost.', [
    { type: 'choice', prompt: 'Which instruction overwrites `$ra` inside the function?', choices: ['lw', 'jal', 'beq', 'syscall'], answer: 1 },
    { type: 'choice', prompt: 'What must the function do before that instruction?', choices: ['Clear `$a0`', 'Save `$ra`', 'Move `$sp` to zero', 'Call `exit`'], answer: 1 },
    { type: 'input', prompt: 'Which instruction returns to the saved return address?', answer: ['jr $ra', 'jr$ra'] },
  ], 'A non-leaf function saves `$ra`, makes nested calls, restores `$ra`, and returns with `jr $ra`.', 'w3l1'),
  boss('1521-boss-files', 'comp1521', '1521-files', 3, 'Boss: make a binary-safe file copier.', [
    { type: 'choice', prompt: 'Which API reads raw bytes without treating them as text?', choices: ['fgets', 'read', 'fprintf', 'strlen'], answer: 1 },
    { type: 'choice', prompt: 'What must happen when `write` writes fewer bytes than requested?', choices: ['Discard the rest', 'Loop over the unwritten bytes', 'Reopen as text', 'Seek to zero'], answer: 1 },
    { type: 'choice', prompt: 'Which return value from `read` means clean EOF?', choices: ['-1', '0', '1', 'EOF as a char'], answer: 1 },
  ], 'A robust binary copy loops on `read`, handles errors, and may loop on partial `write` results.', 'w7l1'),
  boss('1521-boss-threads', 'comp1521', '1521-processes', 3, 'Boss: stop a bank transfer from racing or deadlocking.', [
    { type: 'choice', prompt: 'Why is `balance = balance + amount` unsafe across threads?', choices: ['It is multiple operations', 'Integers cannot be shared', 'The heap is private', 'Addition always overflows'], answer: 0 },
    { type: 'choice', prompt: 'What protects the read-modify-write critical section?', choices: ['A mutex', 'A pipe name', 'UTF-8', 'fork'], answer: 0 },
    { type: 'choice', prompt: 'How do two-account transfers avoid deadlock?', choices: ['Acquire locks in one global order', 'Add more sleeps', 'Never release locks', 'Use opposite orders'], answer: 0 },
  ], 'Mutual exclusion fixes the race; a consistent global lock order removes the cycle required for deadlock.', 'w10l1'),
  boss('1531-boss-route', 'comp1531', '1531-web', 3, 'Boss: design `DELETE /books/:id` for an authenticated API.', [
    { type: 'choice', prompt: 'Where does the book id come from?', choices: ['req.body only', 'req.params', 'res.body', 'process.env'], answer: 1 },
    { type: 'choice', prompt: 'No valid session token was supplied. Return…', choices: ['400', '401', '403', '500'], answer: 1 },
    { type: 'choice', prompt: 'The token is valid but the book is owned by someone else. Return…', choices: ['200', '401', '403', '503'], answer: 2 },
  ], 'The route reads its resource id from the path and distinguishes unauthenticated 401 from unauthorised 403.', 'c31w5l2'),
  boss('1531-boss-quality', 'comp1531', '1531-quality', 3, 'Boss: rescue a green pipeline with deceptive coverage.', [
    { type: 'choice', prompt: 'All lines ran but one `if` outcome did not. Which metric is weak?', choices: ['Branch coverage', 'Package version', 'Latency', 'Git history'], answer: 0 },
    { type: 'choice', prompt: '`tsc` fails before tests. Should the pipeline continue?', choices: ['Yes, deploy anyway', 'No, fail fast', 'Only on Friday', 'Convert to JavaScript'], answer: 1 },
    { type: 'choice', prompt: 'Passing public autotests proves…', choices: ['Full correctness', 'Only the exercised behavior', 'No hidden cases exist', 'The design is maintainable'], answer: 1 },
  ], 'A trustworthy pipeline fails on static errors and treats passing tests as evidence limited to their coverage.', 'c31w4l1'),
  boss('1531-boss-design', 'comp1531', '1531-design', 3, 'Boss: ship a feature without building the wrong thing.', [
    { type: 'choice', prompt: 'What should come before detailed implementation?', choices: ['Validate the user need', 'Optimise every loop', 'Add speculative plugins', 'Deploy to production'], answer: 0 },
    { type: 'choice', prompt: 'A duplicated rule appears in five files. Which principle is under pressure?', choices: ['DRY', 'YAGNI', 'EAFP', 'REST'], answer: 0 },
    { type: 'choice', prompt: 'After a small release, what closes the agile loop?', choices: ['User feedback', 'A larger requirements document', 'More branches', 'Hiding metrics'], answer: 0 },
  ], 'Validate the need, keep one source of truth, ship a small slice, then learn from real feedback.', 'c31w9l1'),
];

export function createChallengePool(seed = 1) {
  const rng = createRng(seed);
  return [...AUTHORED_CHALLENGES, ...generate1521(rng, seed), ...generate1531(rng, seed)];
}

function generate1521(rng, seed) {
  const decimal = 16 + Math.floor(rng() * 224);
  const bit = 1 + Math.floor(rng() * 7);
  const base = 0x1000 + Math.floor(rng() * 8) * 0x100;
  const index = 2 + Math.floor(rng() * 8);
  const signed = 128 + Math.floor(rng() * 128);
  return [
    input(`1521-generated-hex-${seed}`, 'comp1521', '1521-data', 1, `Convert decimal ${decimal} to hexadecimal.`, [`0x${decimal.toString(16)}`, decimal.toString(16)], `${decimal} is 0x${decimal.toString(16).toUpperCase()} in hexadecimal.`, 'w4l1', 'Hex value'),
    input(`1521-generated-mask-${seed}`, 'comp1521', '1521-data', 2, `Give the hexadecimal mask for bit ${bit}.`, [`0x${(1 << bit).toString(16)}`, String(1 << bit)], `A one shifted left ${bit} places is 0x${(1 << bit).toString(16).toUpperCase()}.`, 'w4l2', 'Hex mask'),
    input(`1521-generated-array-${seed}`, 'comp1521', '1521-mips', 2, `An int array begins at 0x${base.toString(16)}. What is the address of element ${index}?`, [`0x${(base + index * 4).toString(16)}`, String(base + index * 4)], `The byte offset is ${index} × 4 = ${index * 4}.`, 'w2l2', 'Address'),
    input(`1521-generated-signed-${seed}`, 'comp1521', '1521-data', 2, `Interpret unsigned byte ${signed} as signed two’s complement.`, String(signed - 256), `The high bit is set, so subtract 256: ${signed} − 256 = ${signed - 256}.`, 'w4l1', 'Signed decimal'),
  ];
}

function generate1531(rng, seed) {
  const branches = 2 + Math.floor(rng() * 5);
  const statuses = [
    ['A request has no valid session token.', ['400', '401', '403', '500'], 1, '401 means authentication is required or invalid.'],
    ['A valid user requests a resource that does not exist.', ['200', '400', '404', '503'], 2, '404 means the resource was not found.'],
    ['The server throws an unexpected database error.', ['201', '403', '404', '500'], 3, 'An unexpected server failure belongs in the 5XX class.'],
  ];
  const status = statuses[Math.floor(rng() * statuses.length)];
  return [
    input(`1531-generated-complexity-${seed}`, 'comp1531', '1531-design', 2, `A simple control-flow graph has ${branches} independent decision points. What is its cyclomatic complexity?`, String(branches + 1), `For a connected structured function, complexity is decisions + 1 = ${branches + 1}.`, 'c31w8l2', 'Number'),
    choice(`1531-generated-status-${seed}`, 'comp1531', '1531-web', 2, 'diagnose', status[0], status[1], status[2], status[3], 'c31w5l2'),
    choice(`1531-generated-semver-${seed}`, 'comp1531', '1531-foundations', 2, 'choice', 'A dependency is declared as `^2.4.1`. Which update is normally allowed?', ['3.0.0', '2.9.0', '1.9.9', 'Any major version'], 1, 'For a stable major version, caret ranges allow compatible minor and patch updates below 3.0.0.', 'c31w2l2'),
    choice(`1531-generated-coverage-${seed}`, 'comp1531', '1531-quality', 2, 'diagnose', 'A test suite executes both lines of an `if/else`, but never calls a second exported function. What is definitely incomplete?', ['Function coverage', 'Every branch', 'The lockfile', 'HTTP encryption'], 0, 'An exported function never invoked by the suite leaves function coverage incomplete.', 'c31w3l1'),
  ];
}
