import React from 'react';
import { QuickCommand } from '../../types';

interface CommandListProps {
  groupedCommands: [string, QuickCommand[]][];
  onExecute: (command: QuickCommand) => void;
  onDelete: (commandId: string) => void;
  onToggleFavorite: (commandId: string) => void;
  onEdit: (command: QuickCommand) => void;
}

const CommandList: React.FC<CommandListProps> = ({
  groupedCommands,
  onExecute,
  onDelete,
  onToggleFavorite,
  onEdit,
}) => {
  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'favorites':
        return '⭐ お気に入り';
      case 'global':
        return '🌐 グローバル';
      case 'repository':
        return '📁 ワークスペース';
      default:
        return category;
    }
  };

  const createTooltip = (command: QuickCommand): string => {
    const lines: string[] = [];

    // 実際に実行されるコマンド
    lines.push(command.command);

    // 説明がある場合は追加
    if (command.description) {
      lines.push(command.description);
    }

    return lines.join('\n');
  };

  const handleDelete = (command: QuickCommand) => {
    if (window.confirm(`"${command.name}" を削除しますか？`)) {
      onDelete(command.id);
    }
  };

  return (
    <div className="command-list">
      {groupedCommands.map(([category, commands]) => (
        <div key={category} className="command-category">
          <h3 className="category-title">{getCategoryTitle(category)}</h3>

          {commands.map((command) => (
            <div
              key={command.id}
              className="command-item"
              onClick={() => onExecute(command)}
            >
              <div className="command-name" title={createTooltip(command)}>
                {command.name}
                {command.isFavorite && (
                  <span style={{ color: '#ffd700' }}>⭐</span>
                )}
                {command.commandType === 'vscode' && (
                  <span
                    style={{
                      fontSize: '11px',
                      marginLeft: '8px',
                      background: 'var(--vscode-badge-background)',
                      color: 'var(--vscode-badge-foreground)',
                      padding: '2px 6px',
                      borderRadius: '3px',
                    }}
                  >
                    VS Code
                  </span>
                )}
              </div>

              {command.description && (
                <div className="command-description">{command.description}</div>
              )}

              <pre className="command-code">{command.command}</pre>

              {command.inputs && command.inputs.length > 0 && (
                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '11px',
                    color: 'var(--vscode-descriptionForeground)',
                  }}
                >
                  入力フィールド:{' '}
                  {command.inputs.map((input) => input.placeholder).join(', ')}
                </div>
              )}

              <div
                className="command-actions"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className={`icon-button favorite ${
                    command.isFavorite ? 'active' : ''
                  }`}
                  onClick={() => onToggleFavorite(command.id)}
                  title={
                    command.isFavorite
                      ? 'お気に入りから削除'
                      : 'お気に入りに追加'
                  }
                >
                  {command.isFavorite ? '★' : '☆'}
                </button>

                <button
                  className="icon-button"
                  onClick={() => onExecute(command)}
                  title="実行"
                >
                  ▶️
                </button>

                <button
                  className="icon-button"
                  onClick={() => onEdit(command)}
                  title="編集"
                >
                  ✏️
                </button>

                <button
                  className="icon-button danger"
                  onClick={() => handleDelete(command)}
                  title="削除"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default CommandList;
