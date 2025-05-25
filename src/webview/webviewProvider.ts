import * as vscode from 'vscode';
import { CommandManager } from '../commands/commandManager';
import { WebviewMessage } from '../types';

export class WebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'quickCommandWebview';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly commandManager: CommandManager
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Webviewからのメッセージを受信
    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      switch (message.type) {
        case 'getCommands':
          const commands = await this.commandManager.getAllCommands();
          webviewView.webview.postMessage({
            type: 'commandsLoaded',
            payload: commands,
          });
          break;

        case 'getVSCodeCommands':
          try {
            const availableCommands = await vscode.commands.getCommands(true);
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

            const commandList = [
              ...popularCommands.map((cmd) => ({
                command: cmd,
                popular: true,
              })),
              ...availableCommands
                .filter((cmd) => !popularCommands.includes(cmd))
                .sort()
                .map((cmd) => ({ command: cmd, popular: false })),
            ];

            webviewView.webview.postMessage({
              type: 'vscodeCommandsLoaded',
              payload: commandList,
            });
          } catch (error) {
            webviewView.webview.postMessage({
              type: 'vscodeCommandsLoaded',
              payload: { error: (error as Error).message },
            });
          }
          break;

        case 'getShellHistory':
          try {
            const suggestedCommands =
              await this.commandManager.getSuggestedCommands();
            webviewView.webview.postMessage({
              type: 'shellHistoryLoaded',
              payload: suggestedCommands,
            });
          } catch (error) {
            webviewView.webview.postMessage({
              type: 'shellHistoryLoaded',
              payload: { error: (error as Error).message },
            });
          }
          break;

        case 'addCommand':
          try {
            await this.commandManager.addCommand(message.payload);
            webviewView.webview.postMessage({
              type: 'commandAdded',
              payload: { success: true },
            });
            // コマンド一覧を再送信
            const updatedCommands = await this.commandManager.getAllCommands();
            webviewView.webview.postMessage({
              type: 'commandsLoaded',
              payload: updatedCommands,
            });
          } catch (error) {
            webviewView.webview.postMessage({
              type: 'commandAdded',
              payload: { success: false, error: (error as Error).message },
            });
          }
          break;

        case 'executeCommand':
          try {
            await this.commandManager.executeCommand(message.payload);
          } catch (error) {
            vscode.window.showErrorMessage(
              `コマンド実行エラー: ${(error as Error).message}`
            );
          }
          break;

        case 'deleteCommand':
          try {
            await this.commandManager.deleteCommand(message.payload);
            const updatedCommands = await this.commandManager.getAllCommands();
            webviewView.webview.postMessage({
              type: 'commandsLoaded',
              payload: updatedCommands,
            });
          } catch (error) {
            vscode.window.showErrorMessage(
              `コマンド削除エラー: ${(error as Error).message}`
            );
          }
          break;

        case 'toggleFavorite':
          try {
            await this.commandManager.toggleFavorite(message.payload);
            const updatedCommands = await this.commandManager.getAllCommands();
            webviewView.webview.postMessage({
              type: 'commandsLoaded',
              payload: updatedCommands,
            });
          } catch (error) {
            vscode.window.showErrorMessage(
              `お気に入り切り替えエラー: ${(error as Error).message}`
            );
          }
          break;

        case 'editCommand':
          try {
            await this.commandManager.updateCommand(
              message.payload.id,
              message.payload.updates
            );
            const updatedCommands = await this.commandManager.getAllCommands();
            webviewView.webview.postMessage({
              type: 'commandsLoaded',
              payload: updatedCommands,
            });
            webviewView.webview.postMessage({
              type: 'commandEdited',
              payload: { success: true },
            });
          } catch (error) {
            webviewView.webview.postMessage({
              type: 'commandEdited',
              payload: { success: false, error: (error as Error).message },
            });
          }
          break;
      }
    });
  }

  public createOrShowWebview() {
    if (this._view) {
      this._view.show?.(true);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'webview.js')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <title>Quick Command</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
          }
          
          #root {
            height: 100vh;
            overflow: auto;
          }
        </style>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
