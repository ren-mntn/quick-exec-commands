import * as vscode from 'vscode';
import { CommandManager } from '../commands/commandManager';
import { CommandDirectory, QuickCommand } from '../types';

type TreeItem = CommandTreeItem | DirectoryTreeItem | CategoryTreeItem;

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
    // デバッグモードでのみログを出力
    if (process.env.NODE_ENV === 'development') {
      console.log(
        'QuickCommandProvider.getChildren called',
        element ? element.label : 'root'
      );
    }

    if (!element) {
      // ルートレベル：お気に入り、グローバル、ワークスペースのカテゴリ
      const items: TreeItem[] = [];

      const favoriteCommands = await this.commandManager.getFavoriteCommands();
      if (process.env.NODE_ENV === 'development') {
        console.log('Favorite commands count:', favoriteCommands.length);
      }

      const globalCommands = this.commandManager.getGlobalCommands();
      const globalDirectories = this.commandManager.getGlobalDirectories();
      if (process.env.NODE_ENV === 'development') {
        console.log('Global commands count:', globalCommands.length);
        console.log('Global directories count:', globalDirectories.length);
      }

      const workspaceCommands = this.commandManager.getWorkspaceCommands();
      const workspaceDirectories =
        this.commandManager.getWorkspaceDirectories();
      if (process.env.NODE_ENV === 'development') {
        console.log('Workspace commands count:', workspaceCommands.length);
        console.log(
          'Workspace directories count:',
          workspaceDirectories.length
        );
      }

      // 常にカテゴリを表示（空でも）
      if (favoriteCommands.length > 0) {
        items.push(
          new CategoryTreeItem('Favorites', 'favorite', favoriteCommands)
        );
      }

      // グローバルカテゴリは常に表示
      items.push(
        new CategoryTreeItem(
          'Global',
          'global',
          globalCommands,
          globalDirectories
        )
      );

      // ワークスペースカテゴリは常に表示
      items.push(
        new CategoryTreeItem(
          'Workspace',
          'repository',
          workspaceCommands,
          workspaceDirectories
        )
      );

      if (process.env.NODE_ENV === 'development') {
        console.log('Returning items count:', items.length);
      }
      return items;
    } else if (element instanceof CategoryTreeItem) {
      // カテゴリ配下のディレクトリとコマンド一覧
      const items: TreeItem[] = [];

      // ルートレベルのディレクトリを追加
      const rootDirectories = element.directories.filter(
        (dir) => !dir.path.includes('/')
      );
      for (const directory of rootDirectories) {
        if (element.category !== 'favorite') {
          items.push(
            new DirectoryTreeItem(
              directory,
              element.category as 'global' | 'repository'
            )
          );
        }
      }

      // ルートレベルのコマンドを追加
      const rootCommands = element.commands.filter((cmd) => !cmd.directory);
      for (const command of rootCommands) {
        items.push(new CommandTreeItem(command));
      }

      return items;
    } else if (element instanceof DirectoryTreeItem) {
      // ディレクトリ配下のサブディレクトリとコマンド一覧
      if (!element.directory.isExpanded) {
        return [];
      }

      const items: TreeItem[] = [];
      const allDirectories =
        element.category === 'global'
          ? this.commandManager.getGlobalDirectories()
          : this.commandManager.getWorkspaceDirectories();
      const allCommands =
        element.category === 'global'
          ? this.commandManager.getGlobalCommands()
          : this.commandManager.getWorkspaceCommands();

      // サブディレクトリを追加
      const subDirectories = allDirectories.filter(
        (dir) =>
          dir.path.startsWith(element.directory.path + '/') &&
          dir.path.split('/').length ===
            element.directory.path.split('/').length + 1
      );
      for (const directory of subDirectories) {
        items.push(new DirectoryTreeItem(directory, element.category));
      }

      // ディレクトリ内のコマンドを追加
      const commandsInDirectory = allCommands.filter(
        (cmd) => cmd.directory === element.directory.path
      );
      for (const command of commandsInDirectory) {
        items.push(new CommandTreeItem(command));
      }

      return items;
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
    // 表示名: コマンド名がある場合はコマンド名、ない場合はコマンド本文
    super(quickCommand.name || quickCommand.command, collapsibleState);

    this.tooltip = this.createTooltip();
    this.description = this.createDescription();
    this.contextValue = 'quickCommand';

    // ホバー時の表示を完全に消すためcommandは設定しない
    // クリック処理はTreeViewのselectionイベントで処理
  }

  private createTooltip(): string {
    const lines: string[] = [];

    // 実際に実行されるコマンド
    lines.push(this.quickCommand.command);

    // 説明がある場合は追加
    if (this.quickCommand.description) {
      lines.push(this.quickCommand.description);
    }

    return lines.join('\n');
  }

  private createDescription(): string {
    // コマンド名がある場合のみ説明を表示（コマンド名がない場合は本文が表示名になるため）
    return this.quickCommand.name ? this.quickCommand.description || '' : '';
  }
}

