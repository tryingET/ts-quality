// @ts-check

/**
 * Line-based reader for the publish workflow used by scripts/release-diagnostics.mjs: trigger keys, release types and
 * each step's comment-stripped run lines and working-directory. Deliberately not a YAML parser.
 */

/**
 * Removes a trailing YAML comment outside quotes.
 * @param {string} value
 */
function stripComment(value) {
  let quote = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? '';
    if (quote) {
      if (character === quote) {
        quote = '';
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '#' && (index === 0 || /\s/u.test(value[index - 1] ?? ''))) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value.trimEnd();
}

/**
 * Line-based reading of the publish workflow, enough for these checks and deliberately not a YAML parser: the
 * top-level trigger keys, the release trigger types, and each step's comment-stripped run lines and working-directory.
 * @param {string} text
 */
export function readWorkflow(text) {
  const lines = text.split('\n');
  /** @type {string[]} */
  const triggers = [];
  let releaseTypes = '';
  const onIndex = lines.findIndex((line) => /^on:/u.test(line));
  const inline = onIndex >= 0 ? stripComment((lines[onIndex] ?? '').slice(3)).trim() : '';
  if (inline) {
    triggers.push(...inline.replace(/[[\]]/gu, '').split(',').map((item) => item.trim()).filter(Boolean));
  } else if (onIndex >= 0) {
    let childIndent = -1;
    for (const line of lines.slice(onIndex + 1)) {
      if (line.trim() === '' || line.trim().startsWith('#')) {
        continue;
      }
      const indent = line.length - line.trimStart().length;
      if (indent === 0) {
        break;
      }
      childIndent = childIndent < 0 ? indent : childIndent;
      const key = /^\s*([A-Za-z_-]+):/u.exec(line)?.[1];
      if (indent === childIndent && key) {
        triggers.push(key);
      } else if (triggers.at(-1) === 'release' && key === 'types') {
        releaseTypes = stripComment(line.trim().slice('types:'.length)).trim();
      }
    }
  }

  /** @type {Array<{ runLines: string[], workingDirectory?: string }>} */
  const steps = [];
  /** @type {{ runLines: string[], workingDirectory?: string } | undefined} */
  let current;
  let stepIndent = -1;
  let runBlockIndent = -1;
  /** @param {{ runLines: string[], workingDirectory?: string }} step @param {string} content @param {number} keyIndent */
  const handleKey = (step, content, keyIndent) => {
    const match = /^([A-Za-z_-]+):\s*(.*)$/u.exec(content);
    const value = stripComment(match?.[2] ?? '').trim();
    if (match?.[1] === 'run') {
      if (/^[|>][-+]?$/u.test(value)) {
        runBlockIndent = keyIndent;
      } else if (value) {
        step.runLines.push(value);
      }
    } else if (match?.[1] === 'working-directory') {
      step.workingDirectory = value;
    }
  };
  let inSteps = false;
  for (const line of lines) {
    if (/^\s*steps:\s*(#.*)?$/u.test(line)) {
      inSteps = true;
      stepIndent = -1;
      current = undefined;
      continue;
    }
    if (!inSteps || line.trim() === '') {
      continue;
    }
    const indent = line.length - line.trimStart().length;
    const dash = /^(\s*)- (.*)$/u.exec(line);
    if (dash && (stepIndent < 0 || indent === stepIndent)) {
      stepIndent = indent;
      runBlockIndent = -1;
      current = { runLines: [] };
      steps.push(current);
      handleKey(current, dash[2] ?? '', indent + 2);
      continue;
    }
    if (stepIndent >= 0 && indent <= stepIndent) {
      inSteps = false;
      current = undefined;
      continue;
    }
    if (!current) {
      continue;
    }
    if (runBlockIndent >= 0 && indent > runBlockIndent) {
      const command = stripComment(line.trim());
      if (command) {
        current.runLines.push(command);
      }
      continue;
    }
    runBlockIndent = -1;
    handleKey(current, line.trim(), indent);
  }
  return { triggers, releaseTypes, steps };
}

/**
 * Index of the first step with a run line starting with the command, or -1.
 * @param {ReturnType<typeof readWorkflow>} workflow
 * @param {RegExp} command
 */
export function stepRunning(workflow, command) {
  return workflow.steps.findIndex((step) => step.runLines.some((line) => command.test(line)));
}
