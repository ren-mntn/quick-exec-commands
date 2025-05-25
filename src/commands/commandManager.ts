import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  CommandDirectory,
  CommandInput,
  ExecutionHistory,
  QuickCommand,
} from '../types';

export class CommandManager {
  private context: vscode.ExtensionContext;
  private globalStorageKey = 'quickCommand.globalCommands';
  private workspaceStorageKey = 'quickCommand.workspaceCommands';
  private globalDirectoriesKey = 'quickCommand.globalDirectories';
  private workspaceDirectoriesKey = 'quickCommand.workspaceDirectories';
  private executionHistoryKey = 'quickCommand.executionHistory';

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  // === コマンド管理 ===

  // 全コマンドの取得
  async getAllCommands(): Promise<QuickCommand[]> {
    const globalCommands = this.getGlobalCommands();
    const workspaceCommands = this.getWorkspaceCommands();
    return [...globalCommands, ...workspaceCommands];
  }

  // グローバルコマンドの取得
  getGlobalCommands(): QuickCommand[] {
    return this.context.globalState.get(this.globalStorageKey, []);
  }

  // ワークスペースコマンドの取得
  getWorkspaceCommands(): QuickCommand[] {
    return this.context.workspaceState.get(this.workspaceStorageKey, []);
  }

  // ディレクトリ別コマンドの取得
  getCommandsByDirectory(
    category: 'global' | 'repository',
    directory?: string
  ): QuickCommand[] {
    const commands =
      category === 'global'
        ? this.getGlobalCommands()
        : this.getWorkspaceCommands();
    return commands.filter((cmd) => cmd.directory === directory);
  }

  // お気に入りコマンドの取得
  async getFavoriteCommands(): Promise<QuickCommand[]> {
    const allCommands = await this.getAllCommands();
    return allCommands.filter((cmd) => cmd.isFavorite);
  }

