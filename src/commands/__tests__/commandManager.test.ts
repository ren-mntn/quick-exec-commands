import * as vscode from 'vscode';
import { CommandManager } from '../commandManager';

describe('CommandManager', () => {
  let commandManager: CommandManager;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    mockContext = {
      globalState: {
        get: jest.fn().mockReturnValue([]),
        update: jest.fn(),
      },
      workspaceState: {
        get: jest.fn().mockReturnValue([]),
        update: jest.fn(),
      },
    } as any;

    commandManager = new CommandManager(mockContext);
  });

  describe('addCommand', () => {
    it('should add a new command', async () => {
      const command = {
        name: 'Test Command',
        command: 'echo "test"',
        description: 'Test description',
        category: 'global' as const,
        isFavorite: false,
        inputs: [],
      };

      const result = await commandManager.addCommand(command);

      expect(result.name).toBe(command.name);
      expect(result.command).toBe(command.command);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });
  });

  describe('extractInputFields', () => {
    it('should extract input fields from command string', () => {
      const command = 'git commit -m [message] --author [author]';
      const inputs = (commandManager as any).extractInputFields(command);

      expect(inputs).toHaveLength(2);
      expect(inputs[0].placeholder).toBe('message');
      expect(inputs[1].placeholder).toBe('author');
    });

    it('should return empty array for command without inputs', () => {
      const command = 'git status';
      const inputs = (commandManager as any).extractInputFields(command);

      expect(inputs).toHaveLength(0);
    });
  });

  describe('replaceCommandInputs', () => {
    it('should replace input placeholders with values', () => {
      const command = 'git commit -m [message]';
      const inputs = [
        {
          id: 'input_0',
          placeholder: 'message',
          position: 15,
          required: true,
        },
      ];
      const values = { input_0: 'Initial commit' };

      const result = (commandManager as any).replaceCommandInputs(
        command,
        inputs,
        values
      );

      expect(result).toBe('git commit -m Initial commit');
    });
  });
});
