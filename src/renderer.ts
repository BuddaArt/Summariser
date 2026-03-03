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

function renderNode(node: TreeNode, prefix: string, lines: string[]): void {
  const entries = Array.from(node.children.entries());

  for (let i = 0; i < entries.length; i++) {
    const [name, child] = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    const isFile = child.summary !== undefined && child.children.size === 0;

    if (isFile) {
      const ext = path.extname(name);
      const baseName = path.basename(name, ext);
      const summaryText = child.summary!.summary;
      const hasError = child.summary!.error !== undefined;

      const nameFormatted = chalk.hex('#FF8C00').bold(baseName) + chalk.gray(ext);
      const summaryFormatted = hasError ? chalk.red(summaryText) : chalk.dim(summaryText);

      lines.push(`${chalk.gray(prefix + connector)}${nameFormatted}  ${summaryFormatted}`);
    } else {
      lines.push(`${chalk.gray(prefix + connector)}${chalk.hex('#FF8C00').bold(name + '/')}`);

      if (child.summary !== undefined) {
        const ext = path.extname(name);
        const baseName = path.basename(name, ext);
        const summaryText = child.summary.summary;
        const hasError = child.summary.error !== undefined;
        const nameFormatted = chalk.hex('#FF8C00').bold(baseName) + chalk.gray(ext);
        const summaryFormatted = hasError ? chalk.red(summaryText) : chalk.dim(summaryText);
        lines.push(`${chalk.gray(childPrefix + '└── ')}${nameFormatted}  ${summaryFormatted}`);
      }

      renderNode(child, childPrefix, lines);
    }
  }
}

export function renderTree(summaries: FileSummary[]): string {
  const tree = buildTree(summaries);
  const lines: string[] = [];
  renderNode(tree, '', lines);
  return lines.join('\n');
}

function renderNodePlain(node: TreeNode, prefix: string, lines: string[]): void {
  const entries = Array.from(node.children.entries());

  for (let i = 0; i < entries.length; i++) {
    const [name, child] = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    const isFile = child.summary !== undefined && child.children.size === 0;

    if (isFile) {
      const summaryText = child.summary!.summary;
      lines.push(`${prefix + connector}${name}  ${summaryText}`);
    } else {
      lines.push(`${prefix + connector}${name}/`);

      if (child.summary !== undefined) {
        const summaryText = child.summary.summary;
        lines.push(`${childPrefix + '└── '}${name}  ${summaryText}`);
      }

      renderNodePlain(child, childPrefix, lines);
    }
  }
}

export function renderTreePlain(summaries: FileSummary[]): string {
  const tree = buildTree(summaries);
  const lines: string[] = [];
  renderNodePlain(tree, '', lines);
  return lines.join('\n');
}

export function renderProgress(completed: number, total: number, currentFile: string): string {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const filled = Math.floor(percent / 5);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
  const fileName = currentFile.length > 40 ? '...' + currentFile.slice(-37) : currentFile;
  return `\r${chalk.hex('#FF8C00')(bar)} ${String(percent).padStart(3)}% ${chalk.gray(`[${completed}/${total}]`)} ${chalk.dim(fileName)}`;
}
