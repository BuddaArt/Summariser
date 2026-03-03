import chalk from 'chalk';
import * as path from 'path';
import { FileSummary } from './summarizer';

interface TreeNode {
  name: string;
  children: Map<string, TreeNode>;
  summary?: FileSummary;
}

function buildTree(summaries: FileSummary[]): TreeNode {
  const root: TreeNode = { name: '', children: new Map() };

  for (const summary of summaries) {
    const parts = summary.file.relativePath.split('/');
    let node = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          children: new Map(),
          summary: isLast ? summary : undefined,
        });
      } else if (isLast) {
        node.children.get(part)!.summary = summary;
      }

      node = node.children.get(part)!;
    }
  }

  return root;
}

function renderNode(node: TreeNode, depth: number, lines: string[]): void {
  for (const [name, child] of node.children) {
    const indent = '  '.repeat(depth);
    const isFile = child.summary !== undefined && child.children.size === 0;

    if (isFile) {
      const baseName = path.basename(name, path.extname(name));
      const summaryText = child.summary!.summary;
      const hasError = child.summary!.error !== undefined;

      const nameFormatted = chalk.hex('#FF8C00')(baseName);
      const summaryFormatted = hasError ? chalk.red(summaryText) : chalk.white(summaryText);

      lines.push(`${indent}${chalk.gray('--')} ${nameFormatted} ${chalk.gray('(')}${summaryFormatted}${chalk.gray(')')}`);
    } else {
      // Directory node (or file that also has children — treated as dir)
      lines.push(`${indent}${chalk.gray('-')} ${chalk.hex('#FF8C00').bold(name)}`);

      // If this node itself is also a file (unlikely but possible with same-named file/dir)
      if (child.summary !== undefined) {
        const baseName = path.basename(name, path.extname(name));
        const summaryText = child.summary.summary;
        const hasError = child.summary.error !== undefined;
        const nameFormatted = chalk.hex('#FF8C00')(baseName);
        const summaryFormatted = hasError ? chalk.red(summaryText) : chalk.white(summaryText);
        lines.push(`${'  '.repeat(depth + 1)}${chalk.gray('--')} ${nameFormatted} ${chalk.gray('(')}${summaryFormatted}${chalk.gray(')')}`);
      }

      renderNode(child, depth + 1, lines);
    }
  }
}

export function renderTree(summaries: FileSummary[]): string {
  const tree = buildTree(summaries);
  const lines: string[] = [];
  renderNode(tree, 0, lines);
  return lines.join('\n');
}

export function renderProgress(completed: number, total: number, currentFile: string): string {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const filled = Math.floor(percent / 5);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
  const fileName = currentFile.length > 40 ? '...' + currentFile.slice(-37) : currentFile;
  return `\r${chalk.hex('#FF8C00')(bar)} ${String(percent).padStart(3)}% ${chalk.gray(`[${completed}/${total}]`)} ${chalk.dim(fileName)}`;
}
