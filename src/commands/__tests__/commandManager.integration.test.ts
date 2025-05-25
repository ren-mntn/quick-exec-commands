import * as vscode from 'vscode';
import { CommandDirectory, QuickCommand } from '../../types';
import { CommandManager } from '../commandManager';

describe('CommandManager Integration Tests', () => {
  let commandManager: CommandManager;
  let mockContext: vscode.ExtensionContext;
  let globalCommands: QuickCommand[] = [];
  let workspaceCommands: QuickCommand[] = [];
  let globalDirectories: CommandDirectory[] = [];
  let workspaceDirectories: CommandDirectory[] = [];
  let executionHistory: any[] = [];

  beforeEach(() => {
    globalCommands = [];
    workspaceCommands = [];
    globalDirectories = [];
    workspaceDirectories = [];
    executionHistory = [];

    mockContext = {
      globalState: {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'quickCommand.globalCommands') {
            return globalCommands;
          }
          if (key === 'quickCommand.globalDirectories') {
            return globalDirectories;
          }
          if (key === 'quickCommand.executionHistory') {
            return executionHistory;
          }
          return [];
        }),
        update: jest.fn().mockImplementation((key, value) => {
          if (key === 'quickCommand.globalCommands') {
            globalCommands = value;
          }
          if (key === 'quickCommand.globalDirectories') {
            globalDirectories = value;
          }
          if (key === 'quickCommand.executionHistory') {
            executionHistory = value;
          }
        }),
      },
      workspaceState: {
        get: jest.fn().mockImplementation((key) => {
          if (key === 'quickCommand.workspaceCommands') {
            return workspaceCommands;
          }
          if (key === 'quickCommand.workspaceDirectories') {
            return workspaceDirectories;
          }
          return [];
        }),
        update: jest.fn().mockImplementation((key, value) => {
          if (key === 'quickCommand.workspaceCommands') {
            workspaceCommands = value;
          }
          if (key === 'quickCommand.workspaceDirectories') {
            workspaceDirectories = value;
          }
        }),
      },
    } as any;

    commandManager = new CommandManager(mockContext);
  });

  describe('Basic command operations', () => {
    it('should add command, toggle favorite, and delete command', async () => {
      // 1. コマンドの追加
      const newCommand = {
        name: 'Test Git Commit',
        command: 'git commit -m [メッセージ]',
        description: 'Git コミット用のテストコマンド',
        category: 'repository' as const,
        isFavorite: false,
        tags: ['git', 'commit'],
        inputs: [],
      };

      const addedCommand = await commandManager.addCommand(newCommand);

      // コマンドが正しく追加されたか確認
      expect(addedCommand.id).toBeDefined();
      expect(addedCommand.name).toBe(newCommand.name);
      expect(addedCommand.isFavorite).toBe(false);
      expect(addedCommand.executionCount).toBe(0);

      // 2. コマンド一覧の確認
      const allCommands = await commandManager.getAllCommands();
      expect(allCommands).toHaveLength(1);
      expect(allCommands[0].id).toBe(addedCommand.id);

      // 3. お気に入りに追加
      await commandManager.toggleFavorite(addedCommand.id);

      const updatedCommands = await commandManager.getAllCommands();
      expect(updatedCommands[0].isFavorite).toBe(true);

      // 4. お気に入り一覧の確認
      const favoriteCommands = await commandManager.getFavoriteCommands();
      expect(favoriteCommands).toHaveLength(1);
      expect(favoriteCommands[0].id).toBe(addedCommand.id);

      // 5. お気に入りから削除
      await commandManager.toggleFavorite(addedCommand.id);

      const finalCommands = await commandManager.getAllCommands();
      expect(finalCommands[0].isFavorite).toBe(false);

      const emptyFavorites = await commandManager.getFavoriteCommands();
      expect(emptyFavorites).toHaveLength(0);

      // 6. コマンドの削除
      await commandManager.deleteCommand(addedCommand.id);

      const emptyCommands = await commandManager.getAllCommands();
      expect(emptyCommands).toHaveLength(0);
    });
  });

  describe('Directory management', () => {
    it('should create, manage and delete directories', async () => {
      // 1. ディレクトリの作成
      const newDirectory = {
        name: 'AWS Commands',
        path: 'aws',
        category: 'global' as const,
        isExpanded: true,
        description: 'AWS関連コマンド',
        icon: 'cloud',
      };

      const addedDirectory = await commandManager.addDirectory(newDirectory);
      expect(addedDirectory.id).toBeDefined();
      expect(addedDirectory.name).toBe(newDirectory.name);

      // 2. ディレクトリ一覧の確認
      const allDirectories = await commandManager.getAllDirectories();
      expect(allDirectories).toHaveLength(1);

      // 3. サブディレクトリの作成
      const subDirectory = {
        name: 'EC2',
        path: 'aws/ec2',
        category: 'global' as const,
        isExpanded: false,
        description: 'EC2関連コマンド',
      };

      const addedSubDirectory = await commandManager.addDirectory(subDirectory);
      expect(addedSubDirectory.path).toBe('aws/ec2');

      // 4. ディレクトリにコマンドを追加
      const commandInDirectory = await commandManager.addCommand({
        name: 'List EC2 Instances',
        command: 'aws ec2 describe-instances',
        description: 'EC2インスタンス一覧',
        category: 'global',
        isFavorite: false,
        tags: ['aws', 'ec2'],
        directory: 'aws/ec2',
        inputs: [],
      });

      // 5. ディレクトリ別のコマンド取得
      const commandsInDirectory = commandManager.getCommandsByDirectory(
        'global',
        'aws/ec2'
      );
      expect(commandsInDirectory).toHaveLength(1);
      expect(commandsInDirectory[0].id).toBe(commandInDirectory.id);

      // 6. ディレクトリの展開/折りたたみ
      await commandManager.toggleDirectoryExpansion(addedDirectory.id);
      const toggledDirectories = commandManager.getGlobalDirectories();
      const toggledDirectory = toggledDirectories.find(
        (dir) => dir.id === addedDirectory.id
      );
      expect(toggledDirectory?.isExpanded).toBe(false);

      // 7. ディレクトリの削除（コマンドも削除される）
      await commandManager.deleteDirectory(addedSubDirectory.id);

      // サブディレクトリが削除されたか確認
      const remainingDirectories = await commandManager.getAllDirectories();
      expect(remainingDirectories).toHaveLength(1);
      expect(remainingDirectories[0].id).toBe(addedDirectory.id);

      // コマンドも削除されたか確認
      const remainingCommands = await commandManager.getAllCommands();
      expect(remainingCommands).toHaveLength(0);
    });
  });

  describe('Search functionality', () => {
    beforeEach(async () => {
      // テスト用のコマンドを追加
      await commandManager.addCommand({
        name: 'Git Commit',
        command: 'git commit -m [message]',
        description: 'Commit changes to git',
        category: 'repository',
        isFavorite: false,
        tags: ['git', 'version-control'],
        inputs: [],
      });

      await commandManager.addCommand({
        name: 'Docker Build',
        command: 'docker build -t [tag] .',
        description: 'Build Docker image',
        category: 'global',
        isFavorite: true,
        tags: ['docker', 'containerization'],
        inputs: [],
      });

      await commandManager.addCommand({
        name: 'NPM Install',
        command: 'npm install [package]',
        description: 'Install npm package',
        category: 'repository',
        isFavorite: false,
        tags: ['npm', 'package-management'],
        inputs: [],
      });
    });

    it('should search commands by name', async () => {
      const results = await commandManager.searchCommands('git');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Git Commit');
    });

    it('should search commands by description', async () => {
      const results = await commandManager.searchCommands('Docker');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Docker Build');
    });

    it('should search commands by tags', async () => {
      const results = await commandManager.searchCommands('package');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('NPM Install');
    });

    it('should return empty array for non-matching search', async () => {
      const results = await commandManager.searchCommands('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('Export and Import', () => {
    beforeEach(async () => {
      // テスト用のディレクトリとコマンドを作成
      await commandManager.addDirectory({
        name: 'Test Dir',
        path: 'test',
        category: 'global',
        isExpanded: true,
        description: 'Test directory',
      });

      await commandManager.addCommand({
        name: 'Test Command 1',
        command: 'echo "test1"',
        description: 'Test command 1',
        category: 'global',
        isFavorite: false,
        tags: ['test'],
        directory: 'test',
        inputs: [],
      });

      await commandManager.addCommand({
        name: 'Test Command 2',
        command: 'echo "test2"',
        description: 'Test command 2',
        category: 'repository',
        isFavorite: true,
        tags: ['test'],
        inputs: [],
      });
    });

    it('should export all commands and directories', async () => {
      const exportData = await commandManager.exportCommands();
      const parsed = JSON.parse(exportData);

      expect(parsed.version).toBe('1.0');
      expect(parsed.commands).toHaveLength(2);
      expect(parsed.directories).toHaveLength(1);
      expect(parsed.exportedAt).toBeDefined();
    });

    it('should export global commands only', async () => {
      const exportData = await commandManager.exportCommands('global');
      const parsed = JSON.parse(exportData);

      expect(parsed.commands).toHaveLength(1);
      expect(parsed.commands[0].category).toBe('global');
      expect(parsed.directories).toHaveLength(1);
    });

    it('should import commands successfully', async () => {
      const exportData = await commandManager.exportCommands('global');

      // 既存のコマンドを削除
      const existingCommands = await commandManager.getAllCommands();
      for (const cmd of existingCommands) {
        await commandManager.deleteCommand(cmd.id);
      }

      const importedCount = await commandManager.importCommands(
        exportData,
        'repository'
      );
      expect(importedCount).toBe(1);

      const importedCommands = await commandManager.getAllCommands();
      expect(importedCommands).toHaveLength(1);
      expect(importedCommands[0].category).toBe('repository'); // カテゴリが変更される
      expect(importedCommands[0].isFavorite).toBe(false); // お気に入りはリセット
    });

    it('should handle invalid import data', async () => {
      await expect(
        commandManager.importCommands('invalid json', 'global')
      ).rejects.toThrow('インポートに失敗しました');
    });
  });

  describe('Execution history', () => {
    beforeEach(() => {
      // ターミナルのモック
      (vscode.window.createTerminal as jest.Mock).mockReturnValue({
        show: jest.fn(),
        sendText: jest.fn(),
      });
    });

    it('should track execution history', async () => {
      const command = await commandManager.addCommand({
        name: 'Test Command',
        command: 'echo "test"',
        description: 'Test command',
        category: 'global',
        isFavorite: false,
        tags: [],
        inputs: [],
      });

      // コマンドを実行
      await commandManager.executeCommand(command);

      // 実行履歴を確認
      const history = commandManager.getExecutionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].commandId).toBe(command.id);
      expect(history[0].commandName).toBe(command.name);
      expect(history[0].success).toBe(true);

      // コマンドの実行回数が更新されているか確認
      const updatedCommands = await commandManager.getAllCommands();
      const updatedCommand = updatedCommands.find(
        (cmd) => cmd.id === command.id
      );
      expect(updatedCommand?.executionCount).toBe(1);
      expect(updatedCommand?.lastExecutedAt).toBeDefined();
    });

    it('should limit history to 100 entries', async () => {
      const command = await commandManager.addCommand({
        name: 'Test Command',
        command: 'echo "test"',
        description: 'Test command',
        category: 'global',
        isFavorite: false,
        tags: [],
        inputs: [],
      });

      // 履歴を101件追加（最初の1件は削除される）
      for (let i = 0; i < 101; i++) {
        executionHistory.unshift({
          id: `history-${i}`,
          commandId: command.id,
          commandName: command.name,
          command: command.command,
          executedAt: new Date(),
          success: true,
        });
      }

      // コマンドを実行（これで102件目）
      await commandManager.executeCommand(command);

      const history = commandManager.getExecutionHistory();
      expect(history).toHaveLength(100); // 100件まで制限
    });
  });

  describe('Error handling', () => {
    it('should handle non-existent command operations', async () => {
      await expect(
        commandManager.deleteCommand('non-existent-id')
      ).rejects.toThrow('コマンドが見つかりません');

      await expect(
        commandManager.toggleFavorite('non-existent-id')
      ).rejects.toThrow('コマンドが見つかりません');
    });

    it('should handle non-existent directory operations', async () => {
      await expect(
        commandManager.deleteDirectory('non-existent-id')
      ).rejects.toThrow('ディレクトリが見つかりません');

      await expect(
        commandManager.toggleDirectoryExpansion('non-existent-id')
      ).rejects.toThrow('ディレクトリが見つかりません');
    });
  });
});