  // コマンド検索
  async searchCommands(query: string): Promise<QuickCommand[]> {
    const allCommands = await this.getAllCommands();
    const lowerQuery = query.toLowerCase();
    return allCommands.filter(
      (cmd) =>
        cmd.name?.toLowerCase().includes(lowerQuery) ||
        cmd.command.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery) ||
        cmd.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  // コマンドの追加
  async addCommand(
    command: Omit<
      QuickCommand,
      'id' | 'createdAt' | 'updatedAt' | 'executionCount' | 'lastExecutedAt'
    >
  ): Promise<QuickCommand> {
    const inputs = this.extractInputFields(command.command);
    const newCommand: QuickCommand = {
      ...command,
      id: this.generateId(),
      inputs,
      executionCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (command.category === 'global') {
      const commands = this.getGlobalCommands();
      commands.push(newCommand);
      await this.context.globalState.update(this.globalStorageKey, commands);
    } else {
      const commands = this.getWorkspaceCommands();
      commands.push(newCommand);
      await this.context.workspaceState.update(
        this.workspaceStorageKey,
        commands
      );
    }

    return newCommand;
  }

  // コマンドの更新
  async updateCommand(
    id: string,
    updates: Partial<QuickCommand>
  ): Promise<void> {
    const globalCommands = this.getGlobalCommands();
    const workspaceCommands = this.getWorkspaceCommands();

    let updated = false;

    // グローバルコマンドから検索
    const globalIndex = globalCommands.findIndex((cmd) => cmd.id === id);
    if (globalIndex !== -1) {
      globalCommands[globalIndex] = {
        ...globalCommands[globalIndex],
        ...updates,
        updatedAt: new Date(),
      };
      await this.context.globalState.update(
        this.globalStorageKey,
        globalCommands
      );
      updated = true;
    }

    // ワークスペースコマンドから検索
    const workspaceIndex = workspaceCommands.findIndex((cmd) => cmd.id === id);
    if (workspaceIndex !== -1) {
      workspaceCommands[workspaceIndex] = {
        ...workspaceCommands[workspaceIndex],
        ...updates,
        updatedAt: new Date(),
      };
      await this.context.workspaceState.update(
        this.workspaceStorageKey,
        workspaceCommands
      );
      updated = true;
    }

    if (!updated) {
      throw new Error(`コマンドが見つかりません: ${id}`);
    }
  }

  // コマンドの削除
  async deleteCommand(id: string): Promise<void> {
    const globalCommands = this.getGlobalCommands();
    const workspaceCommands = this.getWorkspaceCommands();

    let deleted = false;

    // グローバルコマンドから削除
    const globalFiltered = globalCommands.filter((cmd) => cmd.id !== id);
    if (globalFiltered.length !== globalCommands.length) {
      await this.context.globalState.update(
        this.globalStorageKey,
        globalFiltered
      );
      deleted = true;
    }

    // ワークスペースコマンドから削除
    const workspaceFiltered = workspaceCommands.filter((cmd) => cmd.id !== id);
    if (workspaceFiltered.length !== workspaceCommands.length) {
      await this.context.workspaceState.update(
        this.workspaceStorageKey,
        workspaceFiltered
      );
      deleted = true;
    }

    if (!deleted) {
      throw new Error(`コマンドが見つかりません: ${id}`);
    }
  }

  // お気に入りの切り替え
  async toggleFavorite(id: string): Promise<void> {
    const allCommands = await this.getAllCommands();
    const command = allCommands.find((cmd) => cmd.id === id);

    if (!command) {
      throw new Error(`コマンドが見つかりません: ${id}`);
    }

    await this.updateCommand(id, { isFavorite: !command.isFavorite });
  }

  // === ディレクトリ管理 ===

  // 全ディレクトリの取得
  async getAllDirectories(): Promise<CommandDirectory[]> {
    const globalDirectories = this.getGlobalDirectories();
    const workspaceDirectories = this.getWorkspaceDirectories();
    return [...globalDirectories, ...workspaceDirectories];
  }

  // グローバルディレクトリの取得
  getGlobalDirectories(): CommandDirectory[] {
    return this.context.globalState.get(this.globalDirectoriesKey, []);
  }

  // ワークスペースディレクトリの取得
  getWorkspaceDirectories(): CommandDirectory[] {
    return this.context.workspaceState.get(this.workspaceDirectoriesKey, []);
  }

  // ディレクトリの追加
  async addDirectory(
    directory: Omit<CommandDirectory, 'id' | 'createdAt'>
  ): Promise<CommandDirectory> {
    const newDirectory: CommandDirectory = {
      ...directory,
      id: this.generateId(),
      createdAt: new Date(),
    };

    if (directory.category === 'global') {
      const directories = this.getGlobalDirectories();
      directories.push(newDirectory);
      await this.context.globalState.update(
        this.globalDirectoriesKey,
        directories
      );
    } else {
      const directories = this.getWorkspaceDirectories();
      directories.push(newDirectory);
      await this.context.workspaceState.update(
        this.workspaceDirectoriesKey,
        directories
      );
    }

    return newDirectory;
  }

  // ディレクトリの削除
  async deleteDirectory(id: string): Promise<void> {
    const globalDirectories = this.getGlobalDirectories();
    const workspaceDirectories = this.getWorkspaceDirectories();

    let deleted = false;
    let directory: CommandDirectory | undefined;

    // 削除対象ディレクトリを特定
    directory =
      globalDirectories.find((dir) => dir.id === id) ||
      workspaceDirectories.find((dir) => dir.id === id);

    if (!directory) {
      throw new Error(`ディレクトリが見つかりません: ${id}`);
    }

    // ディレクトリ内のコマンドも削除
    const allCommands = await this.getAllCommands();
    const commandsInDirectory = allCommands.filter(
      (cmd) => cmd.directory === directory!.path
    );

    for (const command of commandsInDirectory) {
      await this.deleteCommand(command.id);
    }

    // グローバルディレクトリから削除
    const globalFiltered = globalDirectories.filter((dir) => dir.id !== id);
    if (globalFiltered.length !== globalDirectories.length) {
      await this.context.globalState.update(
        this.globalDirectoriesKey,
        globalFiltered
      );
      deleted = true;
    }

    // ワークスペースディレクトリから削除
    const workspaceFiltered = workspaceDirectories.filter(
      (dir) => dir.id !== id
    );
    if (workspaceFiltered.length !== workspaceDirectories.length) {
      await this.context.workspaceState.update(
        this.workspaceDirectoriesKey,
        workspaceFiltered
      );
      deleted = true;
    }

    if (!deleted) {
      throw new Error(`ディレクトリが見つかりません: ${id}`);
    }
  }

  // ディレクトリの展開/折りたたみ切り替え
  async toggleDirectoryExpansion(id: string): Promise<void> {
    const globalDirectories = this.getGlobalDirectories();
    const workspaceDirectories = this.getWorkspaceDirectories();

    let updated = false;

    // グローバルディレクトリから検索
    const globalIndex = globalDirectories.findIndex((dir) => dir.id === id);
    if (globalIndex !== -1) {
      globalDirectories[globalIndex].isExpanded =
        !globalDirectories[globalIndex].isExpanded;
      await this.context.globalState.update(
        this.globalDirectoriesKey,
        globalDirectories
      );
      updated = true;
    }

    // ワークスペースディレクトリから検索
    const workspaceIndex = workspaceDirectories.findIndex(
      (dir) => dir.id === id
    );
    if (workspaceIndex !== -1) {
      workspaceDirectories[workspaceIndex].isExpanded =
        !workspaceDirectories[workspaceIndex].isExpanded;
      await this.context.workspaceState.update(
        this.workspaceDirectoriesKey,
        workspaceDirectories
      );
      updated = true;
    }

    if (!updated) {
      throw new Error(`ディレクトリが見つかりません: ${id}`);
    }
  }

  // === 実行履歴 ===

  // 実行履歴の取得
  getExecutionHistory(): ExecutionHistory[] {
    return this.context.globalState.get(this.executionHistoryKey, []);
  }

  // 実行履歴の追加
  private async addExecutionHistory(
    command: QuickCommand,
    success: boolean,
    duration?: number
  ): Promise<void> {
    const history = this.getExecutionHistory();
    const newEntry: ExecutionHistory = {
      id: this.generateId(),
      commandId: command.id,
      commandName: command.name || command.command,
      command: command.command,
      executedAt: new Date(),
      success,
      duration,
    };

    history.unshift(newEntry); // 最新を先頭に

    // 履歴は100件まで保持
    if (history.length > 100) {
      history.splice(100);
    }

    await this.context.globalState.update(this.executionHistoryKey, history);
  }

  // === エクスポート/インポート ===

  // コマンドのエクスポート
  async exportCommands(category?: 'global' | 'repository'): Promise<string> {
    const commands = category
      ? category === 'global'
        ? this.getGlobalCommands()
        : this.getWorkspaceCommands()
      : await this.getAllCommands();

    const directories = category
      ? category === 'global'
        ? this.getGlobalDirectories()
        : this.getWorkspaceDirectories()
      : await this.getAllDirectories();

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      commands,
      directories,
    };

    return JSON.stringify(exportData, null, 2);
  }

  // コマンドのインポート
  async importCommands(
    jsonData: string,
    category: 'global' | 'repository'
  ): Promise<number> {
    try {
      const importData = JSON.parse(jsonData);
      let importedCount = 0;

      // ディレクトリのインポート
      if (importData.directories) {
        for (const dir of importData.directories) {
          const newDir = {
            ...dir,
            category,
            isExpanded: false,
          };
          delete newDir.id;
          delete newDir.createdAt;
          await this.addDirectory(newDir);
        }
      }

      // コマンドのインポート
      if (importData.commands) {
        for (const cmd of importData.commands) {
          const newCmd = {
            ...cmd,
            category,
            isFavorite: false,
            executionCount: 0,
          };
          delete newCmd.id;
          delete newCmd.createdAt;
          delete newCmd.updatedAt;
          delete newCmd.lastExecutedAt;
          await this.addCommand(newCmd);
          importedCount++;
        }
      }

      return importedCount;
    } catch (error) {
      throw new Error(
        `インポートに失敗しました: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  // === コマンド実行 ===

  // コマンドの実行
  async executeCommand(command: QuickCommand): Promise<void> {
    const startTime = Date.now();
    let success = true;

    try {
      let finalCommand = command.command;

      // 入力が必要な場合
      if (command.inputs && command.inputs.length > 0) {
        const inputs: { [key: string]: string } = {};

        for (const input of command.inputs) {
          const value = await vscode.window.showInputBox({
            prompt: input.placeholder,
            validateInput: (text) => {
              if (input.required && !text.trim()) {
                return '入力は必須です';
              }
              return null;
            },
          });

          if (value === undefined) {
            // キャンセルされた場合
            return;
          }

          inputs[input.id] = value;
        }

        // コマンド内の変数を置換
        finalCommand = this.replaceCommandInputs(
          command.command,
          command.inputs,
          inputs
        );
      }

      // コマンドタイプに応じて実行方法を変更
      if (command.commandType === 'vscode') {
        // VS Codeコマンドを実行
        const parts = finalCommand.split(' ');
        const commandId = parts[0];
        const args = parts.slice(1);

        if (args.length > 0) {
          // 引数がある場合は JSON として解析を試みる
          try {
            const parsedArgs = args.map((arg) => {
              try {
                return JSON.parse(arg);
              } catch {
                return arg; // JSON として解析できない場合は文字列として扱う
              }
            });
            await vscode.commands.executeCommand(commandId, ...parsedArgs);
          } catch {
            // 引数の解析に失敗した場合は引数なしで実行
            await vscode.commands.executeCommand(commandId);
          }
        } else {
          await vscode.commands.executeCommand(commandId);
        }
      } else {
        // ターミナルでコマンドを実行（デフォルト）
        const terminal =
          vscode.window.activeTerminal ||
          vscode.window.createTerminal('Quick Command');
        terminal.show();
        terminal.sendText(finalCommand);
      }

      // 実行回数を更新
      await this.updateCommand(command.id, {
        executionCount: (command.executionCount || 0) + 1,
        lastExecutedAt: new Date(),
      });
    } catch (error) {
      success = false;
      vscode.window.showErrorMessage(
        `コマンド実行エラー: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      const duration = Date.now() - startTime;
      await this.addExecutionHistory(command, success, duration);
    }
  }

  // === ダイアログ ===

  // コマンド追加ダイアログ
  async addCommandDialog(targetDirectory?: string): Promise<void> {
    // 最初にコマンドタイプを選択
    const commandType = await vscode.window.showQuickPick(
      [
        {
          label: '🖥️ ターミナルコマンド',
          description:
            'ターミナルで実行されるコマンド（npm, git, docker など）',
          value: 'terminal' as const,
        },
        {
          label: '⚙️ VS Codeコマンド',
          description: 'VS Code内部のコマンド（ファイル保存、設定など）',
          value: 'vscode' as const,
        },
      ],
      {
        placeHolder: 'どの種類のコマンドを追加しますか？',
      }
    );

    if (!commandType) return;

    let command: string;
    let name: string | undefined;
    let description: string | undefined;

    if (commandType.value === 'vscode') {
      // VS Codeコマンドの場合：利用可能なコマンドから選択
      const availableCommands = await vscode.commands.getCommands(true);

      // よく使われるコマンドを上位に表示
      const popularCommands = [
        'workbench.action.files.save',
        'workbench.action.files.saveAll',
        'workbench.action.quickOpen',
        'workbench.action.showCommands',
        'workbench.action.toggleSidebarVisibility',
        'workbench.action.togglePanel',
        'editor.action.formatDocument',
        'workbench.action.reloadWindow',
        'workbench.action.openSettings',
        'workbench.action.openKeybindings',
        'workbench.view.explorer',
        'workbench.view.search',
        'workbench.view.scm',
        'workbench.view.debug',
        'workbench.view.extensions',
      ];

      const commandItems = [
        // 人気コマンドを先頭に
        ...popularCommands.map((cmd) => ({
          label: cmd,
          description: '⭐ よく使用されるコマンド',
          value: cmd,
        })),
        // 残りのコマンド
        ...availableCommands
          .filter((cmd) => !popularCommands.includes(cmd))
          .sort()
          .map((cmd) => ({
            label: cmd,
            description: '',
            value: cmd,
          })),
      ];

      const selectedCommand = await vscode.window.showQuickPick(commandItems, {
        placeHolder: 'VS Codeコマンドを選択してください（検索可能）',
        matchOnDescription: true,
      });

      if (!selectedCommand) return;
      command = selectedCommand.value;

      // コマンド名の入力（オプション）
      name = await vscode.window.showInputBox({
        prompt: 'コマンドの表示名を入力してください（オプション）',
        placeHolder: `例: ${this.getCommandDisplayName(command)}`,
        validateInput: () => null,
      });

      // 説明の入力（オプション）
      description = await vscode.window.showInputBox({
        prompt: 'コマンドの説明を入力してください（オプション）',
        placeHolder: this.getCommandDescription(command),
      });
    } else {
      // ターミナルコマンドの場合：履歴から選択または手動入力
      const suggestedCommands = await this.getSuggestedCommands();

      if (suggestedCommands.length > 0) {
        // 履歴から選択するか手動入力するかを選択
        const inputMethod = await vscode.window.showQuickPick(
          [
            {
              label: '📝 コマンドを手動入力',
              description: '新しいコマンドを入力します',
              value: 'manual' as const,
            },
            {
              label: '📋 履歴から選択',
              description: `${suggestedCommands.length}件の履歴から選択します`,
              value: 'history' as const,
            },
          ],
          {
            placeHolder: 'コマンドの入力方法を選択してください',
          }
        );

        if (!inputMethod) return;

        if (inputMethod.value === 'history') {
          // 履歴から選択
          const historyItems = suggestedCommands.map((cmd, index) => ({
            label: cmd,
            description: `使用頻度: 高`,
            detail: index < 5 ? '⭐ よく使用される' : '',
            value: cmd,
          }));

          const selectedFromHistory = await vscode.window.showQuickPick(
            historyItems,
            {
              placeHolder: '履歴からコマンドを選択してください',
              matchOnDescription: false,
            }
          );

          if (!selectedFromHistory) return;
          command = selectedFromHistory.value;

          // 選択されたコマンドから推奨名を生成
          name = this.generateCommandName(command);
        } else {
          // 手動入力
          const commandInput = await vscode.window.showInputBox({
            prompt: 'コマンドを入力してください',
            placeHolder: '例: git status, npm start, docker build -t myapp .',
            validateInput: (text) => {
              if (!text.trim()) {
                return 'コマンドは必須です';
              }
              return null;
            },
          });

          if (!commandInput) return;
          command = commandInput;
        }
      } else {
        // 履歴が空の場合は従来通り手動入力
        const commandInput = await vscode.window.showInputBox({
          prompt: 'コマンドを入力してください',
          placeHolder: '例: git status, npm start, docker build -t myapp .',
          validateInput: (text) => {
            if (!text.trim()) {
              return 'コマンドは必須です';
            }
            return null;
          },
        });

        if (!commandInput) return;
        command = commandInput;
      }

      // コマンド名の入力（履歴から選択した場合は推奨名が設定済み）
      const nameInput = await vscode.window.showInputBox({
        value: name || '',
        prompt: 'コマンド名を入力してください（オプション）',
        placeHolder: name || '例: Git Status',
        validateInput: () => null,
      });

      if (nameInput === undefined) return;
      name = nameInput;

      description = await vscode.window.showInputBox({
        prompt: 'コマンドの説明を入力してください（オプション）',
        placeHolder: 'このコマンドの説明',
      });
    }

    // 共通設定
    const category = await vscode.window.showQuickPick(
      [
        { label: 'ワークスペース', value: 'repository' as const },
        { label: 'グローバル', value: 'global' as const },
      ],
      {
        placeHolder: 'コマンドの保存範囲を選択してください',
      }
    );

    if (!category) return;

    const isFavorite = await vscode.window.showQuickPick(
      [
        { label: 'いいえ', value: false },
        { label: 'はい', value: true },
      ],
      {
        placeHolder: 'お気に入りに追加しますか？',
      }
    );

    if (isFavorite === undefined) return;

    const inputs = this.extractInputFields(command);

    await this.addCommand({
      name: name && name.trim() ? name.trim() : undefined,
      command,
      description: description || undefined,
      category: category.value,
      isFavorite: isFavorite.value,
      inputs,
      directory: targetDirectory,
      tags: [],
      commandType: commandType.value,
    });

    const displayName = name && name.trim() ? name.trim() : command;
    vscode.window.showInformationMessage(
      `コマンド "${displayName}" を追加しました`
    );
  }

  // ディレクトリ追加ダイアログ
  async addDirectoryDialog(
    category: 'global' | 'repository',
    parentPath?: string
  ): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: 'ディレクトリ名を入力してください',
      validateInput: (text) => {
        if (!text.trim()) {
          return 'ディレクトリ名は必須です';
        }
        if (text.includes('/')) {
          return 'ディレクトリ名にスラッシュは使用できません';
        }
        return null;
      },
    });

