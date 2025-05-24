import * as vscode from 'vscode';
import { CommandManager } from './commands/commandManager';
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
  });

  // コマンドの登録
  const commands = [
    // パネル表示コマンド
    vscode.commands.registerCommand('quick-command.showPanel', () => {
      webviewProvider.createOrShowWebview();
    }),

    // コマンドリスト表示コマンド
    vscode.commands.registerCommand(
      'quick-command.showCommandList',
      async () => {
        const commands = await commandManager.getAllCommands();
        if (commands.length === 0) {
          vscode.window.showInformationMessage(
            '登録されているコマンドがありません'
          );
          return;
        }

        const items = commands.map((cmd: QuickCommand) => ({
          label: cmd.name,
          description: cmd.description,
          detail: cmd.command,
          command: cmd,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: '実行するコマンドを選択してください',
          matchOnDescription: true,
          matchOnDetail: true,
        });

        if (selected) {
          await commandManager.executeCommand(selected.command);
        }
      }
    ),

    // コマンド追加コマンド
    vscode.commands.registerCommand('quick-command.addCommand', async () => {
      await commandManager.addCommandDialog();
      quickCommandProvider.refresh();
    }),

    // コマンド実行コマンド
    vscode.commands.registerCommand(
      'quick-command.executeCommand',
      async (commandItem: QuickCommand) => {
        await commandManager.executeCommand(commandItem);
      }
    ),

    // コマンド削除コマンド
    vscode.commands.registerCommand(
      'quick-command.deleteCommand',
      async (commandItem: QuickCommand) => {
        await commandManager.deleteCommand(commandItem.id);
        quickCommandProvider.refresh();
      }
    ),

    // お気に入り切り替えコマンド
    vscode.commands.registerCommand(
      'quick-command.toggleFavorite',
      async (commandItem: QuickCommand) => {
        await commandManager.toggleFavorite(commandItem.id);
        quickCommandProvider.refresh();
      }
    ),

    // ツリービューの更新
    treeView,
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
