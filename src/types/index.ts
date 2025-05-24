export interface QuickCommand {
  id: string;
  name: string;
  command: string;
  description?: string;
  category: 'repository' | 'global';
  isFavorite: boolean;
  inputs?: CommandInput[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CommandInput {
  id: string;
  placeholder: string;
  position: number; // コマンド内の挿入位置
  required: boolean;
  defaultValue?: string;
}

export interface CommandCategory {
  name: string;
  commands: QuickCommand[];
}

export interface ExecuteCommandOptions {
  command: QuickCommand;
  inputs?: { [inputId: string]: string };
}

export interface WebviewMessage {
  type: 'addCommand' | 'executeCommand' | 'deleteCommand' | 'toggleFavorite' | 'getCommands' | 'updateCommand';
  payload?: any;
} 