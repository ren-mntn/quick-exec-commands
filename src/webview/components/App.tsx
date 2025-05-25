import React, { useEffect, useState } from 'react';
import { QuickCommand, WebviewMessage } from '../../types';
import CommandForm from './CommandForm';
import CommandList from './CommandList';

// VS Code Webview API
declare const acquireVsCodeApi: () => {
  postMessage: (message: WebviewMessage) => void;
  setState: (state: any) => void;
  getState: () => any;
};

const vscode = acquireVsCodeApi();

const App: React.FC = () => {
  const [commands, setCommands] = useState<QuickCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCommand, setEditingCommand] = useState<QuickCommand | null>(
    null
  );
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    // VS Codeからのメッセージを受信
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'commandsLoaded':
          setCommands(message.payload);
          setLoading(false);
          break;

        case 'commandAdded':
          if (message.payload.success) {
            setMessage({
              type: 'success',
              text: 'コマンドが正常に追加されました',
            });
            setShowForm(false);
          } else {
            setMessage({
              type: 'error',
              text: message.payload.error || 'コマンドの追加に失敗しました',
            });
          }
          break;

        case 'commandEdited':
          if (message.payload.success) {
            setMessage({
              type: 'success',
              text: 'コマンドが正常に更新されました',
            });
            setEditingCommand(null);
          } else {
            setMessage({
              type: 'error',
              text: message.payload.error || 'コマンドの更新に失敗しました',
            });
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // 初期データの読み込み
    vscode.postMessage({ type: 'getCommands' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleAddCommand = (
    command:
      | Omit<QuickCommand, 'id' | 'createdAt' | 'updatedAt'>
      | Partial<QuickCommand>
  ) => {
    vscode.postMessage({
      type: 'addCommand',
      payload: command,
    });
  };

  const handleExecuteCommand = (command: QuickCommand) => {
    vscode.postMessage({
      type: 'executeCommand',
      payload: command,
    });
  };

  const handleDeleteCommand = (commandId: string) => {
    vscode.postMessage({
      type: 'deleteCommand',
      payload: commandId,
    });
  };

  const handleToggleFavorite = (commandId: string) => {
    vscode.postMessage({
      type: 'toggleFavorite',
      payload: commandId,
    });
  };

  const handleEditCommand = (command: QuickCommand) => {
    setEditingCommand(command);
  };

  const handleUpdateCommand = (updates: Partial<QuickCommand>) => {
    if (editingCommand) {
      vscode.postMessage({
        type: 'editCommand',
        payload: {
          id: editingCommand.id,
          updates,
        },
      });
    }
  };

  const groupedCommands = React.useMemo(() => {
    const grouped: { [key: string]: QuickCommand[] } = {
      favorites: commands.filter((cmd) => cmd.isFavorite),
      global: commands.filter(
        (cmd) => cmd.category === 'global' && !cmd.isFavorite
      ),
      repository: commands.filter(
        (cmd) => cmd.category === 'repository' && !cmd.isFavorite
      ),
    };

    return Object.entries(grouped).filter(([_, cmds]) => cmds.length > 0);
  }, [commands]);

  if (loading) {
    return (
      <div className="app">
        <div className="loading">コマンドを読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <h1 className="title">Quick Command</h1>
        <p className="subtitle">コマンドを効率的に管理・実行</p>
      </div>

      {message && (
        <div className={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <button className="button" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'フォームを閉じる' : '新しいコマンドを追加'}
        </button>
      </div>

      {showForm && (
        <CommandForm
          onSubmit={handleAddCommand}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingCommand && (
        <CommandForm
          initialCommand={editingCommand}
          onSubmit={handleUpdateCommand}
          onCancel={() => setEditingCommand(null)}
          isEditing={true}
        />
      )}

      {commands.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚡</div>
          <div className="empty-state-text">
            まだコマンドが登録されていません
          </div>
          <button className="button" onClick={() => setShowForm(true)}>
            最初のコマンドを追加
          </button>
        </div>
      ) : (
        <CommandList
          groupedCommands={groupedCommands}
          onExecute={handleExecuteCommand}
          onDelete={handleDeleteCommand}
          onToggleFavorite={handleToggleFavorite}
          onEdit={handleEditCommand}
        />
      )}
    </div>
  );
};

export default App;