export class DirectoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly directory: CommandDirectory,
    public readonly category: 'global' | 'repository'
  ) {
    super(
      directory.name,
      directory.isExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    this.tooltip = this.createTooltip();
    this.description = directory.description;
    this.contextValue = 'commandDirectory';

    // アイコンの設定
    this.iconPath = this.getDirectoryIcon();

    // クリック処理はTreeViewのselectionイベントで処理
  }

  private getDirectoryIcon(): vscode.ThemeIcon {
    if (this.directory.icon) {
      switch (this.directory.icon) {
        case 'settings':
          return new vscode.ThemeIcon('settings-gear');
        case 'deploy':
          return new vscode.ThemeIcon('rocket');
        case 'cloud':
          return new vscode.ThemeIcon('cloud');
        case 'tools':
          return new vscode.ThemeIcon('tools');
        case 'package':
          return new vscode.ThemeIcon('package');
        case 'network':
          return new vscode.ThemeIcon('globe');
        case 'security':
          return new vscode.ThemeIcon('shield');
        default:
          return new vscode.ThemeIcon('folder');
      }
    }
    return new vscode.ThemeIcon('folder');
  }

  private createTooltip(): string {
    const lines = [`📁 ${this.directory.name}`];

    if (this.directory.description) {
      lines.push(`Description: ${this.directory.description}`);
    }

    lines.push(`Path: ${this.directory.path}`);
    lines.push(`Created: ${this.directory.createdAt.toLocaleString()}`);

    return lines.join('\n');
  }
}

export class CategoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly category: 'global' | 'repository' | 'favorite',
    public readonly commands: QuickCommand[],
    public readonly directories: CommandDirectory[] = []
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);

    this.tooltip = this.createTooltip();
    this.description = this.createDescription();
    this.contextValue = this.getCategoryContextValue();

    // カテゴリアイコン
    this.iconPath = this.getCategoryIcon();
  }

  private createTooltip(): string {
    const lines = [this.label];

    if (this.directories.length > 0) {
      lines.push(`Directories: ${this.directories.length}`);
    }

    lines.push(`Commands: ${this.commands.length}`);

    return lines.join('\n');
  }

  private createDescription(): string {
    // 空の場合は特別なメッセージを表示
    if (this.directories.length === 0 && this.commands.length === 0) {
      return 'Empty';
    }

    return '';
  }

  private getCategoryContextValue(): string {
    switch (this.category) {
      case 'favorite':
        return 'favoriteCategory';
      case 'global':
        return 'globalCategory';
      case 'repository':
        return 'repositoryCategory';
      default:
        return 'commandCategory';
    }
  }

  private getCategoryIcon(): vscode.ThemeIcon {
    switch (this.category) {
      case 'favorite':
        return new vscode.ThemeIcon('star');
      case 'global':
        return new vscode.ThemeIcon('globe');
      case 'repository':
        return new vscode.ThemeIcon('repo');
      default:
        return new vscode.ThemeIcon('folder');
    }
  }
}
