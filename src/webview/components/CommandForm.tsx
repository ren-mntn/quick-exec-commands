import React, { useEffect, useState } from 'react';
import { CommandInput, QuickCommand } from '../../types';

interface CommandFormProps {
  onSubmit: (
    command:
      | Omit<QuickCommand, 'id' | 'createdAt' | 'updatedAt'>
      | Partial<QuickCommand>
  ) => void;
  onCancel: () => void;
  initialCommand?: QuickCommand;
  isEditing?: boolean;
}

// VS Code Webview API
declare const acquireVsCodeApi: () => {
  postMessage: (message: any) => void;
};

const vscode = acquireVsCodeApi();

const CommandForm: React.FC<CommandFormProps> = ({
  onSubmit,
  onCancel,
  initialCommand,
  isEditing = false,
}) => {
  const [step, setStep] = useState<'type' | 'form'>(
    isEditing ? 'form' : 'type'
  );
  const [formData, setFormData] = useState({
    name: initialCommand?.name || '',
    command: initialCommand?.command || '',
    description: initialCommand?.description || '',
    category: (initialCommand?.category || 'repository') as
      | 'repository'
      | 'global',
    isFavorite: initialCommand?.isFavorite || false,
    commandType: (initialCommand?.commandType || 'terminal') as
      | 'terminal'
      | 'vscode',
  });

  const [commandInputs, setCommandInputs] = useState<CommandInput[]>(
    initialCommand?.inputs || []
  );

  const [vscodeCommands, setVscodeCommands] = useState<
    Array<{ command: string; popular: boolean }>
  >([]);
  const [vscodeCommandsLoading, setVscodeCommandsLoading] = useState(false);
  const [vscodeCommandFilter, setVscodeCommandFilter] = useState('');

  const [shellHistory, setShellHistory] = useState<string[]>([]);
  const [shellHistoryLoading, setShellHistoryLoading] = useState(false);
  const [showShellHistory, setShowShellHistory] = useState(false);

  // VS Codeコマンドを取得
  useEffect(() => {
    if (formData.commandType === 'vscode' && vscodeCommands.length === 0) {
      setVscodeCommandsLoading(true);
      vscode.postMessage({ type: 'getVSCodeCommands' });
    }
  }, [formData.commandType, vscodeCommands.length]);

  // メッセージリスナー
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'vscodeCommandsLoaded') {
        if (message.payload.error) {
          console.error('VS Codeコマンドの取得に失敗:', message.payload.error);
        } else {
          setVscodeCommands(message.payload);
        }
        setVscodeCommandsLoading(false);
      } else if (message.type === 'shellHistoryLoaded') {
        if (message.payload.error) {
          console.error('シェル履歴の取得に失敗:', message.payload.error);
        } else {
          setShellHistory(message.payload);
        }
        setShellHistoryLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // コマンドが変更された場合、入力フィールドを更新
    if (field === 'command' && typeof value === 'string') {
      updateCommandInputs(value);
    }
  };

  const updateCommandInputs = (command: string) => {
    const regex = /\[([^\]]+)\]/g;
    const inputs: CommandInput[] = [];
    let match;
    let index = 0;

    while ((match = regex.exec(command)) !== null) {
      inputs.push({
        id: `input_${index}`,
        placeholder: match[1],
        position: match.index,
        required: true,
      });
      index++;
    }

    setCommandInputs(inputs);
  };

  const handleTypeSelect = (type: 'terminal' | 'vscode') => {
    setFormData((prev) => ({ ...prev, commandType: type }));
    setStep('form');
  };

  const handleVSCodeCommandSelect = (command: string) => {
    setFormData((prev) => ({ ...prev, command }));
  };

  const handleLoadShellHistory = () => {
    if (shellHistory.length === 0) {
      setShellHistoryLoading(true);
      vscode.postMessage({ type: 'getShellHistory' });
    }
    setShowShellHistory(true);
  };

  const handleShellHistorySelect = (command: string) => {
    setFormData((prev) => ({ ...prev, command }));
    setShowShellHistory(false);
  };

  const getFilteredVSCodeCommands = () => {
    if (!vscodeCommandFilter) return vscodeCommands;
    return vscodeCommands.filter((cmd) =>
      cmd.command.toLowerCase().includes(vscodeCommandFilter.toLowerCase())
    );
  };

  const getDisplayName = (command: string): string => {
    const displayNames: { [key: string]: string } = {
      'workbench.action.files.save': 'ファイルを保存',
      'workbench.action.files.saveAll': '全ファイルを保存',
      'workbench.action.quickOpen': 'クイックオープン',
      'workbench.action.showCommands': 'コマンドパレット',
      'workbench.action.toggleSidebarVisibility': 'サイドバー表示切り替え',
      'workbench.action.togglePanel': 'パネル表示切り替え',
      'editor.action.formatDocument': 'ドキュメントフォーマット',
      'workbench.action.reloadWindow': 'ウィンドウリロード',
      'workbench.action.openSettings': '設定を開く',
      'workbench.action.openKeybindings': 'キーボードショートカット',
      'workbench.view.explorer': 'エクスプローラーを表示',
      'workbench.view.search': '検索を表示',
      'workbench.view.scm': 'ソース管理を表示',
      'workbench.view.debug': 'デバッグを表示',
      'workbench.view.extensions': '拡張機能を表示',
    };
    return displayNames[command] || command;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.command.trim()) {
      return;
    }

    if (isEditing) {
      onSubmit({
        name: formData.name || undefined,
        command: formData.command,
        description: formData.description || undefined,
        category: formData.category,
        isFavorite: formData.isFavorite,
        inputs: commandInputs,
      });
    } else {
      onSubmit({
        ...formData,
        name: formData.name || undefined,
        description: formData.description || undefined,
        inputs: commandInputs,
      });

      // フォームをリセット（新規追加の場合のみ）
      setFormData({
        name: '',
        command: '',
        description: '',
        category: 'repository',
        isFavorite: false,
        commandType: 'terminal',
      });
      setCommandInputs([]);
      setStep('type');
    }
  };

  // タイプ選択画面
  if (step === 'type') {
    return (
      <div className="form-section">
        <h3 className="form-title">新しいコマンドを追加</h3>
        <div style={{ marginBottom: '16px' }}>
          <label className="label">コマンドの種類を選択してください</label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            type="button"
            className="button"
            onClick={() => handleTypeSelect('terminal')}
            style={{
              padding: '16px',
              textAlign: 'left',
              background: 'var(--vscode-button-secondaryBackground)',
              border: '1px solid var(--vscode-button-border)',
              color: 'var(--vscode-button-secondaryForeground)',
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
              🖥️ ターミナルコマンド
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>
              ターミナルで実行されるコマンド（npm, git, docker など）
            </div>
          </button>

          <button
            type="button"
            className="button"
            onClick={() => handleTypeSelect('vscode')}
            style={{
              padding: '16px',
              textAlign: 'left',
              background: 'var(--vscode-button-secondaryBackground)',
              border: '1px solid var(--vscode-button-border)',
              color: 'var(--vscode-button-secondaryForeground)',
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
              ⚙️ VS Codeコマンド
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>
              VS Code内部のコマンド（ファイル保存、設定など）
            </div>
          </button>
        </div>

        <div style={{ marginTop: '16px' }}>
          <button type="button" className="button secondary" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  // フォーム画面
  return (
    <div className="form-section">
      <h3 className="form-title">
        {isEditing ? 'コマンドを編集' : '新しいコマンドを追加'}
        {!isEditing && (
          <span style={{ fontSize: '12px', opacity: 0.7, marginLeft: '8px' }}>
            ({formData.commandType === 'terminal' ? 'ターミナル' : 'VS Code'})
          </span>
        )}
      </h3>

      <form onSubmit={handleSubmit}>
        {!isEditing && (
          <div style={{ marginBottom: '16px' }}>
            <button
              type="button"
              className="button secondary"
              onClick={() => setStep('type')}
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              ← コマンド種類を変更
            </button>
          </div>
        )}

        {/* VS Codeコマンド選択 */}
        {formData.commandType === 'vscode' && (
          <div className="input-group">
            <label className="label">VS Codeコマンドを選択 *</label>
            <input
              type="text"
              className="input"
              placeholder="コマンドを検索..."
              value={vscodeCommandFilter}
              onChange={(e) => setVscodeCommandFilter(e.target.value)}
              style={{ marginBottom: '8px' }}
            />

            {vscodeCommandsLoading ? (
              <div style={{ padding: '16px', textAlign: 'center' }}>
                コマンドリストを読み込み中...
              </div>
            ) : (
              <div
                style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  border: '1px solid var(--vscode-input-border)',
                  borderRadius: '4px',
                }}
              >
                {getFilteredVSCodeCommands()
                  .slice(0, 50)
                  .map((item) => (
                    <div
                      key={item.command}
                      onClick={() => handleVSCodeCommandSelect(item.command)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--vscode-widget-border)',
                        background:
                          formData.command === item.command
                            ? 'var(--vscode-list-activeSelectionBackground)'
                            : 'transparent',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
                        {item.command}
                        {item.popular && (
                          <span style={{ marginLeft: '8px', fontSize: '11px' }}>
                            ⭐
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.7 }}>
                        {getDisplayName(item.command)}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ターミナルコマンド入力 */}
        {formData.commandType === 'terminal' && (
          <div className="input-group">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px',
              }}
            >
              <label className="label" htmlFor="command">
                コマンド *
              </label>
              <button
                type="button"
                onClick={handleLoadShellHistory}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  background: 'var(--vscode-button-secondaryBackground)',
                  color: 'var(--vscode-button-secondaryForeground)',
                  border: '1px solid var(--vscode-button-border)',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >
                📋 履歴から選択
              </button>
            </div>

            {showShellHistory && (
              <div style={{ marginBottom: '8px' }}>
                {shellHistoryLoading ? (
                  <div
                    style={{
                      padding: '16px',
                      textAlign: 'center',
                      fontSize: '12px',
                    }}
                  >
                    履歴を読み込み中...
                  </div>
                ) : shellHistory.length > 0 ? (
                  <div
                    style={{
                      maxHeight: '150px',
                      overflowY: 'auto',
                      border: '1px solid var(--vscode-input-border)',
                      borderRadius: '4px',
                      background: 'var(--vscode-input-background)',
                    }}
                  >
                    {shellHistory.slice(0, 20).map((cmd, index) => (
                      <div
                        key={index}
                        onClick={() => handleShellHistorySelect(cmd)}
                        style={{
                          padding: '6px 10px',
                          cursor: 'pointer',
                          borderBottom:
                            index < shellHistory.length - 1
                              ? '1px solid var(--vscode-widget-border)'
                              : 'none',
                          fontSize: '12px',
                          background:
                            formData.command === cmd
                              ? 'var(--vscode-list-activeSelectionBackground)'
                              : 'transparent',
                        }}
                      >
                        <div
                          style={{
                            fontFamily: 'var(--vscode-editor-font-family)',
                          }}
                        >
                          {cmd}
                        </div>
                        {index < 5 && (
                          <div
                            style={{
                              fontSize: '10px',
                              opacity: 0.6,
                              marginTop: '2px',
                            }}
                          >
                            ⭐ よく使用される
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontSize: '12px',
                      opacity: 0.7,
                    }}
                  >
                    履歴が見つかりませんでした
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowShellHistory(false)}
                  style={{
                    marginTop: '4px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    background: 'transparent',
                    color: 'var(--vscode-foreground)',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  閉じる
                </button>
              </div>
            )}

            <input
              id="command"
              type="text"
              className="input"
              value={formData.command}
              onChange={(e) => handleInputChange('command', e.target.value)}
              placeholder="例: git status, npm start, docker build -t myapp ."
              required
            />
            <small
              style={{
                color: 'var(--vscode-descriptionForeground)',
                fontSize: '11px',
              }}
            >
              動的な入力が必要な部分は [入力内容] の形式で記述してください
            </small>
          </div>
        )}

        <div className="input-group">
          <label className="label" htmlFor="name">
            コマンド名（表示名）
          </label>
          <input
            id="name"
            type="text"
            className="input"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder={
              formData.commandType === 'vscode'
                ? getDisplayName(formData.command)
                : '例: Git Status'
            }
          />
          <small
            style={{
              color: 'var(--vscode-descriptionForeground)',
              fontSize: '11px',
            }}
          >
            空の場合はコマンド本文が表示名として使用されます
          </small>
        </div>

        <div className="input-group">
          <label className="label" htmlFor="description">
            説明
          </label>
          <textarea
            id="description"
            className="input textarea"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="コマンドの説明を入力（オプション）"
            rows={3}
          />
        </div>

        <div className="input-group">
          <label className="label" htmlFor="category">
            保存範囲 *
          </label>
          <select
            id="category"
            className="select"
            value={formData.category}
            onChange={(e) =>
              handleInputChange(
                'category',
                e.target.value as 'repository' | 'global'
              )
            }
          >
            <option value="repository">ワークスペース</option>
            <option value="global">グローバル</option>
          </select>
        </div>

        <div className="input-group">
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={formData.isFavorite}
              onChange={(e) =>
                handleInputChange('isFavorite', e.target.checked)
              }
            />
            <span className="label" style={{ margin: 0 }}>
              お気に入りに追加
            </span>
          </label>
        </div>

        {commandInputs.length > 0 && (
          <div className="input-group">
            <label className="label">検出された入力フィールド</label>
            <div
              style={{
                padding: '8px',
                background: 'var(--vscode-textCodeBlock-background)',
                borderRadius: '4px',
                fontSize: '11px',
              }}
            >
              {commandInputs.map((input, index) => (
                <div key={input.id} style={{ marginBottom: '4px' }}>
                  {index + 1}. {input.placeholder}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button
            type="submit"
            className="button"
            disabled={!formData.command.trim()}
          >
            {isEditing ? '更新' : '追加'}
          </button>
          <button type="button" className="button secondary" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
};

export default CommandForm;