    if (!name) return;

    const description = await vscode.window.showInputBox({
      prompt: 'ディレクトリの説明を入力してください（オプション）',
    });

    const icon = await vscode.window.showQuickPick(
      [
        { label: '📁 フォルダ', value: 'folder' },
        { label: '⚙️ 設定', value: 'settings' },
        { label: '🚀 デプロイ', value: 'deploy' },
        { label: '☁️ クラウド', value: 'cloud' },
        { label: '🔧 ツール', value: 'tools' },
        { label: '📦 パッケージ', value: 'package' },
        { label: '🌐 ネットワーク', value: 'network' },
        { label: '🔒 セキュリティ', value: 'security' },
      ],
      {
        placeHolder: 'アイコンを選択してください',
      }
    );

    const path = parentPath ? `${parentPath}/${name}` : name;

    await this.addDirectory({
      name,
      path,
      category,
      isExpanded: true,
      description: description || undefined,
      icon: icon?.value,
    });

    vscode.window.showInformationMessage(
      `ディレクトリ "${name}" を追加しました`
    );
  }

  // === プライベートメソッド ===

  private extractInputFields(command: string): CommandInput[] {
    const regex = /\[([^\]]+)\]/g;
    const inputs: CommandInput[] = [];
    let match;
    let index = 0;

    while ((match = regex.exec(command)) !== null) {
      inputs.push({
        id: `input_${index}`,
        placeholder: match[1],
        position: match.index,
        required: true,
      });
      index++;
    }

    return inputs;
  }

  private replaceCommandInputs(
    command: string,
    inputs: CommandInput[],
    values: { [key: string]: string }
  ): string {
    let result = command;

    // 後ろから置換して位置がずれないようにする
    const sortedInputs = [...inputs].sort((a, b) => b.position - a.position);

    for (const input of sortedInputs) {
      const value = values[input.id] || '';
      const placeholder = `[${input.placeholder}]`;
      const index = result.indexOf(placeholder);
      if (index !== -1) {
        result =
          result.substring(0, index) +
          value +
          result.substring(index + placeholder.length);
      }
    }

    return result;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // VS Codeコマンドの表示名を取得するヘルパーメソッド
  private getCommandDisplayName(command: string): string {
    const displayNames: { [key: string]: string } = {
      'workbench.action.files.save': 'ファイルを保存',
      'workbench.action.files.saveAll': '全ファイルを保存',
      'workbench.action.quickOpen': 'クイックオープン',
      'workbench.action.showCommands': 'コマンドパレット',
      'workbench.action.toggleSidebarVisibility': 'サイドバー表示切り替え',
      'workbench.action.togglePanel': 'パネル表示切り替え',
      'editor.action.formatDocument': 'ドキュメントフォーマット',
      'workbench.action.reloadWindow': 'ウィンドウリロード',
      'workbench.action.openSettings': '設定を開く',
      'workbench.action.openKeybindings': 'キーボードショートカット',
      'workbench.view.explorer': 'エクスプローラーを表示',
      'workbench.view.search': '検索を表示',
      'workbench.view.scm': 'ソース管理を表示',
      'workbench.view.debug': 'デバッグを表示',
      'workbench.view.extensions': '拡張機能を表示',
    };
    return displayNames[command] || command;
  }

  // VS Codeコマンドの説明を取得するヘルパーメソッド
  private getCommandDescription(command: string): string {
    const descriptions: { [key: string]: string } = {
      'workbench.action.files.save': '現在のファイルを保存します',
      'workbench.action.files.saveAll':
        '開いているすべてのファイルを保存します',
      'workbench.action.quickOpen': 'ファイル検索ダイアログを開きます',
      'workbench.action.showCommands': 'コマンドパレットを表示します',
      'workbench.action.toggleSidebarVisibility':
        'サイドバーの表示/非表示を切り替えます',
      'workbench.action.togglePanel': 'パネルの表示/非表示を切り替えます',
      'editor.action.formatDocument': '現在のドキュメントをフォーマットします',
      'workbench.action.reloadWindow': 'VS Codeウィンドウを再読み込みします',
      'workbench.action.openSettings': 'VS Codeの設定画面を開きます',
      'workbench.action.openKeybindings':
        'キーボードショートカットの設定を開きます',
      'workbench.view.explorer': 'エクスプローラービューを表示します',
      'workbench.view.search': '検索ビューを表示します',
      'workbench.view.scm': 'ソース管理ビューを表示します',
      'workbench.view.debug': 'デバッグビューを表示します',
      'workbench.view.extensions': '拡張機能ビューを表示します',
    };
    return descriptions[command] || 'VS Codeコマンドを実行します';
  }

  // === シェル履歴管理 ===

  // シェル履歴の取得
  async getShellHistory(): Promise<string[]> {
    const homeDir = os.homedir();
    const historyFiles = [
      // bash
      path.join(homeDir, '.bash_history'),
      // zsh
      path.join(homeDir, '.zsh_history'),
      // fish
      path.join(homeDir, '.config', 'fish', 'fish_history'),
    ];

    const commands: string[] = [];
    const commandCount = new Map<string, number>();

    for (const historyFile of historyFiles) {
      try {
        if (fs.existsSync(historyFile)) {
          const content = fs.readFileSync(historyFile, 'utf8');
          const historyCommands = this.parseHistoryFile(historyFile, content);

          // コマンドの頻度をカウント
          historyCommands.forEach((cmd) => {
            const trimmedCmd = cmd.trim();
            if (trimmedCmd && !this.shouldSkipCommand(trimmedCmd)) {
              commandCount.set(
                trimmedCmd,
                (commandCount.get(trimmedCmd) || 0) + 1
              );
            }
          });
        }
      } catch (error) {
        console.warn(`履歴ファイルの読み取りに失敗: ${historyFile}`, error);
      }
    }

    // 頻度順でソートして重複を除去
    const sortedCommands = Array.from(commandCount.entries())
      .sort((a, b) => b[1] - a[1]) // 頻度の降順
      .map(([cmd]) => cmd)
      .slice(0, 50); // 上位50件

    return sortedCommands;
  }

  // 履歴ファイルの解析
  private parseHistoryFile(filePath: string, content: string): string[] {
    const commands: string[] = [];

    if (filePath.includes('.zsh_history')) {
      // zsh履歴の形式: : <timestamp>:<duration>;<command>
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/^: \d+:\d+;(.+)$/);
        if (match) {
          commands.push(match[1]);
        } else if (line.trim() && !line.startsWith(':')) {
          // シンプルな形式の場合
          commands.push(line.trim());
        }
      }
    } else if (filePath.includes('fish_history')) {
      // fish履歴の形式: - cmd: <command>
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/^- cmd: (.+)$/);
        if (match) {
          commands.push(match[1]);
        }
      }
    } else {
      // bash履歴（シンプルな行ごとの形式）
      commands.push(...content.split('\n').filter((line) => line.trim()));
    }

    return commands;
  }

  // スキップすべきコマンドの判定
  private shouldSkipCommand(command: string): boolean {
    const skipPatterns = [
      /^cd\s/, // cd コマンド
      /^ls\s*$/, // ls コマンド（引数なし）
      /^pwd\s*$/, // pwd コマンド
      /^clear\s*$/, // clear コマンド
      /^exit\s*$/, // exit コマンド
      /^history\s*$/, // history コマンド
      /^echo\s+["']/, // 簡単な echo コマンド
      /^\s*$/, // 空行
      /^#/, // コメント行
    ];

    return skipPatterns.some((pattern) => pattern.test(command));
  }

  // よく使われるコマンドの取得（既存コマンドとの重複チェック付き）
  async getSuggestedCommands(): Promise<string[]> {
    const shellHistory = await this.getShellHistory();
    const existingCommands = await this.getAllCommands();
    const existingCommandTexts = new Set(
      existingCommands.map((cmd) => cmd.command.toLowerCase())
    );

    // 既に登録されていないコマンドのみを返す
    return shellHistory.filter(
      (cmd) => !existingCommandTexts.has(cmd.toLowerCase())
    );
  }

  // コマンドから推奨名を生成
  private generateCommandName(command: string): string {
    // よく知られたコマンドのマッピング
    const commandNames: { [key: string]: string } = {
      'git status': 'Git Status',
      'git add .': 'Git Add All',
      'git commit': 'Git Commit',
      'git push': 'Git Push',
      'git pull': 'Git Pull',
      'npm install': 'NPM Install',
      'npm start': 'NPM Start',
      'npm run dev': 'NPM Dev',
      'npm run build': 'NPM Build',
      'npm test': 'NPM Test',
      'yarn install': 'Yarn Install',
      'yarn start': 'Yarn Start',
      'docker build': 'Docker Build',
      'docker run': 'Docker Run',
      'docker ps': 'Docker PS',
      'docker stop': 'Docker Stop',
      'node --version': 'Node Version',
      'npm --version': 'NPM Version',
    };

    // 完全一致チェック
    const exactMatch = commandNames[command.toLowerCase()];
    if (exactMatch) {
      return exactMatch;
    }

    // 部分一致チェック
    for (const [pattern, name] of Object.entries(commandNames)) {
      if (command.toLowerCase().includes(pattern)) {
        return name;
      }
    }

    // パターンベースの名前生成
    if (command.startsWith('git ')) {
      const subCommand = command.substring(4).split(' ')[0];
      return `Git ${subCommand.charAt(0).toUpperCase() + subCommand.slice(1)}`;
    }

    if (command.startsWith('npm ')) {
      const subCommand = command.substring(4).split(' ')[0];
      return `NPM ${subCommand.charAt(0).toUpperCase() + subCommand.slice(1)}`;
    }

    if (command.startsWith('docker ')) {
      const subCommand = command.substring(7).split(' ')[0];
      return `Docker ${
        subCommand.charAt(0).toUpperCase() + subCommand.slice(1)
      }`;
    }

    if (command.startsWith('yarn ')) {
      const subCommand = command.substring(5).split(' ')[0];
      return `Yarn ${subCommand.charAt(0).toUpperCase() + subCommand.slice(1)}`;
    }

    // 最初の単語を大文字にして返す
    const firstWord = command.split(' ')[0];
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
  }
}
