import * as vscode from 'vscode';
import { CommandManager } from './commandManager';

export async function createDemoCommands(
  commandManager: CommandManager
): Promise<void> {
  try {
    // 既存のサンプルコマンドを作成
    await vscode.commands.executeCommand('quick-command.createSampleCommands');

    // デモ用追加ディレクトリを作成
    await commandManager.addDirectory({
      name: 'Docker',
      path: 'docker',
      category: 'repository',
      isExpanded: true,
      description: 'Docker関連コマンド',
      icon: 'folder',
    });

    await commandManager.addDirectory({
      name: 'システム',
      path: 'system',
      category: 'global',
      isExpanded: false,
      description: 'システム情報確認コマンド',
      icon: 'gear',
    });

    // デモ用追加コマンドを作成 - Workspace/Repository

    // Development directory用
    await commandManager.addCommand({
      name: 'NPM Start',
      command: 'npm start',
      description: 'アプリケーション開発サーバーを起動',
      category: 'repository',
      isFavorite: true, // お気に入りに設定
      inputs: [],
      directory: 'dev-tools',
      tags: ['npm', 'start', 'development'],
      commandType: 'terminal',
    });

    await commandManager.addCommand({
      name: 'NPM Dev Server',
      command: 'npm run dev',
      description: '開発モードでサーバー起動',
      category: 'repository',
      isFavorite: false,
      inputs: [],
      directory: 'dev-tools',
      tags: ['npm', 'dev'],
      commandType: 'terminal',
    });

    await commandManager.addCommand({
      name: 'NPM Test',
      command: 'npm test',
      description: 'テストスイートを実行',
      category: 'repository',
      isFavorite: false,
      inputs: [],
      directory: 'dev-tools',
      tags: ['npm', 'test'],
      commandType: 'terminal',
    });

    // Git directory用追加コマンド
    await commandManager.addCommand({
      name: 'Git Push',
      command: 'git push',
      description: 'リモートリポジトリにプッシュ',
      category: 'repository',
      isFavorite: false,
      inputs: [],
      directory: 'git',
      tags: ['git', 'push'],
      commandType: 'terminal',
    });

    await commandManager.addCommand({
      name: 'Git Pull',
      command: 'git pull',
      description: 'リモートリポジトリから更新を取得',
      category: 'repository',
      isFavorite: false,
      inputs: [],
      directory: 'git',
      tags: ['git', 'pull'],
      commandType: 'terminal',
    });

    // Docker directory用コマンド
    await commandManager.addCommand({
      name: 'Docker Build',
      command: 'docker build -t [イメージ名] .',
      description: 'Dockerイメージをビルド',
      category: 'repository',
      isFavorite: false,
      inputs: [],
      directory: 'docker',
      tags: ['docker', 'build'],
      commandType: 'terminal',
    });

    await commandManager.addCommand({
      name: 'Docker Run',
      command: 'docker run --rm [イメージ名]',
      description: 'Dockerコンテナを実行',
      category: 'repository',
      isFavorite: false,
      inputs: [],
      directory: 'docker',
      tags: ['docker', 'run'],
      commandType: 'terminal',
    });

    await commandManager.addCommand({
      name: 'Docker Process List',
      command: 'docker ps',
      description: '実行中のコンテナを表示',
      category: 'repository',
      isFavorite: false,
      inputs: [],
      directory: 'docker',
      tags: ['docker', 'ps'],
      commandType: 'terminal',
    });

    // Global VS Code Commands用追加コマンド
    await commandManager.addCommand({
      name: '全ファイルを保存',
      command: 'workbench.action.files.saveAll',
      description: '開いているすべてのファイルを保存',
      category: 'global',
      isFavorite: false,
      inputs: [],
      directory: 'dev-tools',
      tags: ['vscode', 'file', 'save'],
      commandType: 'vscode',
    });

    await commandManager.addCommand({
      name: 'サイドバー切り替え',
      command: 'workbench.action.toggleSidebarVisibility',
      description: 'サイドバーの表示/非表示を切り替え',
      category: 'global',
      isFavorite: false,
      inputs: [],
      directory: 'dev-tools',
      tags: ['vscode', 'sidebar'],
      commandType: 'vscode',
    });

    await commandManager.addCommand({
      name: 'ターミナルを開く',
      command: 'workbench.action.terminal.new',
      description: '新しいターミナルを開く',
      category: 'repository',
      isFavorite: false,
      inputs: [],
      directory: 'dev-tools',
      tags: ['vscode', 'terminal'],
      commandType: 'vscode',
    });

    await commandManager.addCommand({
      name: 'ソース管理を表示',
      command: 'workbench.view.scm',
      description: 'Git Source Control パネルを表示',
      category: 'repository',
      isFavorite: false,
      inputs: [],
      directory: 'git',
      tags: ['vscode', 'git', 'scm'],
      commandType: 'vscode',
    });

    // System directory用コマンド
    await commandManager.addCommand({
      name: 'VS Code Version',
      command: 'code --version',
      description: 'VS Codeのバージョンを確認',
      category: 'global',
      isFavorite: false,
      inputs: [],
      directory: 'system',
      tags: ['version', 'vscode'],
      commandType: 'terminal',
    });

    await commandManager.addCommand({
      name: 'Git Version',
      command: 'git --version',
      description: 'Gitのバージョンを確認',
      category: 'global',
      isFavorite: false,
      inputs: [],
      directory: 'system',
      tags: ['version', 'git'],
      commandType: 'terminal',
    });

    vscode.window.showInformationMessage(
      'デモ用コマンド・ディレクトリを作成しました！📁✨'
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `デモ用コマンド作成エラー: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}
