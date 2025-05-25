import * as vscode from 'vscode';
import { CommandManager } from './commands/commandManager';
import { createDemoCommands } from './commands/demoCommands';
import { QuickCommandProvider } from './providers/quickCommandProvider';
import { QuickCommand } from './types';
import { WebviewProvider } from './webview/webviewProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('Quick Command拡張機能がアクティブになりました');

  // コマンドマネージャーの初期化
  const commandManager = new CommandManager(context);

  // WebViewプロバイダーの初期化
  const webviewProvider = new WebviewProvider(
    context.extensionUri,
    commandManager
  );

  // ツリービュープロバイダーの初期化
  const quickCommandProvider = new QuickCommandProvider(commandManager);

  // ツリービューの登録
  const treeView = vscode.window.createTreeView('quickCommandPanel', {
    treeDataProvider: quickCommandProvider,
    showCollapseAll: true,
    canSelectMany: false,
  });

  // TreeViewの展開状態変更イベントを監視
  const expansionHandler = treeView.onDidExpandElement(async (e) => {
    console.log('[Extension] TreeView element expanded:', e.element.label);
    // DirectoryTreeItemの場合は状態を保存
    if ((e.element as any).directory) {
      const directory = (e.element as any).directory;
      if (!directory.isExpanded) {
        console.log(
          '[Extension] Saving expanded state for directory:',
          directory.name
        );
        await commandManager.toggleDirectoryExpansion(directory.id);
      }
    }
  });

  const collapseHandler = treeView.onDidCollapseElement(async (e) => {
    console.log('[Extension] TreeView element collapsed:', e.element.label);
    // DirectoryTreeItemの場合は状態を保存
    if ((e.element as any).directory) {
      const directory = (e.element as any).directory;
      if (directory.isExpanded) {
        console.log(
          '[Extension] Saving collapsed state for directory:',
          directory.name
        );
        await commandManager.toggleDirectoryExpansion(directory.id);
      }
    }
  });

  // 階層的なコマンドリスト表示機能
  async function showHierarchicalCommandList() {
    // ステップ1: カテゴリ選択
    const categorySelected = await showCategorySelection();
    if (!categorySelected) return;

    // ステップ2: ディレクトリ・コマンド選択
    await showDirectoryAndCommandSelection(categorySelected.category);
  }

  async function showCategorySelection(): Promise<
    | { category: 'favorite' | 'global' | 'repository'; label: string }
    | undefined
  > {
    const favoriteCommands = await commandManager.getFavoriteCommands();
    const globalCommands = commandManager.getGlobalCommands();
    const workspaceCommands = commandManager.getWorkspaceCommands();

    const items = [];

    // お気に入りカテゴリ
    if (favoriteCommands.length > 0) {
      items.push({
        label: 'Favorites',
        description: '',
        category: 'favorite' as const,
      });
    }

    // ワークスペースカテゴリ
    if (
      workspaceCommands.length > 0 ||
      commandManager.getWorkspaceDirectories().length > 0
    ) {
      items.push({
        label: 'Workspace',
        description: '',
        category: 'repository' as const,
      });
    }

    // グローバルカテゴリ
    if (
      globalCommands.length > 0 ||
      commandManager.getGlobalDirectories().length > 0
    ) {
      items.push({
        label: 'Global',
        description: '',
        category: 'global' as const,
      });
    }

    if (items.length === 0) {
      vscode.window.showInformationMessage(
        'No commands found. Create some commands first!'
      );
      return;
    }

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select category',
      matchOnDescription: true,
    });

    return selected;
  }

  async function showDirectoryAndCommandSelection(
    category: 'favorite' | 'global' | 'repository',
    currentPath?: string
  ): Promise<void> {
    const items = [];

    if (category === 'favorite') {
      // 戻るボタンを追加
      items.push({
        label: '📂 .. (Back)',
        description: 'Go back to categories',
        type: 'back' as const,
      });

      // お気に入りコマンドを表示
      const favoriteCommands = await commandManager.getFavoriteCommands();
      for (const cmd of favoriteCommands) {
        items.push({
          label: cmd.name || cmd.command,
          description: cmd.name ? cmd.description || '' : cmd.description || '',
          detail: cmd.name
            ? cmd.command
            : cmd.description
            ? cmd.description
            : '',
          type: 'command' as const,
          command: cmd,
        });
      }
    } else {
      // ディレクトリとコマンドを表示
      const commands =
        category === 'global'
          ? commandManager.getGlobalCommands()
          : commandManager.getWorkspaceCommands();
      const directories =
        category === 'global'
          ? commandManager.getGlobalDirectories()
          : commandManager.getWorkspaceDirectories();

      // 現在のパス配下のディレクトリを取得
      const currentDirectories = directories.filter((dir) => {
        if (!currentPath) {
          // ルートレベルのディレクトリ
          return !dir.path.includes('/');
        } else {
          // 現在のパス配下の直接の子ディレクトリ
          return (
            dir.path.startsWith(currentPath + '/') &&
            dir.path.split('/').length === currentPath.split('/').length + 1
          );
        }
      });

      // 現在のパス配下のコマンドを取得
      const currentCommands = commands.filter(
        (cmd) => cmd.directory === currentPath
      );

      // 戻るボタン（すべての階層で表示）
      items.push({
        label: '📂 .. (Back)',
        description: currentPath
          ? 'Go back to parent directory'
          : 'Go back to categories',
        type: 'back' as const,
      });

      // ディレクトリを追加
      for (const dir of currentDirectories) {
        items.push({
          label: `📁 ${dir.name}`,
          description: dir.description || '',
          detail: dir.path,
          type: 'directory' as const,
          directory: dir,
        });
      }

      // コマンドを追加
      for (const cmd of currentCommands) {
        items.push({
          label: cmd.name || cmd.command,
          description: cmd.name ? cmd.description || '' : cmd.description || '',
          detail: cmd.name
            ? cmd.command
            : cmd.description
            ? cmd.description
            : '',
          type: 'command' as const,
          command: cmd,
        });
      }
    }

    if (items.length === 0) {
      const pathDisplay = currentPath ? ` in ${currentPath}` : '';
      vscode.window.showInformationMessage(`No items found${pathDisplay}`);
      return;
    }

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: currentPath
        ? `Items in ${currentPath}`
        : `Items in ${category}`,
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (!selected) return;

    if (selected.type === 'command') {
      // コマンド実行
      await commandManager.executeCommand(selected.command);
    } else if (selected.type === 'directory') {
      // ディレクトリに移動
      await showDirectoryAndCommandSelection(category, selected.directory.path);
    } else if (selected.type === 'back') {
      // 親ディレクトリに戻る、またはカテゴリ選択に戻る
      if (currentPath) {
        const parentPath =
          currentPath.split('/').slice(0, -1).join('/') || undefined;
        await showDirectoryAndCommandSelection(
          category,
          parentPath || undefined
        );
      } else {
        // ルートレベルの場合はカテゴリ選択に戻る
        await showHierarchicalCommandList();
      }
    }
  }

  // コマンドの登録
  const commands = [
    // パネル表示コマンド
    vscode.commands.registerCommand('quickExecCommands.showPanel', () => {
      webviewProvider.createOrShowWebview();
    }),

    // コマンドリスト表示コマンド（階層ナビゲーション対応）
    vscode.commands.registerCommand(
      'quickExecCommands.showCommandList',
      async () => {
        await showHierarchicalCommandList();
      }
    ),

    // コマンド追加コマンド
    vscode.commands.registerCommand(
      'quickExecCommands.addCommand',
      async () => {
        await commandManager.addCommandDialog();
        quickCommandProvider.refresh();
      }
    ),

    // ディレクトリにコマンド追加
    vscode.commands.registerCommand(
      'quickExecCommands.addCommandToDirectory',
      async (item: any) => {
        let targetDirectory: string | undefined;
        let category: 'global' | 'repository' = 'global';

        if (item && item.category) {
          category = item.category === 'repository' ? 'repository' : 'global';
        }
        if (item && item.directory) {
          targetDirectory = item.directory.path;
        }

        await commandManager.addCommandDialog(targetDirectory);
        quickCommandProvider.refresh();
      }
    ),

    // ディレクトリ追加コマンド
    vscode.commands.registerCommand(
      'quickExecCommands.addDirectory',
      async (item: any) => {
        let category: 'global' | 'repository' = 'global';
        let parentPath: string | undefined;

        if (item && item.category) {
          category = item.category === 'repository' ? 'repository' : 'global';
        }
        if (item && item.directory) {
          parentPath = item.directory.path;
        }

        await commandManager.addDirectoryDialog(category, parentPath);
        quickCommandProvider.refresh();
      }
    ),

    // ディレクトリ削除コマンド
    vscode.commands.registerCommand(
      'quickExecCommands.deleteDirectory',
      async (item: any) => {
        if (!item.directory) return;

        const confirmed = await vscode.window.showWarningMessage(
          vscode.l10n.t('message.confirmDeleteDirectory', item.directory.name),
          vscode.l10n.t('message.delete'),
          vscode.l10n.t('message.cancel')
        );

        if (confirmed === vscode.l10n.t('message.delete')) {
          try {
            await commandManager.deleteDirectory(item.directory.id);
            quickCommandProvider.refresh();
            vscode.window.showInformationMessage(
              vscode.l10n.t('message.directoryDeleted', item.directory.name)
            );
          } catch (error) {
            vscode.window.showErrorMessage(
              `削除エラー: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            );
          }
        }
      }
    ),

    // ディレクトリ展開/折りたたみ
    vscode.commands.registerCommand(
      'quickExecCommands.toggleDirectoryExpansion',
      async (directoryId: string) => {
        try {
          console.log(
            '[Extension] Toggle directory command called with id:',
            directoryId
          );
          await commandManager.toggleDirectoryExpansion(directoryId);
          console.log(
            '[Extension] Refreshing tree view after directory toggle'
          );
          quickCommandProvider.refresh();
        } catch (error) {
          console.error('[Extension] Error toggling directory:', error);
          vscode.window.showErrorMessage(
            `エラー: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }
    ),

    // TreeViewからのコマンド実行
    vscode.commands.registerCommand(
      'quickExecCommands.executeFromTreeView',
      async (command: QuickCommand) => {
        try {
          console.log(
            '[Extension] Execute from tree view:',
            command.name || command.command
          );
          await commandManager.executeCommand(command);
        } catch (error) {
          console.error(
            '[Extension] Error executing command from tree view:',
            error
          );
          vscode.window.showErrorMessage(
            `コマンド実行エラー: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }
    ),

    // コマンド編集コマンド
    vscode.commands.registerCommand(
      'quickExecCommands.editCommand',
      async (commandItem: any) => {
        const command = commandItem.quickCommand || commandItem;
        try {
          // 既存のコマンド情報を使って編集ダイアログを表示
          const nameValue = await vscode.window.showInputBox({
            value: command.name || '',
            prompt: vscode.l10n.t('prompt.enterCommandName'),
            placeHolder:
              'Command name (if empty, command text will be displayed)',
          });

          if (nameValue === undefined) return; // キャンセル

          const commandValue = await vscode.window.showInputBox({
            value: command.command,
            prompt: vscode.l10n.t('prompt.enterCommand'),
            placeHolder: 'npm start, git status etc.',
          });

          if (!commandValue) {
            vscode.window.showErrorMessage(
              vscode.l10n.t('message.commandRequired')
            );
            return;
          }

          const descriptionValue = await vscode.window.showInputBox({
            value: command.description || '',
            prompt: vscode.l10n.t('prompt.enterDescription'),
            placeHolder: 'Description of this command',
          });

          if (descriptionValue === undefined) return; // キャンセル

          // ディレクトリ選択
          const directories = await commandManager.getAllDirectories();
          const currentDirectoryItem = command.directory
            ? { label: `📁 ${command.directory}`, value: command.directory }
            : { label: '(ルート)', value: undefined };

          const directoryItems = [
            { label: '(ルート)', value: undefined },
            ...directories.map((dir) => ({
              label: `📁 ${dir.name}`,
              description: dir.path,
              value: dir.path,
            })),
          ];

          const selectedDirectory = await vscode.window.showQuickPick(
            directoryItems,
            {
              placeHolder: vscode.l10n.t('prompt.selectDirectory'),
            }
          );

          if (selectedDirectory === undefined) return; // キャンセル

          // コマンドを更新（コマンドタイプは変更しない）
          await commandManager.updateCommand(command.id, {
            name: nameValue || undefined,
            command: commandValue,
            description: descriptionValue || undefined,
            directory: selectedDirectory.value,
          });

          quickCommandProvider.refresh();
          vscode.window.showInformationMessage(
            vscode.l10n.t('message.commandUpdated', nameValue || commandValue)
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `編集エラー: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }
    ),

    // コマンド削除コマンド
    vscode.commands.registerCommand(
      'quickExecCommands.deleteCommand',
      async (commandItem: any) => {
        // TreeItemの場合はquickCommandプロパティから取得
        const command = commandItem.quickCommand || commandItem;
        await commandManager.deleteCommand(command.id);
        quickCommandProvider.refresh();
      }
    ),

    // お気に入り切り替えコマンド
    vscode.commands.registerCommand(
      'quickExecCommands.toggleFavorite',
      async (commandItem: any) => {
        console.log('[Extension] toggleFavorite called with:', commandItem);
        console.log('[Extension] commandItem type:', typeof commandItem);
        console.log(
          '[Extension] commandItem keys:',
          Object.keys(commandItem || {})
        );

        // TreeItemの場合はquickCommandプロパティから取得
        const command = commandItem.quickCommand || commandItem;
        console.log('[Extension] resolved command:', command);
        console.log('[Extension] command id:', command?.id);
        console.log('[Extension] command name:', command?.name);
        console.log('[Extension] command directory:', command?.directory);

        if (!command || !command.id) {
          vscode.window.showErrorMessage('コマンド情報が取得できませんでした');
          return;
        }

        try {
          await commandManager.toggleFavorite(command.id);
          quickCommandProvider.refresh();
          vscode.window.showInformationMessage(
            `お気に入りを切り替えました: ${command.name || command.command}`
          );
        } catch (error) {
          console.error('[Extension] toggleFavorite error:', error);
          vscode.window.showErrorMessage(
            `お気に入り切り替えエラー: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }
    ),

    // コマンド検索
    vscode.commands.registerCommand(
      'quickExecCommands.searchCommands',
      async () => {
        const query = await vscode.window.showInputBox({
          prompt: vscode.l10n.t('prompt.enterSearchKeyword'),
          placeHolder: 'Command name, description, tags',
        });

        if (query) {
          try {
            const results = await commandManager.searchCommands(query);
            if (results.length === 0) {
              vscode.window.showInformationMessage(
                vscode.l10n.t('message.noCommandsFound', query)
              );
              return;
            }

            const items = results.map((cmd: QuickCommand) => ({
              label: cmd.name || cmd.command,
              description: cmd.name
                ? cmd.description || ''
                : cmd.description || '',
              detail: `${cmd.command} (${cmd.category})`,
              command: cmd,
            }));

            const selected = await vscode.window.showQuickPick(items, {
              placeHolder: vscode.l10n.t(
                'message.searchResults',
                results.length
              ),
              matchOnDescription: true,
              matchOnDetail: true,
            });

            if (selected) {
              await commandManager.executeCommand(selected.command);
            }
          } catch (error) {
            vscode.window.showErrorMessage(
              `検索エラー: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            );
          }
        }
      }
    ),

    // エクスポート
    vscode.commands.registerCommand(
      'quickExecCommands.exportCommands',
      async (item: any) => {
        let category: 'global' | 'repository' | undefined;

        if (item && item.category && item.category !== 'favorite') {
          category = item.category;
        }

        try {
          const exportData = await commandManager.exportCommands(category);

          const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(
              `quick-commands-${category || 'all'}-${
                new Date().toISOString().split('T')[0]
              }.json`
            ),
            filters: {
              JSON: ['json'],
            },
          });

          if (uri) {
            await vscode.workspace.fs.writeFile(
              uri,
              Buffer.from(exportData, 'utf8')
            );
            vscode.window.showInformationMessage(
              vscode.l10n.t('message.exportComplete', uri.fsPath)
            );
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `エクスポートエラー: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }
    ),

    // インポート
    vscode.commands.registerCommand(
      'quickExecCommands.importCommands',
      async (item: any) => {
        let category: 'global' | 'repository' = 'global';

        if (item && item.category && item.category !== 'favorite') {
          category = item.category;
        }

        try {
          const uri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
              JSON: ['json'],
            },
          });

          if (uri && uri[0]) {
            const fileContent = await vscode.workspace.fs.readFile(uri[0]);
            const jsonData = Buffer.from(fileContent).toString('utf8');

            const importedCount = await commandManager.importCommands(
              jsonData,
              category
            );
            quickCommandProvider.refresh();
            vscode.window.showInformationMessage(
              vscode.l10n.t('message.importCount', importedCount)
            );
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `インポートエラー: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }
    ),

    // 実行履歴表示
    vscode.commands.registerCommand(
      'quickExecCommands.showHistory',
      async () => {
        try {
          const history = commandManager.getExecutionHistory();

          if (history.length === 0) {
            vscode.window.showInformationMessage(
              vscode.l10n.t('message.noExecutionHistory')
            );
            return;
          }

          const items = history.slice(0, 20).map((entry) => ({
            label: entry.commandName,
            description: entry.success ? '✅ 成功' : '❌ 失敗',
            detail: `${entry.command} - ${entry.executedAt.toLocaleString()}`,
            entry,
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '実行履歴から選択してください',
          });

          if (selected) {
            const allCommands = await commandManager.getAllCommands();
            const command = allCommands.find(
              (cmd) => cmd.id === selected.entry.commandId
            );
            if (command) {
              await commandManager.executeCommand(command);
            } else {
              vscode.window.showWarningMessage(
                vscode.l10n.t('message.commandNotFound')
              );
            }
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `履歴表示エラー: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }
    ),

    // デバッグ用コマンド - TreeViewの状態確認
    vscode.commands.registerCommand(
      'quickExecCommands.debugTreeView',
      async (commandItem?: any) => {
        // 特定のコマンドが選択されている場合はそのデバッグ情報を表示
        if (commandItem) {
          console.log(
            '[Extension] debugTreeView called with specific item:',
            commandItem
          );
          const command = commandItem.quickCommand || commandItem;
          if (command) {
            const debugInfo = {
              id: command.id,
              name: command.name,
              command: command.command,
              directory: command.directory,
              category: command.category,
              isFavorite: command.isFavorite,
              commandType: command.commandType,
              contextValue: commandItem.contextValue,
              itemType: typeof commandItem,
            };
            console.log('[Extension] Command debug info:', debugInfo);
            vscode.window.showInformationMessage(
              `Debug Info: ${JSON.stringify(debugInfo, null, 2)}`,
              { modal: true }
            );
          }
          return;
        }
        const globalCommands = commandManager.getGlobalCommands();
        const workspaceCommands = commandManager.getWorkspaceCommands();
        const globalDirectories = commandManager.getGlobalDirectories();
        const workspaceDirectories = commandManager.getWorkspaceDirectories();

        // ストレージキーの確認
        const globalKeys = context.globalState.keys();
        const workspaceKeys = context.workspaceState.keys();

        const debugInfo = {
          globalCommands: globalCommands.map((cmd) => ({
            id: cmd.id,
            name: cmd.name,
            command: cmd.command,
            directory: cmd.directory,
          })),
          workspaceCommands: workspaceCommands.map((cmd) => ({
            id: cmd.id,
            name: cmd.name,
            command: cmd.command,
            directory: cmd.directory,
          })),
          globalDirectories: globalDirectories.map((dir) => ({
            id: dir.id,
            name: dir.name,
            path: dir.path,
            isExpanded: dir.isExpanded,
          })),
          workspaceDirectories: workspaceDirectories.map((dir) => ({
            id: dir.id,
            name: dir.name,
            path: dir.path,
            isExpanded: dir.isExpanded,
          })),
          storageKeys: {
            global: globalKeys,
            workspace: workspaceKeys,
          },
        };

        console.log('=== Quick Command Debug Info ===');
        console.log(JSON.stringify(debugInfo, null, 2));

        const message = `
Quick Command Debug Info:
- Global Commands: ${globalCommands.length}個
- Workspace Commands: ${workspaceCommands.length}個
- Global Directories: ${globalDirectories.length}個  
- Workspace Directories: ${workspaceDirectories.length}個
- Total Commands: ${globalCommands.length + workspaceCommands.length}個

Directories Expansion State:
Global: ${globalDirectories
          .map((d) => `${d.name}(${d.isExpanded ? 'expanded' : 'collapsed'})`)
          .join(', ')}
Workspace: ${workspaceDirectories
          .map((d) => `${d.name}(${d.isExpanded ? 'expanded' : 'collapsed'})`)
          .join(', ')}

Storage Keys:
- Global: ${globalKeys.join(', ')}
- Workspace: ${workspaceKeys.join(', ')}

詳細はコンソール（開発者ツール）を確認してください。
      `;

        vscode.window.showInformationMessage(message, { modal: true });

        // TreeViewを強制的にリフレッシュ
        quickCommandProvider.refresh();
      }
    ),

    // サンプルコマンド作成
    vscode.commands.registerCommand(
      'quickExecCommands.createSampleCommands',
      async () => {
        try {
          // サンプルディレクトリを作成
          await commandManager.addDirectory({
            name: '開発ツール',
            path: 'dev-tools',
            category: 'global',
            isExpanded: true,
            description: '開発でよく使うコマンド',
            icon: 'tools',
          });

          await commandManager.addDirectory({
            name: 'Git',
            path: 'git',
            category: 'repository',
            isExpanded: true,
            description: 'Git関連コマンド',
            icon: 'folder',
          });

          // サンプルコマンドを作成
          await commandManager.addCommand({
            name: 'Git ステータス確認',
            command: 'git status',
            description: 'Git の状態を確認',
            category: 'repository',
            isFavorite: false,
            inputs: [],
            directory: 'git',
            tags: ['git', 'status'],
            commandType: 'terminal',
          });

          await commandManager.addCommand({
            name: 'Git コミット',
            command: 'git add . && git commit -m "[メッセージ]"',
            description: 'ファイルを追加してコミット',
            category: 'repository',
            isFavorite: true,
            inputs: [],
            directory: 'git',
            tags: ['git', 'commit'],
            commandType: 'terminal',
          });

          await commandManager.addCommand({
            name: 'NPM インストール',
            command: 'npm install',
            description: 'NPM パッケージをインストール',
            category: 'repository',
            isFavorite: false,
            inputs: [],
            tags: ['npm', 'install'],
            commandType: 'terminal',
          });

          await commandManager.addCommand({
            name: 'Node.js バージョン確認',
            command: 'node --version',
            description: 'Node.js のバージョンを確認',
            category: 'global',
            isFavorite: false,
            inputs: [],
            directory: 'dev-tools',
            tags: ['node', 'version'],
            commandType: 'terminal',
          });

          // VS Code サンプルコマンドを追加
          await commandManager.addCommand({
            name: 'ファイルを保存',
            command: 'workbench.action.files.save',
            description: 'アクティブなファイルを保存',
            category: 'global',
            isFavorite: true,
            inputs: [],
            directory: 'dev-tools',
            tags: ['vscode', 'file'],
            commandType: 'vscode',
          });

          await commandManager.addCommand({
            name: 'クイックオープン',
            command: 'workbench.action.quickOpen',
            description: 'ファイル検索を開く',
            category: 'global',
            isFavorite: false,
            inputs: [],
            directory: 'dev-tools',
            tags: ['vscode', 'search'],
            commandType: 'vscode',
          });

          await commandManager.addCommand({
            name: 'コマンドパレット',
            command: 'workbench.action.showCommands',
            description: 'VS Code コマンドパレットを開く',
            category: 'global',
            isFavorite: false,
            inputs: [],
            directory: 'dev-tools',
            tags: ['vscode', 'commands'],
            commandType: 'vscode',
          });

          quickCommandProvider.refresh();
          vscode.window.showInformationMessage(
            vscode.l10n.t('message.samplesCreated')
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `サンプル作成エラー: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }
    ),

    // デモ用コマンド作成（GIF制作用）
    vscode.commands.registerCommand(
      'quickExecCommands.createDemoCommands',
      async () => {
        await createDemoCommands(commandManager);
        quickCommandProvider.refresh();
      }
    ),

    // ツリービューの更新
    treeView,
    // TreeViewの展開・折りたたみイベントハンドラー
    expansionHandler,
    collapseHandler,
  ];

  // コンテキストに追加
  commands.forEach((command) => {
    context.subscriptions.push(command);
  });

  // WebViewプロバイダーの登録
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'quickCommandWebview',
      webviewProvider
    )
  );
}

export function deactivate() {
  console.log('Quick Command拡張機能が非アクティブになりました');
}
