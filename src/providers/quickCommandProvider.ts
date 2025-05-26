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
    console.log('[QuickCommandProvider] Refreshing tree view');
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    console.log(
      '[QuickCommandProvider] getChildren called for:',
      element ? element.label : 'root'
    );

    if (!element) {
      // ルートレベル：お気に入り、グローバル、ワークスペースのカテゴリ
      const items: TreeItem[] = [];

      const favoriteCommands = await this.commandManager.getFavoriteCommands();
      console.log(
        '[QuickCommandProvider] Favorite commands count:',
        favoriteCommands.length
      );
      console.log(
        '[QuickCommandProvider] Favorite commands:',
        favoriteCommands.map((cmd) => ({
          id: cmd.id,
          name: cmd.name,
          command: cmd.command,
          isFavorite: cmd.isFavorite,
        }))
      );

      const globalCommands = this.commandManager.getGlobalCommands();
      const globalDirectories = this.commandManager.getGlobalDirectories();
      console.log(
        '[QuickCommandProvider] Global commands:',
        globalCommands.length,
        'directories:',
        globalDirectories.length
      );

      const workspaceCommands = this.commandManager.getWorkspaceCommands();
      const workspaceDirectories =
        this.commandManager.getWorkspaceDirectories();
      console.log(
        '[QuickCommandProvider] Workspace commands:',
        workspaceCommands.length,
        'directories:',
        workspaceDirectories.length
      );

      // お気に入りカテゴリは常に表示
      items.push(
        new CategoryTreeItem('Favorites', 'favorite', favoriteCommands)
      );

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

      console.log(
        '[QuickCommandProvider] Returning',
        items.length,
        'categories'
      );
      return items;
    } else if (element instanceof CategoryTreeItem) {
      // カテゴリ配下のディレクトリとコマンド一覧
      console.log(
        '[QuickCommandProvider] Processing category:',
        element.category
      );
      const items: TreeItem[] = [];

      // ルートレベルのディレクトリを追加
      const rootDirectories = element.directories.filter(
        (dir) => !dir.path.includes('/')
      );
      console.log(
        '[QuickCommandProvider] Root directories in category:',
        rootDirectories.length
      );
      for (const directory of rootDirectories) {
        if (element.category !== 'favorite') {
          items.push(
            new DirectoryTreeItem(
              directory,
              element.category as 'global' | 'repository',
              this.commandManager
            )
          );
        }
      }

      // コマンドを追加（お気に入りカテゴリの場合はディレクトリに関係なくすべて表示）
      const commandsToShow =
        element.category === 'favorite'
          ? element.commands
          : element.commands.filter((cmd) => !cmd.directory);
      console.log(
        '[QuickCommandProvider] Commands in category:',
        commandsToShow.length
      );
      for (const command of commandsToShow) {
        items.push(new CommandTreeItem(command));
      }

      console.log('[QuickCommandProvider] Category items total:', items.length);
      return items;
    } else if (element instanceof DirectoryTreeItem) {
      // ディレクトリ配下のサブディレクトリとコマンド一覧
      console.log(
        '[QuickCommandProvider] Processing directory:',
        element.directory.name,
        'expanded:',
        element.directory.isExpanded,
        'path:',
        element.directory.path
      );

      // 最新のディレクトリ状態を取得して展開状態をチェック
      const allDirectories =
        element.category === 'global'
          ? this.commandManager.getGlobalDirectories()
          : this.commandManager.getWorkspaceDirectories();

      const currentDirectory = allDirectories.find(
        (dir) => dir.id === element.directory.id
      );
      console.log(
        '[QuickCommandProvider] Current directory from storage:',
        currentDirectory?.isExpanded
      );

      if (!currentDirectory || !currentDirectory.isExpanded) {
        console.log(
          '[QuickCommandProvider] Directory not expanded, returning empty array'
        );
        return [];
      }

      const items: TreeItem[] = [];
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
      console.log(
        '[QuickCommandProvider] Sub directories:',
        subDirectories.length
      );
      for (const directory of subDirectories) {
        items.push(
          new DirectoryTreeItem(
            directory,
            element.category,
            this.commandManager
          )
        );
      }

      // ディレクトリ内のコマンドを追加
      const commandsInDirectory = allCommands.filter(
        (cmd) => cmd.directory === element.directory.path
      );
      console.log(
        '[QuickCommandProvider] Commands in directory:',
        commandsInDirectory.length
      );
      for (const command of commandsInDirectory) {
        items.push(new CommandTreeItem(command));
      }

      console.log(
        '[QuickCommandProvider] Directory items total:',
        items.length
      );
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

    // お気に入り状態に応じたアイコンを設定
    this.iconPath = this.getCommandIcon();

    // コマンド実行のためのcommandを設定
    this.command = {
      command: 'quickExecCommands.executeFromTreeView',
      title: 'Execute Command',
      arguments: [this.quickCommand],
    };

    // デバッグ情報をログに出力
    console.log('[CommandTreeItem] Created command item:', {
      id: this.quickCommand.id,
      name: this.quickCommand.name,
      directory: this.quickCommand.directory,
      contextValue: this.contextValue,
      isFavorite: this.quickCommand.isFavorite,
    });
  }

  private getCommandIcon(): vscode.ThemeIcon | undefined {
    if (this.quickCommand.isFavorite) {
      return new vscode.ThemeIcon('star-full');
    }
    // お気に入りでない場合はアイコンを非表示
    return undefined;
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
    public readonly category: 'global' | 'repository',
    private commandManager?: CommandManager
  ) {
    // 最新の展開状態を取得
    const currentState = DirectoryTreeItem.getCurrentDirectoryState(
      directory,
      category,
      commandManager
    );

    super(
      directory.name,
      currentState.isExpanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    this.tooltip = this.createTooltip();
    this.description = directory.description;
    this.contextValue = 'commandDirectory';

    // アイコンの設定
    this.iconPath = this.getDirectoryIcon();

    console.log(
      '[DirectoryTreeItem] Created:',
      this.directory.name,
      'expanded:',
      currentState.isExpanded,
      'collapsibleState:',
      this.collapsibleState
    );

    // 標準的なTreeView展開・折りたたみ動作を使用
  }

  private static getCurrentDirectoryState(
    directory: CommandDirectory,
    category: 'global' | 'repository',
    commandManager?: CommandManager
  ): CommandDirectory {
    if (!commandManager) {
      return directory;
    }

    const allDirectories =
      category === 'global'
        ? commandManager.getGlobalDirectories()
        : commandManager.getWorkspaceDirectories();

    const currentDirectory = allDirectories.find(
      (dir) => dir.id === directory.id
    );
    return currentDirectory || directory;
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
