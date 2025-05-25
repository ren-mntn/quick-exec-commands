export interface CommandInput {
  id: string;
  placeholder: string;
  position: number;
  required: boolean;
}

export interface QuickCommand {
  id: string;
  name?: string; // オプション: コマンド名がない場合はcommandを表示名として使用
  command: string;
  description?: string;
  category: 'global' | 'repository';
  isFavorite: boolean;
  inputs: CommandInput[];
  createdAt: Date;
  updatedAt: Date;
  // 新機能: ディレクトリパス
  directory?: string;
  // 新機能: タグ
  tags?: string[];
  // 新機能: 実行回数
  executionCount?: number;
  // 新機能: 最終実行日時
  lastExecutedAt?: Date;
  // 新機能: コマンドタイプ
  commandType?: 'terminal' | 'vscode';
}

export interface CommandDirectory {
  id: string;
  name: string;
  path: string; // 親パス/名前の形式 例: "aws/ec2"
  category: 'global' | 'repository';
  isExpanded: boolean;
  createdAt: Date;
  description?: string;
  icon?: string;
}

export interface CommandTemplate {
  id: string;
  name: string;
  command: string;
  description?: string;
  variables: string[]; // プレースホルダー変数名
}

export interface ExecutionHistory {
  id: string;
  commandId: string;
  commandName: string;
  command: string;
  executedAt: Date;
  success: boolean;
  duration?: number;
}

export interface WebviewMessage {
  type:
    | 'addCommand'
    | 'deleteCommand'
    | 'executeCommand'
    | 'toggleFavorite'
    | 'addDirectory'
    | 'deleteDirectory'
    | 'editCommand'
    | 'exportCommands'
    | 'importCommands'
    | 'getHistory'
    | 'searchCommands'
    | 'getCommands'
    | 'getVSCodeCommands'
    | 'getShellHistory';
  payload?: any;
}

// TreeView用の新しい型
export interface TreeNodeData {
  type: 'command' | 'directory' | 'category';
  id: string;
  label: string;
  category?: 'global' | 'repository';
  path?: string;
  isExpanded?: boolean;
  children?: TreeNodeData[];
  command?: QuickCommand;
  directory?: CommandDirectory;
}
