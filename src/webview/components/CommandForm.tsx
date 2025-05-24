import React, { useState } from 'react';
import { CommandInput, QuickCommand } from '../../types';

interface CommandFormProps {
  onSubmit: (command: Omit<QuickCommand, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const CommandForm: React.FC<CommandFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    command: '',
    description: '',
    category: 'repository' as 'repository' | 'global',
    isFavorite: false
  });

  const [commandInputs, setCommandInputs] = useState<CommandInput[]>([]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
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
        required: true
      });
      index++;
    }

    setCommandInputs(inputs);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.command.trim()) {
      return;
    }

    onSubmit({
      ...formData,
      inputs: commandInputs
    });

    // フォームをリセット
    setFormData({
      name: '',
      command: '',
      description: '',
      category: 'repository',
      isFavorite: false
    });
    setCommandInputs([]);
  };

  return (
    <div className="form-section">
      <h3 className="form-title">新しいコマンドを追加</h3>
      
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="label" htmlFor="name">
            コマンド名 *
          </label>
          <input
            id="name"
            type="text"
            className="input"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="例: Git Commit"
            required
          />
        </div>

        <div className="input-group">
          <label className="label" htmlFor="command">
            コマンド *
          </label>
          <input
            id="command"
            type="text"
            className="input"
            value={formData.command}
            onChange={(e) => handleInputChange('command', e.target.value)}
            placeholder="例: git commit -m [メッセージ]"
            required
          />
          <small style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '11px' }}>
            動的な入力が必要な部分は [入力内容] の形式で記述してください
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
            onChange={(e) => handleInputChange('category', e.target.value as 'repository' | 'global')}
          >
            <option value="repository">ワークスペース</option>
            <option value="global">グローバル</option>
          </select>
        </div>

        <div className="input-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.isFavorite}
              onChange={(e) => handleInputChange('isFavorite', e.target.checked)}
            />
            <span className="label" style={{ margin: 0 }}>お気に入りに追加</span>
          </label>
        </div>

        {commandInputs.length > 0 && (
          <div className="input-group">
            <label className="label">検出された入力フィールド</label>
            <div style={{ 
              padding: '8px', 
              background: 'var(--vscode-textCodeBlock-background)', 
              borderRadius: '4px',
              fontSize: '11px'
            }}>
              {commandInputs.map((input, index) => (
                <div key={input.id} style={{ marginBottom: '4px' }}>
                  {index + 1}. {input.placeholder}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button type="submit" className="button">
            追加
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