export const window = {
  showInputBox: jest.fn(),
  showQuickPick: jest.fn(),
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  createTerminal: jest.fn(() => ({
    show: jest.fn(),
    sendText: jest.fn(),
  })),
  activeTerminal: null,
  createTreeView: jest.fn(),
  registerWebviewViewProvider: jest.fn(),
};

export const commands = {
  registerCommand: jest.fn(),
};

export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
};

export class TreeItem {
  constructor(public label: string, public collapsibleState?: number) {}
}

export class ThemeIcon {
  constructor(public id: string) {}
}

export const Uri = {
  joinPath: jest.fn(),
};
