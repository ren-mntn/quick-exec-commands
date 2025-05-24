import * as vscode from 'vscode';
import { CommandManager } from '../commands/commandManager';
import { QuickCommand } from '../types';

type TreeItem = CommandTreeItem | CategoryTreeItem;

export class QuickCommandProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeItem | undefined | null | void
  > = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private commandManager: CommandManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      // ルートレベル：お気に入り、グローバル、ワークスペースのカテゴリ
      const items: TreeItem[] = [];

      const favoriteCommands = await this.commandManager.getFavoriteCommands();
      if (favoriteCommands.length > 0) {
        items.push(
          new CategoryTreeItem('お気に入り', 'favorite', favoriteCommands)
        );
      }

      const globalCommands = this.commandManager.getGlobalCommands();
      if (globalCommands.length > 0) {
        items.push(
          new CategoryTreeItem('グローバル', 'global', globalCommands)
        );
      }

      const workspaceCommands = this.commandManager.getWorkspaceCommands();
      if (workspaceCommands.length > 0) {
        items.push(
          new CategoryTreeItem(
            'ワークスペース',
            'repository',
            workspaceCommands
          )
        );
      }

      return items;
    } else if (element instanceof CategoryTreeItem) {
      // カテゴリ配下のコマンド一覧
      return element.commands.map((cmd) => new CommandTreeItem(cmd));
    }

    return [];
  }
}

export class CommandTreeItem extends vscode.TreeItem {
  constructor(
    public readonly quickCommand: QuickCommand,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.None
  ) {
    super(quickCommand.name, collapsibleState);

    this.tooltip = `${quickCommand.name}\n${
      quickCommand.description || ''
    }\nコマンド: ${quickCommand.command}`;
    this.description = quickCommand.description;
    this.contextValue = 'quickCommand';

    // アイコンの設定
    this.iconPath = quickCommand.isFavorite
      ? new vscode.ThemeIcon('star-full')
      : new vscode.ThemeIcon('terminal');

    // クリック時のコマンド
    this.command = {
      command: 'quick-command.executeCommand',
      title: 'Execute Command',
      arguments: [quickCommand],
    };
  }
}

export class CategoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly category: string,
    public readonly commands: QuickCommand[]
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);

    this.tooltip = `${label} (${commands.length}個のコマンド)`;
    this.description = `${commands.length}個`;
    this.contextValue = 'commandCategory';

    // カテゴリアイコン
    switch (category) {
      case 'favorite':
        this.iconPath = new vscode.ThemeIcon('star');
        break;
      case 'global':
        this.iconPath = new vscode.ThemeIcon('globe');
        break;
      case 'repository':
        this.iconPath = new vscode.ThemeIcon('repo');
        break;
    }
  }
}
