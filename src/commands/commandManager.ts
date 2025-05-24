import * as vscode from 'vscode';
import { CommandInput, QuickCommand } from '../types';

export class CommandManager {
  private context: vscode.ExtensionContext;
  private globalStorageKey = 'quickCommand.globalCommands';
  private workspaceStorageKey = 'quickCommand.workspaceCommands';

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

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

  // お気に入りコマンドの取得
  async getFavoriteCommands(): Promise<QuickCommand[]> {
    const allCommands = await this.getAllCommands();
    return allCommands.filter(cmd => cmd.isFavorite);
  }

  // コマンドの追加
  async addCommand(command: Omit<QuickCommand, 'id' | 'createdAt' | 'updatedAt'>): Promise<QuickCommand> {
    const newCommand: QuickCommand = {
      ...command,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (command.category === 'global') {
      const commands = this.getGlobalCommands();
      commands.push(newCommand);
      await this.context.globalState.update(this.globalStorageKey, commands);
    } else {
      const commands = this.getWorkspaceCommands();
      commands.push(newCommand);
      await this.context.workspaceState.update(this.workspaceStorageKey, commands);
    }

    return newCommand;
  }

  // コマンドの更新
  async updateCommand(id: string, updates: Partial<QuickCommand>): Promise<void> {
    const globalCommands = this.getGlobalCommands();
    const workspaceCommands = this.getWorkspaceCommands();

    let updated = false;

    // グローバルコマンドから検索
    const globalIndex = globalCommands.findIndex(cmd => cmd.id === id);
    if (globalIndex !== -1) {
      globalCommands[globalIndex] = { ...globalCommands[globalIndex], ...updates, updatedAt: new Date() };
      await this.context.globalState.update(this.globalStorageKey, globalCommands);
      updated = true;
    }

    // ワークスペースコマンドから検索
    const workspaceIndex = workspaceCommands.findIndex(cmd => cmd.id === id);
    if (workspaceIndex !== -1) {
      workspaceCommands[workspaceIndex] = { ...workspaceCommands[workspaceIndex], ...updates, updatedAt: new Date() };
      await this.context.workspaceState.update(this.workspaceStorageKey, workspaceCommands);
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
    const globalFiltered = globalCommands.filter(cmd => cmd.id !== id);
    if (globalFiltered.length !== globalCommands.length) {
      await this.context.globalState.update(this.globalStorageKey, globalFiltered);
      deleted = true;
    }

    // ワークスペースコマンドから削除
    const workspaceFiltered = workspaceCommands.filter(cmd => cmd.id !== id);
    if (workspaceFiltered.length !== workspaceCommands.length) {
      await this.context.workspaceState.update(this.workspaceStorageKey, workspaceFiltered);
      deleted = true;
    }

    if (!deleted) {
      throw new Error(`コマンドが見つかりません: ${id}`);
    }
  }

  // お気に入りの切り替え
  async toggleFavorite(id: string): Promise<void> {
    const allCommands = await this.getAllCommands();
    const command = allCommands.find(cmd => cmd.id === id);
    
    if (!command) {
      throw new Error(`コマンドが見つかりません: ${id}`);
    }

    await this.updateCommand(id, { isFavorite: !command.isFavorite });
  }

  // コマンドの実行
  async executeCommand(command: QuickCommand): Promise<void> {
    let finalCommand = command.command;

    // 入力が必要な場合
    if (command.inputs && command.inputs.length > 0) {
      const inputs: { [key: string]: string } = {};

      for (const input of command.inputs) {
        const value = await vscode.window.showInputBox({
          prompt: input.placeholder,
          value: input.defaultValue || '',
          validateInput: (text) => {
            if (input.required && !text.trim()) {
              return '入力は必須です';
            }
            return null;
          }
        });

        if (value === undefined) {
          // キャンセルされた場合
          return;
        }

        inputs[input.id] = value;
      }

      // コマンド内の変数を置換
      finalCommand = this.replaceCommandInputs(command.command, command.inputs, inputs);
    }

    // ターミナルでコマンドを実行
    const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('Quick Command');
    terminal.show();
    terminal.sendText(finalCommand);
  }

  // コマンド追加ダイアログ
  async addCommandDialog(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: 'コマンド名を入力してください',
      validateInput: (text) => {
        if (!text.trim()) {
          return 'コマンド名は必須です';
        }
        return null;
      }
    });

    if (!name) return;

    const command = await vscode.window.showInputBox({
      prompt: 'コマンドを入力してください（例: git commit -m [メッセージ]）',
      validateInput: (text) => {
        if (!text.trim()) {
          return 'コマンドは必須です';
        }
        return null;
      }
    });

    if (!command) return;

    const description = await vscode.window.showInputBox({
      prompt: 'コマンドの説明を入力してください（オプション）'
    });

    const category = await vscode.window.showQuickPick([
      { label: 'ワークスペース', value: 'repository' as const },
      { label: 'グローバル', value: 'global' as const }
    ], {
      placeHolder: 'コマンドの保存範囲を選択してください'
    });

    if (!category) return;

    // 入力フィールドの抽出（[テキスト] 形式）
    const inputs = this.extractInputFields(command);

    await this.addCommand({
      name,
      command,
      description,
      category: category.value,
      isFavorite: false,
      inputs
    });

    vscode.window.showInformationMessage(`コマンド "${name}" を追加しました`);
  }

  // コマンドから入力フィールドを抽出
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
        required: true
      });
      index++;
    }

    return inputs;
  }

  // コマンド内の入力を置換
  private replaceCommandInputs(command: string, inputs: CommandInput[], values: { [key: string]: string }): string {
    let result = command;
    const regex = /\[([^\]]+)\]/g;
    
    result = result.replace(regex, (match, placeholder) => {
      const input = inputs.find(inp => inp.placeholder === placeholder);
      if (input && values[input.id] !== undefined) {
        return values[input.id];
      }
      return match;
    });

    return result;
  }

  // ID生成
  private generateId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
} 